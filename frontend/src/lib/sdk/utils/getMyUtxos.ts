import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import axios, { type AxiosResponse } from "axios";
import BN from "bn.js";
import { Keypair as UtxoKeypair } from "@/lib/sdk/models/keypair";
import { Utxo } from "@/lib/sdk/models/utxo";
import { EncryptionService } from "@/lib/sdk/utils/encryption";
//@ts-ignore
import * as ffjavascript from "ffjavascript";
import {
  FETCH_UTXOS_GROUP_SIZE,
  INDEXER_API_URL,
  PROGRAM_ID,
} from "@/lib/sdk/utils/constants";
import type { Signed } from "./getAccountSign";


// Use type assertion for the utility functions (same pattern as in get_verification_keys.ts)
const utils = ffjavascript.utils as any;
const { unstringifyBigInts, leInt2Buff } = utils;


/**
 * Interface for the UTXO data returned from the API
 */
interface ApiUtxo {
  commitment: string;
  encryptedOutput: string; // Hex-encoded encrypted UTXO data
  index: number;
  signature?: string; // Transaction signature
  slot?: number; // Slot number
  nullifier?: string; // Optional, might not be present for all UTXOs
}

/**
 * Interface for the API response format with commitments array
 */
interface ApiResponse {
  commitments: ApiUtxo[];
  count: number;
  total: number;
  start: number;
  end: number;
  timestamp: string;
  hasMore?: boolean;
}

function sleep(ms: number): Promise<string> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve("ok");
    }, ms)
  );
}

/**
 * Group UTXOs by mint address and calculate total balance for each mint
 * @param utxos Array of UTXOs to group
 * @returns Map of mint address (as field element string) to total balance (as BN)
 */
export function groupUtxosByMint(utxos: Utxo[]): Map<string, BN> {
  const balancesByMint = new Map<string, BN>();

  for (const utxo of utxos) {
    const mintAddress = utxo.mintAddress;
    const currentBalance = balancesByMint.get(mintAddress) || new BN(0);
    balancesByMint.set(mintAddress, currentBalance.add(utxo.amount));
  }

  return balancesByMint;
}

/**
 * Calculate total SOL balance from UTXOs
 * @param utxos Array of UTXOs
 * @returns Total balance in SOL
 */
export function getBalanceFromUtxos(utxos: Utxo[]): number {
  // SOL mint address as field element
  const SOL_MINT = "14297923448564296417094361404830720001668866657658538855298779812503247422177";
  
  let totalBalance = new BN(0);
  
  for (const utxo of utxos) {
    if (utxo.mintAddress === SOL_MINT) {
      totalBalance = totalBalance.add(utxo.amount);
    }
  }
  
  // Convert from lamports to SOL
  return totalBalance.toNumber() / LAMPORTS_PER_SOL;
}


export function localstorageKey(key: PublicKey) {
  return PROGRAM_ID.toString().substring(0, 6) + key.toString().substring(0, 6);
}

let getMyUtxosPromise: Promise<Utxo[]> | null = null;
let roundStartIndex = 0;
let decryptionTaskFinished = 0;

/**
 * Deduplicate UTXOs based on commitment hash
 * @param utxos Array of UTXOs that may contain duplicates
 * @returns Array of unique UTXOs
 */
async function deduplicateUtxos(utxos: Utxo[]): Promise<Utxo[]> {
  const commitmentMap = new Map<string, Utxo>();
  
  for (const utxo of utxos) {
    try {
      const commitment = await utxo.getCommitment();
      
      // Only keep the first occurrence of each commitment
      if (!commitmentMap.has(commitment)) {
        commitmentMap.set(commitment, utxo);
      }
    } catch (error: any) {
      console.error("Error getting commitment for UTXO, skipping:", error);
      // Skip UTXOs with invalid commitments - they are likely corrupted
    }
  }
  
  return Array.from(commitmentMap.values());
}

/**
 * Fetch and decrypt all UTXOs for a user
 * @param signed The user's signature
 * @param connection Solana connection to fetch on-chain commitment accounts
 * @param setStatus A global state updator. Set live status message showing on webpage
 * @returns Array of decrypted UTXOs that belong to the user
 */
