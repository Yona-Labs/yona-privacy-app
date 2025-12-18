import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Connection } from "@solana/web3.js";
import { WasmFactory, LightWasm } from "@lightprotocol/hasher.rs";
import { MerkleTree } from "./lib/merkle-tree";
import { SolanaEventListener } from "./event-listener";
import { loadConfig, Config } from "./config";
import { handleWithdraw, handleSwap, WithdrawRequest, SwapRequest } from "./relayer";
import { JobQueue } from "./job-queue";
import {
  getDatabasePool,
  closeDatabasePool,
  getDataSource,
  closeDataSource,
} from "./database";
import { CommitmentEvent } from "./entities/CommitmentEvent";

/**
 * Main application server
 */
export class Server {
  private fastify: FastifyInstance;
  private connection!: Connection;
  private merkleTree!: MerkleTree;
  private eventListener!: SolanaEventListener;
  private lightWasm!: LightWasm;
  private config!: Config;
  private jobQueue?: JobQueue;
  private dbPool!: ReturnType<typeof getDatabasePool>;

  constructor() {
    this.fastify = Fastify({
      logger: {
        level: "info",
      },
    });
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    this.config = loadConfig();

    // Register CORS
    await this.fastify.register(cors, {
      origin: true, // Allow all origins in development
      credentials: true,
    });

    this.fastify.log.info("Initializing server...");
    this.fastify.log.info(`Solana RPC: ${this.config.solanaRpcUrl}`);
    this.fastify.log.info(`Program ID: ${this.config.programId.toString()}`);

    // Initialize database connection
    this.dbPool = getDatabasePool();
    this.fastify.log.info("Database connection pool initialized");

    // Initialize TypeORM DataSource
    const dataSource = await getDataSource();
    this.fastify.log.info("TypeORM DataSource initialized");

    if (this.config.relayerEnabled) {
      this.fastify.log.info(
        `Relayer enabled: ${this.config.relayerKeypair!.publicKey.toString()}`
      );
      this.fastify.log.info(`Min fee: ${this.config.minFeeLamports} lamports`);

      // Initialize job queue for async withdrawal and swap processing
      this.jobQueue = new JobQueue(
        (request) => handleWithdraw(request, this.config),
        (request) => handleSwap(request, this.config)
      );
      this.fastify.log.info(
        "Job queue initialized for async withdrawal and swap processing"
      );
    }

    // Initialize Light Wasm for Poseidon hashing
    this.lightWasm = await WasmFactory.getInstance();
    this.fastify.log.info("Light Wasm initialized");

    // Create merkle tree
    this.merkleTree = new MerkleTree(
      this.config.merkleTreeHeight,
      this.lightWasm
    );
    this.fastify.log.info(
      `Merkle tree initialized with height ${this.config.merkleTreeHeight}`
    );

    // Connect to Solana
    this.connection = new Connection(this.config.solanaRpcUrl, "confirmed");
    this.fastify.log.info("Connected to Solana");

    // Get commitment repository
    const commitmentRepository = dataSource.getRepository(CommitmentEvent);

    // Create event listener
    this.eventListener = new SolanaEventListener(
      this.connection,
      this.config.programId,
      this.merkleTree,
      commitmentRepository
    );

    // Setup routes
    this.setupRoutes();

    this.fastify.log.info("Server initialized successfully");
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.fastify.get("/health", async (request, reply) => {
      const health: any = {
        status: "ok",
        timestamp: new Date().toISOString(),
      };

      // Check database connection
      try {
        await this.dbPool.query("SELECT 1");
        health.database = {
          status: "connected",
        };
      } catch (error: any) {
        health.database = {
          status: "error",
          error: error.message || "Failed to connect to database",
        };
        health.status = "degraded";
      }

      // Add relayer info if enabled
      if (this.config.relayerEnabled && this.config.relayerKeypair) {
        try {
          const balance = await this.connection.getBalance(
            this.config.relayerKeypair.publicKey
          );
          health.relayer = {
            enabled: true,
            address: this.config.relayerKeypair.publicKey.toString(),
            balance: balance / 1e9,
          };
        } catch (error) {
          health.relayer = {
            enabled: true,
            error: "Failed to fetch balance",
          };
        }
      }

      return health;
    });

    // Get current merkle root
    this.fastify.get("/root", async (request, reply) => {
      const commitments = await this.eventListener.getCommitments();
      return {
        root: this.eventListener.getRoot(),
        nextIndex: commitments[commitments.length - 1].index + 1,
        timestamp: new Date().toISOString(),
      };
    });

    // Get all commitments with optional pagination
    this.fastify.get<{
      Querystring: { start?: string; end?: string };
    }>("/commitments", async (request, reply) => {
      const allCommitments = await this.eventListener.getCommitments();

      // Parse query parameters
      const start = request.query.start ? parseInt(request.query.start, 10) : 0;
      const end = request.query.end
        ? parseInt(request.query.end, 10)
        : allCommitments.length;

      // Validate parameters
      if (isNaN(start) || isNaN(end)) {
        reply.code(400);
        return {
          error: "Invalid start or end parameter",
          message: "start and end must be valid numbers",
        };
      }

      if (start < 0 || end < 0) {
        reply.code(400);
        return {
          error: "Invalid range",
          message: "start and end must be non-negative",
        };
      }

      if (start > end) {
        reply.code(400);
        return {
          error: "Invalid range",
          message: "start must be less than or equal to end",
        };
      }

      // Slice commitments based on range
      const commitments = allCommitments.slice(start, end);
      const actualEnd = Math.min(end, allCommitments.length);

      return {
        commitments,
        count: commitments.length,
        total: allCommitments.length,
        start,
        end: actualEnd,
        hasMore: actualEnd < allCommitments.length,
        timestamp: new Date().toISOString(),
      };
    });

    // Get commitment by index
    this.fastify.get<{
      Params: { index: string };
    }>("/commitments/:index", async (request, reply) => {
      const index = parseInt(request.params.index, 10);
      const commitments = await this.eventListener.getCommitments();

      if (isNaN(index) || index < 0 || index >= commitments.length) {
        reply.code(404);
        return {
          error: "Commitment not found",
          index,
        };
      }

      return commitments[index];
    });

    // Get tree info
    this.fastify.get("/tree/info", async (request, reply) => {
      const commitments = await this.eventListener.getCommitments();
      return {
        root: this.eventListener.getRoot(),
        height: this.merkleTree.levels,
        capacity: this.merkleTree.capacity,
        currentSize: commitments.length,
        timestamp: new Date().toISOString(),
      };
    });

    // Get encrypted outputs
    this.fastify.get("/encrypted_outputs", async (request, reply) => {
      const commitments = await this.eventListener.getCommitments();
      const encryptedOutputs = commitments
        .map((c) => c.encryptedOutput)
        .filter((output) => output && output.length > 0);

      return {
        encrypted_outputs: encryptedOutputs,
        count: encryptedOutputs.length,
        timestamp: new Date().toISOString(),
      };
    });

    // Get Merkle proof for a commitment
    this.fastify.get<{
      Params: { commitment: string };
    }>("/proof/:commitment", async (request, reply) => {
      const commitment = request.params.commitment;

      // Validate commitment format (should be a numeric string)
      try {
        BigInt(commitment);
      } catch (error) {
        reply.code(400);
        return {
          error: "Invalid commitment format",
          message: "Commitment must be a valid numeric string",
        };
      }

      const proof = this.eventListener.getProof(commitment);

      if (!proof) {
        reply.code(404);
        return {
          error: "Commitment not found",
          message: `Commitment ${commitment.substring(
            0,
            16
          )}... not found in merkle tree`,
        };
      }

      return {
        commitment,
        pathElements: proof.pathElements,
        pathIndices: proof.pathIndices,
        timestamp: new Date().toISOString(),
      };
    });

    // Relayer endpoints (if enabled)
    if (this.config.relayerEnabled) {
      // Get relayer info
      this.fastify.get("/relayer/info", async (request, reply) => {
        if (!this.config.relayerKeypair) {
          reply.code(503);
          return { error: "Relayer not available" };
        }

        const balance = await this.connection.getBalance(
          this.config.relayerKeypair.publicKey
        );
        return {
          relayerAddress: this.config.relayerKeypair.publicKey.toString(),
          balance: balance / 1e9,
          minFee: this.config.minFeeLamports,
          programId: this.config.programId.toString(),
        };
      });

      // Submit withdrawal (async - returns job ID immediately)
      this.fastify.post<{ Body: WithdrawRequest }>(
        "/relayer/withdraw",
        async (request, reply) => {
          try {
            const withdrawRequest = request.body;

            // Basic validation
            if (!withdrawRequest.proof || !withdrawRequest.extDataMinified) {
              reply.code(400);
              return {
                success: false,
                error: "Missing required fields: proof or extDataMinified",
              };
            }

            if (!withdrawRequest.recipient || !withdrawRequest.inputMint) {
              reply.code(400);
              return {
                success: false,
                error: "Missing required fields: recipient or inputMint",
              };
            }

            if (!this.jobQueue) {
              reply.code(503);
              return {
                success: false,
                error: "Job queue not initialized",
              };
            }

            // Add to job queue and return job ID immediately
            const jobId = this.jobQueue.addJob(withdrawRequest);

            reply.code(202); // Accepted
            return {
              success: true,
              jobId,
              message: "Withdrawal request accepted and queued for processing",
              statusUrl: `/relayer/status/${jobId}`,
            };
          } catch (error: any) {
            this.fastify.log.error(
              "Error in /relayer/withdraw endpoint:",
              error
            );
            reply.code(500);
            return {
              success: false,
              error: error.message || "Internal server error",
            };
          }
        }
      );

      // Get withdrawal job status
      this.fastify.get<{ Params: { jobId: string } }>(
        "/relayer/status/:jobId",
        async (request, reply) => {
          if (!this.jobQueue) {
            reply.code(503);
            return { error: "Job queue not available" };
          }

          const job = this.jobQueue.getJob(request.params.jobId);

          if (!job) {
            reply.code(404);
            return {
              success: false,
              error: "Job not found",
            };
          }

          const response: any = {
            jobId: job.id,
            status: job.status,
            createdAt: new Date(job.createdAt).toISOString(),
            updatedAt: new Date(job.updatedAt).toISOString(),
          };

          if (job.status === "completed" || job.status === "failed") {
            response.result = job.result;
          }

          if (job.error) {
            response.error = job.error;
          }

          return response;
        }
      );

      // Submit swap (async - returns job ID immediately)
      this.fastify.post<{ Body: SwapRequest }>(
        "/relayer/swap",
        async (request, reply) => {
          try {
            const swapRequest = request.body;

            // Basic validation
            if (!swapRequest.proof || !swapRequest.swapExtDataMinified) {
              reply.code(400);
              return {
                success: false,
                error: "Missing required fields: proof or swapExtDataMinified",
              };
            }

            if (!swapRequest.inputMint || !swapRequest.outputMint) {
              reply.code(400);
              return {
                success: false,
                error: "Missing required fields: inputMint or outputMint",
              };
            }

            if (!swapRequest.jupiterSwapData || !swapRequest.jupiterRemainingAccounts) {
              reply.code(400);
              return {
                success: false,
                error: "Missing required fields: jupiterSwapData or jupiterRemainingAccounts",
              };
            }

            if (!this.jobQueue) {
              reply.code(503);
              return {
                success: false,
                error: "Job queue not initialized",
              };
            }

            // Add to job queue and return job ID immediately
            const jobId = this.jobQueue.addSwapJob(swapRequest);

            reply.code(202); // Accepted
            return {
              success: true,
              jobId,
              message: "Swap request accepted and queued for processing",
              statusUrl: `/relayer/status/${jobId}`,
            };
          } catch (error: any) {
            this.fastify.log.error(
              "Error in /relayer/swap endpoint:",
              error
            );
            reply.code(500);
            return {
              success: false,
              error: error.message || "Internal server error",
            };
          }
        }
      );

      // Get queue statistics
      this.fastify.get("/relayer/queue/stats", async (request, reply) => {
        if (!this.jobQueue) {
          reply.code(503);
          return { error: "Job queue not available" };
        }

        return this.jobQueue.getStats();
      });

      this.fastify.log.info("Relayer routes configured");
    }

    this.fastify.log.info("Routes configured");
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Start event listener
    await this.eventListener.start();

    // Start HTTP server
    try {
      await this.fastify.listen({
        port: this.config.port,
        host: "0.0.0.0",
      });
      this.fastify.log.info(`Server listening on port ${this.config.port}`);

      if (this.config.relayerEnabled) {
        this.fastify.log.info(`\nRelayer endpoints available:`);
        this.fastify.log.info(
          `  GET  /relayer/info            - Relayer information`
        );
        this.fastify.log.info(
          `  POST /relayer/withdraw        - Submit withdrawal (returns jobId)`
        );
        this.fastify.log.info(
          `  POST /relayer/swap            - Submit swap (returns jobId)`
        );
        this.fastify.log.info(
          `  GET  /relayer/status/:jobId   - Check job status`
        );
        this.fastify.log.info(
          `  GET  /relayer/queue/stats     - Queue statistics\n`
        );
      }
    } catch (err) {
      this.fastify.log.error(err);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.eventListener.stop();
    await closeDatabasePool();
    await closeDataSource();
    await this.fastify.close();
    this.fastify.log.info("Server stopped");
  }
}