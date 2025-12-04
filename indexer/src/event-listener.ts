import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { MerkleTree, DEFAULT_ZERO } from "./merkle-tree";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { BorshCoder, EventParser, Idl } from "@coral-xyz/anchor";
import idl from "./zkcash.json";
import { parseLogs } from "@debridge-finance/solana-transaction-parser";
import { decodeEvent, ParsedEvent } from "./event-decoder";
import { IsNull, Not, Repository } from "typeorm";
import { CommitmentEvent } from "./entities/CommitmentEvent";

interface CommitmentEventData {
  commitment: string;
  index: number;
  slot: number;
  signature: string;
  encryptedOutput: string;
}

/**
 * Service for listening to Solana program events and updating merkle tree
 */
export class SolanaEventListener {
  private connection: Connection;
  private programId: PublicKey;
  private merkleTree: MerkleTree;
  private commitmentRepository: Repository<CommitmentEvent>;
  private isRunning: boolean = false;
  private currentSlot: number = 0;
  private eventParser: EventParser;
  private coder: BorshCoder;

  constructor(
    connection: Connection,
    programId: PublicKey,
    merkleTree: MerkleTree,
    commitmentRepository: Repository<CommitmentEvent>
  ) {
    this.connection = connection;
    this.programId = programId;
    this.merkleTree = merkleTree;
    this.commitmentRepository = commitmentRepository;
    this.coder = new BorshCoder(idl as Idl);
    this.eventParser = new EventParser(this.programId, this.coder);
  }