export async function getMyUtxos(
  signed: Signed,
  connection: Connection,
  setStatus?: any,
  hasher?: any
): Promise<Utxo[]> {
  if (!signed) {
    throw new Error("signed undefined");
  }
  if (!hasher) {
    throw new Error("getMyUtxos:no hasher");
  }
  if (!getMyUtxosPromise) {
    getMyUtxosPromise = (async () => {
      setStatus?.(`(loading utxos...)`);
      let valid_utxos: Utxo[] = [];
      
      // Start with empty array - we'll rebuild the list from scratch
      // to remove spent UTXOs
      let valid_strings: string[] = [];
      
      try {
        let offsetStr = localStorage.getItem(
          "fetchUtxoOffset" + localstorageKey(signed.publicKey)
        );
        if (offsetStr) {
          roundStartIndex = Number(offsetStr);
        } else {
          roundStartIndex = 0;
        }
        decryptionTaskFinished = 0;
        while (true) {
          let offsetStr = localStorage.getItem(
            "fetchUtxoOffset" + localstorageKey(signed.publicKey)
          );
          let fetch_utxo_offset = offsetStr ? Number(offsetStr) : 0;
          let fetch_utxo_end = fetch_utxo_offset + FETCH_UTXOS_GROUP_SIZE;
          let fetch_utxo_url = `${INDEXER_API_URL}/commitments?start=${fetch_utxo_offset}&end=${fetch_utxo_end}`;
          let fetched = await fetchUserUtxos(
            signed,
            connection,
            fetch_utxo_url,
            setStatus,
            hasher
          );
          console.log("fetched:", fetched);
          let am = 0;
          for (let [k, utxo] of fetched.utxos.entries()) {
            if (
              utxo.amount.toNumber() > 0 &&
              !(await isUtxoSpent(connection, utxo))
            ) {
              console.log(
                "debug utxo amout",
                utxo.mintAddress,
                utxo.amount.toNumber()
              );
              am += utxo.amount.toNumber();
              valid_utxos.push(utxo);
              
              // Add encryptedOutput for this UTXO
              const encOutput = fetched.encryptedOutputs[k];
              if (encOutput) {
                valid_strings.push(encOutput);
              }
            }
          }
          localStorage.setItem('fetchUtxoOffset' + localstorageKey(signed.publicKey), (fetch_utxo_offset + fetched.len).toString())
          if (!fetched.hashMore) {
            break;
          }
          await sleep(100);
        }
      } finally {
        getMyUtxosPromise = null;
      }
      // store valid strings
      console.log("valid_strings:", valid_strings);
      valid_strings = [...new Set(valid_strings)];
      localStorage.setItem('encryptedOutputs' + localstorageKey(signed.publicKey), JSON.stringify(valid_strings))
      setStatus?.("");
      console.log("valid_utxos before dedup:", valid_utxos.length);
      
      // Deduplicate UTXOs by commitment hash
      const uniqueUtxos = await deduplicateUtxos(valid_utxos);
      console.log("valid_utxos after dedup:", uniqueUtxos.length);
      return uniqueUtxos;
    })();
  }
  return getMyUtxosPromise;
}


