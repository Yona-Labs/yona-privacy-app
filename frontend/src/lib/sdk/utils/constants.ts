"use client";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { Buffer } from "buffer";

export const FIELD_SIZE = new BN(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

export const PROGRAM_ID = new PublicKey(
  "6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx"
);

export const DEPLOYER_ID = new PublicKey(
  "AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM"
);

export const FEE_RECIPIENT = new PublicKey(
  "BySnWGpuT4KfXoeWTmraKCFitzfne4du1ZkpnTWGxTzv"
);

export const FETCH_UTXOS_GROUP_SIZE = 50;

export const TRANSACT_IX_DISCRIMINATOR = Buffer.from([
  217, 149, 130, 143, 221, 52, 252, 119,
]);
export const CIRCUIT_PATH = "/transaction2";

export const MERKLE_TREE_DEPTH = 26;

export const DEPOSIT_FEE_RATE = 0;

export const WITHDRAW_FEE_RATE = 25 / 10000;

export const ALT_ADDRESS = new PublicKey(
  "BrdQhL9oucksSyXNXnM5xdbCy5LGi2rpmpsPfDwDdKFP"
);

export const INDEXER_API_URL =
  import.meta.env.VITE_INDEXER_URL || "http://localhost:3001";

export const LSK_FETCH_OFFSET = "fetch_offset";
export const LSK_ENCRYPTED_OUTPUTS = "encrypted_outputs";