  /**
   * Start listening for new transactions
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Event listener is already running");
      return;
    }

    console.log("Starting event listener...");
    console.log("Program ID:", this.programId.toString());

    // Load existing commitments from database and rebuild merkle tree
    await this.loadCommitmentsFromDatabase();

    // Load historical transactions first
    await this.loadHistoricalTransactions();

    this.isRunning = true;

    // Subscribe to new transactions
    this.subscribeToProgram();

    console.log("Event listener started successfully");
  }

  /**
   * Load existing commitments from database and rebuild merkle tree
   */
  private async loadCommitmentsFromDatabase(): Promise<void> {
    try {
      console.log("Loading commitments from database...");
      const events = await this.commitmentRepository.find({
        order: { index: "ASC" },
      });

      console.log(`Found ${events.length} commitments in database`);

      // Rebuild merkle tree from storage, respecting stored indices
      if (events.length > 0) {
        // Find maximum index to determine tree size
        const maxIndex = Math.max(...events.map((e) => e.index));

        // Pad tree with zeros up to maxIndex if needed
        const currentLength = this.merkleTree.length();
        if (maxIndex >= currentLength) {
          const paddingNeeded = maxIndex - currentLength + 1;
          console.log(
            `Padding tree with ${paddingNeeded} zeros to reach index ${maxIndex}`
          );
          for (let i = 0; i < paddingNeeded; i++) {
            this.merkleTree.insert(DEFAULT_ZERO.toString());
          }
        }

        // Update tree with commitments at their stored indices
        for (const event of events) {
          this.merkleTree.update(event.index, event.commitment);
        }
      }

      console.log(
        `Rebuilt merkle tree with ${
          events.length
        } commitments, root: ${this.merkleTree.root().substring(0, 16)}...`
      );
    } catch (error) {
      console.error("Error loading commitments from database:", error);
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    this.isRunning = false;
    console.log("Event listener stopped");
  }

  /**
   * Get all commitments
   */
  async getCommitments(): Promise<CommitmentEventData[]> {
    const events = await this.commitmentRepository.find({
      order: { index: "ASC" },
    });
    return events.map((e: CommitmentEvent) => ({
      commitment: e.commitment,
      index: e.index,
      slot: Number(e.slot),
      signature: e.signature,
      encryptedOutput: e.encryptedOutput,
    }));
  }

  /**
   * Get current merkle root
   */
  getRoot(): string {
    return this.merkleTree.root();
  }

  /**
   * Get merkle proof for a commitment
   */
  getProof(
    commitment: string
  ): { pathElements: string[]; pathIndices: number[] } | null {
    const index = this.merkleTree.indexOf(commitment);

    if (index === -1) {
      return null;
    }

    return this.merkleTree.path(index);
  }

  /**
   * Load historical transactions from the program
   */
  private async loadHistoricalTransactions(): Promise<void> {
    try {
      console.log("Loading historical transactions...");

      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit: 1000 }
      );

      console.log(`Found ${signatures.length} historical transactions`);

      // Process transactions in chronological order (oldest first)
      // Note: We don't skip by signature because a transaction may have been partially processed
      // (e.g., only one commitment saved). The addCommitment method will skip duplicates by commitment value.
      const reversedSignatures = signatures.reverse();
      let processedCount = 0;
      let skippedCount = 0;

      for (const sigInfo of reversedSignatures) {
        try {
          const tx = await this.connection.getParsedTransaction(
            sigInfo.signature,
            {
              maxSupportedTransactionVersion: 0,
            }
          );

          if (tx) {
            await this.processTransaction(tx, sigInfo.signature);
            processedCount++;
          }
        } catch (error) {
          // Check if it's a log parsing error (e.g., program deployment)
          if (
            error instanceof Error &&
            error.message.includes("Failed to parse log line")
          ) {
            skippedCount++;
            console.log(
              `Skipping transaction ${sigInfo.signature} (program deployment/upgrade)`
            );
          } else {
            console.error(
              `Error processing transaction ${sigInfo.signature}:`,
              error
            );
          }
        }
      }

      const count = await this.commitmentRepository.count();
      console.log(
        `Processed ${processedCount} new transactions, skipped ${skippedCount} already processed`
      );
      console.log(`Total commitments in database: ${count}`);
      console.log("Current merkle root:", this.merkleTree.root());
    } catch (error) {
      console.error("Error loading historical transactions:", error);
    }
  }

  /**
   * Subscribe to new program transactions
   */
  private subscribeToProgram(): void {
    console.log("Subscribing to new transactions...");

    this.connection.onLogs(
      this.programId,
      async (logs, ctx) => {
        try {
          if (logs.err) {
            return;
          }

          const signature = logs.signature;
          const parsedLogs = parseLogs(logs.logs);
          const relevantLogs = parsedLogs.filter(
            (log) => log.programId === this.programId.toString()
          );

          const events: ParsedEvent[] = [];

          // Decode events from data logs
          for (const log of relevantLogs) {
            for (const dataLog of log.dataLogs) {
              const parsedEvent = decodeEvent(dataLog, signature);

              if (parsedEvent) {
                events.push(parsedEvent);
              }
            }
          }

          // Process decoded events
          for (const event of events) {
            if (event.type === "CommitmentData") {
              const data = event.data;

              if (data.isOldFormat) {
                // Old format: single commitment
                console.log(
                  `Processing CommitmentData event (old format): index=${
                    data.index
                  }, commitment=${data.commitment0.substring(0, 16)}...`
                );
                console.log(`Adding commitment at index ${Number(data.index)}`);
                await this.addCommitment(
                  data.commitment0,
                  Number(data.index),
                  ctx.slot,
                  signature,
                  data.encryptedOutput
                );
              } else {
                // New format: two commitments
                console.log(
                  `Processing CommitmentData event (new format): index=${
                    data.index
                  }, commitment0=${data.commitment0.substring(
                    0,
                    16
                  )}..., commitment1=${data.commitment1?.substring(0, 16)}...`
                );

                // Add first commitment at index
                console.log(
                  `Adding commitment0 at index ${Number(data.index)}`
                );
                await this.addCommitment(
                  data.commitment0,
                  Number(data.index),
                  ctx.slot,
                  signature,
                  data.encryptedOutput
                );

                // Add second commitment at index + 1 (if exists)
                if (data.commitment1) {
                  const secondIndex = Number(data.index) + 1;
                  console.log(`Adding commitment1 at index ${secondIndex}`);
                  await this.addCommitment(
                    data.commitment1,
                    secondIndex,
                    ctx.slot,
                    signature,
                    data.encryptedOutput
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error("Error processing new transaction:", error);
        }
      },
      "confirmed"
    );
  }

  /**
   * Process a transaction and extract commitments
   */
  private async processTransaction(
    tx: ParsedTransactionWithMeta,
    signature: string
  ): Promise<void> {
    if (!tx || !tx.meta || tx.meta.err) {
      return;
    }

    try {
      const logs = tx.meta.logMessages || [];
      let parsedLogs;
      try {
        parsedLogs = parseLogs(logs);
      } catch (parseError) {
        // Skip transactions with unparseable logs (e.g., program deployment/upgrade transactions)
        console.log(
          `Skipping transaction ${signature} due to log parsing error: ${parseError}`
        );
        return;
      }

      const relevantLogs = parsedLogs.filter(
        (log) => log.programId === this.programId.toString()
      );

      const events: ParsedEvent[] = [];

      // Decode events from data logs
      for (const log of relevantLogs) {
        for (const dataLog of log.dataLogs) {
          const parsedEvent = decodeEvent(dataLog, signature);

          if (parsedEvent) {
            events.push(parsedEvent);
          }
        }
      }

      // Process decoded events
      for (const event of events) {
        if (event.type === "CommitmentData") {
          const data = event.data;

          if (data.isOldFormat) {
            // Old format: single commitment
            console.log(
              `Processing CommitmentData event (old format) from transaction ${signature}: index=${
                data.index
              }, commitment=${data.commitment0.substring(0, 16)}...`
            );
            console.log(`Adding commitment at index ${Number(data.index)}`);
            await this.addCommitment(
              data.commitment0,
              Number(data.index),
              tx.slot,
              signature,
              data.encryptedOutput
            );
          } else {
            // New format: two commitments
            console.log(
              `Processing CommitmentData event (new format) from transaction ${signature}: index=${
                data.index
              }, commitment0=${data.commitment0.substring(
                0,
                16
              )}..., commitment1=${data.commitment1?.substring(0, 16)}...`
            );

            // Add first commitment at index
            console.log(`Adding commitment0 at index ${Number(data.index)}`);
            await this.addCommitment(
              data.commitment0,
              Number(data.index),
              tx.slot,
              signature,
              data.encryptedOutput
            );

            // Add second commitment at index + 1 (if exists)
            if (data.commitment1) {
              const secondIndex = Number(data.index) + 1;
              console.log(`Adding commitment1 at index ${secondIndex}`);
              await this.addCommitment(
                data.commitment1,
                secondIndex,
                tx.slot,
                signature,
                data.encryptedOutput
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error extracting commitments from transaction:", error);
    }
  }

  /**
   * Add a commitment to the tree
   */
  private async addCommitment(
    commitment: string,
    eventIndex: number,
    slot: number,
    signature: string,
    encryptedOutput: string
  ): Promise<void> {
    // Validate commitment
    if (!commitment || commitment.trim() === "") {
      console.error("Invalid commitment: empty or undefined");
      return;
    }

    // Check if commitment is a valid numeric string
    try {
      BigInt(commitment);
    } catch (error) {
      console.error(`Invalid commitment format: ${commitment}, error:`, error);
      return;
    }

    console.log(
      `Processing commitment: ${commitment} (length: ${commitment.length}), eventIndex: ${eventIndex}`
    );

    // Check if already exists in storage by commitment
    const existing = await this.commitmentRepository.findOne({
      where: { commitment },
    });

    // Also check if index is already taken by a different commitment
    const allCommitments = await this.commitmentRepository.find({
      order: { index: "ASC" },
    });
    const existingAtIndex = allCommitments.find(
      (c) => c.index === eventIndex && c.commitment !== commitment
    );

    if (existingAtIndex) {
      console.error(
        `Index ${eventIndex} is already taken by commitment ${existingAtIndex.commitment.substring(
          0,
          16
        )}..., skipping ${commitment.substring(0, 16)}...`
      );
      return;
    }

    if (!existing) {
      const currentLength = this.merkleTree.length();

      // If eventIndex is beyond current length, pad with zeros
      if (eventIndex > currentLength) {
        const paddingNeeded = eventIndex - currentLength;
        console.log(
          `Padding tree with ${paddingNeeded} zeros to reach index ${eventIndex}`
        );
        for (let i = 0; i < paddingNeeded; i++) {
          this.merkleTree.insert(DEFAULT_ZERO.toString());
        }
      }

      // If eventIndex equals current length, use insert
      // Otherwise, use update to set at the specific index
      if (eventIndex === this.merkleTree.length()) {
        console.log(`Inserting commitment at index ${eventIndex}`);
        this.merkleTree.insert(commitment);
      } else {
        console.log(`Updating commitment at index ${eventIndex}`);
        this.merkleTree.update(eventIndex, commitment);
      }

      // Save to storage with the correct eventIndex
      const commitmentEvent = this.commitmentRepository.create({
        commitment,
        index: eventIndex,
        slot: BigInt(slot).toString(),
        signature,
        encryptedOutput,
      });
      await this.commitmentRepository.save(commitmentEvent);

      console.log(
        `Added commitment ${commitment.substring(
          0,
          16
        )}... at index ${eventIndex}, new root: ${this.merkleTree
          .root()
          .substring(0, 16)}...`
      );
    } else {
      // If commitment exists but index is different, update it
      if (existing.index !== eventIndex) {
        console.log(
          `Commitment exists but index mismatch: stored=${existing.index}, event=${eventIndex}, updating...`
        );

        const currentLength = this.merkleTree.length();

        // Pad if needed
        if (eventIndex >= currentLength) {
          const paddingNeeded = eventIndex - currentLength + 1;
          for (let i = 0; i < paddingNeeded; i++) {
            this.merkleTree.insert(DEFAULT_ZERO.toString());
          }
        }

        // Update tree at correct index
        this.merkleTree.update(eventIndex, commitment);

        // Update storage
        existing.index = eventIndex;
        await this.commitmentRepository.save(existing);

        console.log(
          `Updated commitment ${commitment.substring(
            0,
            16
          )}... to index ${eventIndex}`
        );
      } else {
        console.log(
          `Commitment already exists at correct index: ${commitment.substring(
            0,
            16
          )}...`
        );
      }
    }
  }
}