async function fetchUserUtxos(
  signed: Signed,
  connection: Connection,
  apiUrl: string,
  setStatus?: Function,
  hasher?: any
): Promise<{
  encryptedOutputs: string[];
  utxos: Utxo[];
  hashMore: boolean;
  len: number;
}> {
  try {
    if (!hasher) {
      throw new Error("fetchUserUtxos: no hashser");
    }
    // Initialize the light protocol hasher
    // const lightWasm = await getHasher()
    const lightWasm = hasher;

    // Initialize the encryption service and generate encryption key from the keypair
    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

    const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();
    const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

    const url = apiUrl || `${INDEXER_API_URL}/commitments`;

    let encryptedOutputs: string[] = [];
    let response: AxiosResponse<any, any>;
    try {
      response = await axios.get(url);

      if (!response.data) {
        console.error("API returned empty data");
      } else if (
        typeof response.data === "object" &&
        response.data.commitments
      ) {
        // Handle the new API format with commitments array
        const apiResponse = response.data as ApiResponse;

        // Extract encrypted outputs from the commitments array
        encryptedOutputs = apiResponse.commitments
          .filter((utxo) => utxo.encryptedOutput)
          .filter((utxo) => utxo.encryptedOutput.length === 144) // FIXX
          .map((utxo) => utxo.encryptedOutput);

      } else if (Array.isArray(response.data)) {
        // Handle the case where the API returns an array of UTXOs (old format)
        const utxos: ApiUtxo[] = response.data;
        console.log(
          `Found ${utxos.length} total UTXOs in the system (array format)`
        );

        // Extract encrypted outputs from the array of UTXOs (get unique values)
        encryptedOutputs = Array.from(
          new Set(
            utxos
              .filter((utxo) => utxo.encryptedOutput)
              .map((utxo) => utxo.encryptedOutput)
          )
        );
      } else if (
        typeof response.data === "object" &&
        response.data.encrypted_outputs
      ) {
        // Handle the old case where the API returns an object with encrypted_outputs array
        const apiResponse = response.data as {
          count: number;
          encrypted_outputs: string[];
        };
        encryptedOutputs = apiResponse.encrypted_outputs;
        console.log(
          `Found ${apiResponse.count} total UTXOs in the system (old object format)`
        );
      } else {
        console.error(
          `API returned unexpected data format: ${JSON.stringify(
            response.data
          ).substring(0, 200)}...`
        );
      }

      // Remove duplicates before processing
      encryptedOutputs = Array.from(new Set(encryptedOutputs));

      // Log all encrypted outputs line by line
      // console.log("\n=== ALL ENCRYPTED OUTPUTS (after deduplication) ===");
      // encryptedOutputs.forEach((output, index) => {
      //   console.log(`[${index + 1}] ${output} (length: ${output.length})`);
      // });
      // console.log(
      //   `=== END OF ENCRYPTED OUTPUTS (${encryptedOutputs.length} unique) ===\n`
      // );
    } catch (apiError: any) {
      throw new Error(`API request failed: ${apiError.message}`);
    }

    // Try to decrypt each encrypted output
    const myUtxos: Utxo[] = [];
    const myEncryptedOutputs: string[] = [];
    console.log("Attempting to decrypt UTXOs...");
    let decryptionAttempts = 0;
    let successfulDecryptions = 0;

    let cachedStringNum = 0;
    let cachedString = localStorage.getItem(
      "encryptedOutputs" + localstorageKey(signed.publicKey)
    );
    if (cachedString) {
      cachedStringNum = JSON.parse(cachedString).length;
    }

    let decryptionTaskTotal =
      response.data.total + cachedStringNum - roundStartIndex;
    // check fetched string
    for (let i = 0; i < encryptedOutputs.length; i++) {
      const encryptedOutput = encryptedOutputs[i];
      setStatus?.(
        `(decrypting utxo: ${decryptionTaskFinished + 1
        }/${decryptionTaskTotal}...)`
      );
      let dres = await decrypt_output(
        encryptedOutput,
        encryptionService,
        utxoKeypair,
        lightWasm,
        connection
      );
      decryptionTaskFinished++;
      if (dres.status == "decrypted" && dres.utxos) {
        // console.log(`got ${dres.utxos.length} decrypted utxo(s) from fetching`);
        // Add all UTXOs from this encrypted output
        // Important: add encryptedOutput for each UTXO to maintain index correspondence
        for (const utxo of dres.utxos) {
          myUtxos.push(utxo);
          myEncryptedOutputs.push(encryptedOutput);
        }
      }
    }
    // check cached string when no more fetching tasks
    if (!response.data.hasMore) {
      if (cachedString) {
        let cachedEncryptedOutputs = JSON.parse(cachedString);
        console.log("cachedEncryptedOutputs:", cachedEncryptedOutputs.length);
        for (let encryptedOutput of cachedEncryptedOutputs) {
          setStatus?.(
            `(decrypting utxo: ${decryptionTaskFinished + 1
            }/${decryptionTaskTotal}...)`
          );
          let dres = await decrypt_output(
            encryptedOutput,
            encryptionService,
            utxoKeypair,
            lightWasm,
            connection
          );
          decryptionTaskFinished++;
          if (dres.status == "decrypted" && dres.utxos) {
            console.log(`got ${dres.utxos.length} decrypted utxo(s) from caching`);
            // Add all UTXOs from this encrypted output
            // Important: add encryptedOutput for each UTXO to maintain index correspondence
            for (const utxo of dres.utxos) {
              myUtxos.push(utxo);
              myEncryptedOutputs.push(encryptedOutput);
            }
          }
        }
      }
    }

    // console.log(
    //   `\nDecryption summary: ${successfulDecryptions} successful out of ${decryptionAttempts} attempts`
    // );
    // console.log(
    //   `Found ${myUtxos.length} UTXOs belonging to your keypair in ${encryptedOutputs.length} total UTXOs`
    // );
    return {
      encryptedOutputs: myEncryptedOutputs,
      utxos: myUtxos,
      hashMore: response.data.hasMore,
      len: encryptedOutputs.length,
    };
  } catch (error: any) {
    console.error("Error fetching UTXOs:", error.message);
    return { encryptedOutputs: [], utxos: [], hashMore: false, len: 0 };
  }
}

/**
 * Check if a UTXO has been spent
 * @param connection Solana connection
 * @param utxo The UTXO to check
 * @returns Promise<boolean> true if spent, false if unspent
 */
