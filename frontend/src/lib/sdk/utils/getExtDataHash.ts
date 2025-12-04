/**
 * Utility functions for ZK Cash
 *
 * Provides common utility functions for the ZK Cash system
 * Based on: https://github.com/tornadocash/tornado-nova
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as borsh from "borsh";
import { sha256 } from "ethers";
import { Utxo } from "@/lib/sdk/models/utxo";



// BN254 field size for ZK circuits
const FIELD_SIZE = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

/**
 * Converts a Solana PublicKey to a numeric string representation for circuit inputs
 * Converts all 32 bytes to BigInt and takes modulo FIELD_SIZE to fit in BN254 field
 * @param publicKey - The Solana PublicKey (base58 encoded string or PublicKey object)
 * @returns A decimal string representation that fits in BN254 field
 */
export function publicKeyToFieldElement(publicKey: string | PublicKey): string {
  const pk =
    typeof publicKey === "string" ? new PublicKey(publicKey) : publicKey;
  const bytes = pk.toBytes();

  // Convert all 32 bytes to BigInt (big-endian)
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  // Take modulo to ensure it fits in BN254 field

  return (value % FIELD_SIZE).toString();
}

/**
 * Calculates the hash of ext data using Borsh serialization
 * @param extData External data object containing recipient, amount, encrypted outputs, fee, fee recipient, and mint address
 * @returns The hash as a Uint8Array (32 bytes)
 */
export function getExtDataHash(extData: {
  recipient: string | PublicKey;
  extAmount: string | number | BN;
  encryptedOutput: string | Uint8Array; // Optional for Account Data Separation
  fee: string | number | BN;
  feeRecipient: string | PublicKey;
  mintAddressA: string | PublicKey;
  mintAddressB: string | PublicKey;
}): Uint8Array {
  // Convert all inputs to their appropriate types
  const recipient =
    extData.recipient instanceof PublicKey
      ? extData.recipient
      : new PublicKey(extData.recipient);

  const feeRecipient =
    extData.feeRecipient instanceof PublicKey
      ? extData.feeRecipient
      : new PublicKey(extData.feeRecipient);

  const mintAddressA =
    extData.mintAddressA instanceof PublicKey
      ? extData.mintAddressA
      : new PublicKey(extData.mintAddressA);
  const mintAddressB =
    extData.mintAddressB instanceof PublicKey
      ? extData.mintAddressB
      : new PublicKey(extData.mintAddressB);
  // Convert to BN for proper i64/u64 handling
  const extAmount = new BN(extData.extAmount.toString());
  const fee = new BN(extData.fee.toString());

  // Handle encrypted outputs - they might not be present in Account Data Separation approach
  const encryptedOutput = extData.encryptedOutput
    ? Buffer.from(extData.encryptedOutput as any)
    : Buffer.alloc(0); // Empty buffer if not provided

  // Define the borsh schema matching the Rust struct
  const schema = {
    struct: {
      recipient: { array: { type: "u8", len: 32 } },
      extAmount: "i64",
      encryptedOutput: { array: { type: "u8" } },
      fee: "u64",
      feeRecipient: { array: { type: "u8", len: 32 } },
      mintAddressA: { array: { type: "u8", len: 32 } },
      mintAddressB: { array: { type: "u8", len: 32 } },
    },
  };

  const value = {
    recipient: recipient.toBytes(),
    extAmount: extAmount, // BN instance - Borsh handles it correctly with i64 type
    encryptedOutput: encryptedOutput,
    fee: fee, // BN instance - Borsh handles it correctly with u64 type
    feeRecipient: feeRecipient.toBytes(),
    mintAddressA: mintAddressA.toBytes(),
    mintAddressB: mintAddressB.toBytes(),
  };
  console.log("value: ", value);
  // Serialize with Borsh
  const serializedData = borsh.serialize(schema, value);
  // Calculate the SHA-256 hash
  const hashHex = sha256(serializedData);
  // Convert from hex string to Uint8Array
  return Buffer.from(hashHex.slice(2), "hex");
}

/**
 * Calculates the hash of ext data using Borsh serialization
 * @param extData External data object containing recipient, amount, encrypted outputs, fee, fee recipient, and mint address
 * @returns The hash as a Uint8Array (32 bytes)
 */
export function getSwapExtDataHash(extData: {
  extAmount: string | number | BN;
  extMinAmountOut: string | number | BN;
  encryptedOutput: string | Uint8Array; // Optional for Account Data Separation
  fee: string | number | BN;
  feeRecipient: string | PublicKey;
  mintAddressA: string | PublicKey;
  mintAddressB: string | PublicKey;
}): Uint8Array {
  // Convert all inputs to their appropriate types
  const feeRecipient =
    extData.feeRecipient instanceof PublicKey
      ? extData.feeRecipient
      : new PublicKey(extData.feeRecipient);

  const mintAddressA =
    extData.mintAddressA instanceof PublicKey
      ? extData.mintAddressA
      : new PublicKey(extData.mintAddressA);
  const mintAddressB =
    extData.mintAddressB instanceof PublicKey
      ? extData.mintAddressB
      : new PublicKey(extData.mintAddressB);
  // Convert to BN for proper i64/u64 handling
  const extAmount = new BN(extData.extAmount.toString());
  const extMinAmountOut = new BN(extData.extMinAmountOut.toString());
  const fee = new BN(extData.fee.toString());

  // Handle encrypted outputs - they might not be present in Account Data Separation approach
  const encryptedOutput = extData.encryptedOutput
    ? Buffer.from(extData.encryptedOutput as any)
    : Buffer.alloc(0); // Empty buffer if not provided

  // Define the borsh schema matching the Rust struct
  const schema = {
    struct: {
      extAmount: "i64",
      extMinAmountOut: "i64",
      encryptedOutput: { array: { type: "u8" } },
      fee: "u64",
      feeRecipient: { array: { type: "u8", len: 32 } },
      mintAddressA: { array: { type: "u8", len: 32 } },
      mintAddressB: { array: { type: "u8", len: 32 } },
    },
  };

  const value = {
    extAmount: extAmount, // BN instance - Borsh handles it correctly with i64 type
    extMinAmountOut: extMinAmountOut, // BN instance - Borsh handles it correctly with i64 type
    encryptedOutput: encryptedOutput,
    fee: fee, // BN instance - Borsh handles it correctly with u64 type
    feeRecipient: feeRecipient.toBytes(),
    mintAddressA: mintAddressA.toBytes(),
    mintAddressB: mintAddressB.toBytes(),
  };
  console.log("value: ", value);
  // Serialize with Borsh
  const serializedData = borsh.serialize(schema, value);
  // Calculate the SHA-256 hash
  const hashHex = sha256(serializedData);
  // Convert from hex string to Uint8Array
  return Buffer.from(hashHex.slice(2), "hex");
}
