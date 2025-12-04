import { PublicKey, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";

// Load .env file
dotenv.config();

export interface Config {
  solanaRpcUrl: string;
  programId: PublicKey;
  port: number;
  merkleTreeHeight: number;
  // Relayer configuration
  relayerEnabled: boolean;
  relayerKeypair?: Keypair;
  altAddress?: PublicKey;
  minFeeLamports: number;
  maxComputeUnits: number;
}

function loadRelayerKeypair(): Keypair | undefined {
  const privateKeyStr = process.env.RELAYER_PRIVATE_KEY;
  
  if (!privateKeyStr) {
    return undefined;
  }

  try {
    const privateKeyArray = JSON.parse(privateKeyStr);
    return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch (error) {
    console.error('Failed to parse RELAYER_PRIVATE_KEY:', error);
    return undefined;
  }
}

export function loadConfig(): Config {
  const programIdStr = process.env.PROGRAM_ID;
  if (!programIdStr) {
    throw new Error("PROGRAM_ID environment variable is required. Please create a .env file with PROGRAM_ID=your_program_id");
  }

  const relayerKeypair = loadRelayerKeypair();
  const relayerEnabled = process.env.RELAYER_ENABLED === 'true' && !!relayerKeypair;

  if (relayerEnabled) {
    console.log(`Relayer enabled with address: ${relayerKeypair!.publicKey.toString()}`);
  }

  return {
    solanaRpcUrl: process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899",
    programId: new PublicKey(programIdStr),
    port: parseInt(process.env.PORT || "3000", 10),
    merkleTreeHeight: parseInt(process.env.MERKLE_TREE_HEIGHT || "26", 10),
    // Relayer configuration
    relayerEnabled,
    relayerKeypair,
    altAddress: process.env.ALT_ADDRESS ? new PublicKey(process.env.ALT_ADDRESS) : undefined,
    minFeeLamports: parseInt(process.env.MIN_FEE_LAMPORTS || "5000", 10),
    maxComputeUnits: parseInt(process.env.MAX_COMPUTE_UNITS || "1000000", 10),
  };
}