export async function isUtxoSpent(
  connection: Connection,
  utxo: Utxo
): Promise<boolean> {
  try {
    // Get the nullifier for this UTXO
    const nullifier = await utxo.getNullifier();
    // Convert decimal nullifier string to byte array (same format as in proofs)
    // This matches how commitments are handled and how the Rust code expects the seeds
    const nullifierBytes = Array.from(
      leInt2Buff(unstringifyBigInts(nullifier), 32)
    ).reverse() as number[];

    // Try both nullifier0 and nullifier1 seeds since we don't know which one it would use
    let isSpent = false;

    // Try nullifier0 seed
    try {
      const [nullifierPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("nullifier"), Buffer.from(nullifierBytes)],
        PROGRAM_ID
      );

      const nullifierAccount = await connection.getAccountInfo(nullifierPDA);
      if (nullifierAccount !== null) {  

        isSpent = true;
        return isSpent;
      }
    } catch (e) {
      console.log("e:", e);
      // PDA derivation failed for nullifier0, continue to nullifier1
    }


   
    return false;
  } catch (error: any) {
    console.error("Error checking if UTXO is spent:", error);
    if (error.message?.includes("429")) {
      console.error("code 429, retry..");
      await new Promise((resolve) => setTimeout(resolve, 50000));
      return await isUtxoSpent(connection, utxo);
    }
    // Default to NOT spent in case of errors - be conservative to avoid losing valid UTXOs
    // Better to keep a potentially spent UTXO than to lose a valid one from the cache
    return false;
  }
}



// Decrypt single output to Utxo(s) - can contain 1 or 2 UTXOs
type DecryptRes = {
  status: "decrypted" | "skipped" | "unDecrypted";
  utxos?: Utxo[];
};
async function decrypt_output(
  encryptedOutput: string,
  encryptionService: EncryptionService,
  utxoKeypair: UtxoKeypair,
  lightWasm: any,
  connection: Connection
): Promise<DecryptRes> {
  let res: DecryptRes = { status: "unDecrypted" };
  try {
    if (!encryptedOutput) {
      return { status: "skipped" };
    }

    // Try to decrypt the UTXO(s) - can return 1 or 2 UTXOs
    const decryptedUtxos = await encryptionService.decryptUtxos(
      encryptedOutput,
      utxoKeypair,
      lightWasm
    );
    // console.log(`decryptedUtxos: ${decryptedUtxos.length} UTXOs`, decryptedUtxos);
    // If we got here, decryption succeeded, so these UTXOs belong to the user
    res.utxos = decryptedUtxos;
    res.status = "decrypted";

    // Get the real index from the on-chain commitment account for each UTXO
    for (const utxo of decryptedUtxos) {
      try {
        const commitment = await utxo.getCommitment();

        // Convert decimal commitment string to byte array (same format as in proofs)
        const commitmentBytes = Array.from(
          leInt2Buff(unstringifyBigInts(commitment), 32)
        ).reverse() as number[];

        // Derive the commitment PDA (could be either commitment0 or commitment1)
        // We'll try both seeds since we don't know which one it is
        let realIndex = null;
        // Try commitment0 seed
        try {
          const [commitment0PDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("commitment0"), Buffer.from(commitmentBytes)],
            PROGRAM_ID
          );

          const account0Info = await connection.getAccountInfo(commitment0PDA);
          if (account0Info) {
            // Parse the index from the account data according to CommitmentAccount structure:
            // 0-8: Anchor discriminator
            // 8-40: commitment (32 bytes)
            // 40-44: encrypted_output length (4 bytes)
            // 44-44+len: encrypted_output data
            // 44+len-52+len: index (8 bytes)
            const encryptedOutputLength = account0Info.data.readUInt32LE(40);
            const indexOffset = 44 + encryptedOutputLength;
            const indexBytes = account0Info.data.slice(
              indexOffset,
              indexOffset + 8
            );
            realIndex = new BN(indexBytes, "le").toNumber();
          }
        } catch (e) {
          // Try commitment1 seed if commitment0 fails
          try {
            const [commitment1PDA] = PublicKey.findProgramAddressSync(
              [Buffer.from("commitment1"), Buffer.from(commitmentBytes)],
              PROGRAM_ID
            );

            const account1Info = await connection.getAccountInfo(commitment1PDA);
            if (account1Info) {
              // Parse the index from the account data according to CommitmentAccount structure
              const encryptedOutputLength = account1Info.data.readUInt32LE(40);
              const indexOffset = 44 + encryptedOutputLength;
              const indexBytes = account1Info.data.slice(
                indexOffset,
                indexOffset + 8
              );
              realIndex = new BN(indexBytes, "le").toNumber();
            }
          } catch (e2) {
            console.log(
              `Could not find commitment account for ${commitment}, using encrypted index: ${utxo.index}`
            );
          }
        }

        // Update the UTXO with the real index if we found it
        if (realIndex !== null) {
          const oldIndex = utxo.index;
          utxo.index = realIndex;
          console.log(`Updated UTXO index from ${oldIndex} to ${realIndex}`);
        }
      } catch (error: any) {
        console.log(`Failed to get real index for UTXO: ${error.message}`);
      }
    }
  } catch (error: any) {
    // Log error but continue - this UTXO doesn't belong to the user
    // console.log(`✗ Failed to decrypt: ${error.message.split("\n")[0]}`);
  }
  return res;
}