/**
 * Utility functions for data conversion
 */

/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Buffer.from(bytes).toString("hex");
}

/**
 * Convert hex string to byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/**
 * Convert byte array to base58 string
 */
export function bytesToBase58(bytes: Uint8Array): string {
  const bs58 = require("bs58");
  return bs58.encode(bytes);
}

/**
 * Convert base58 string to byte array
 */
export function base58ToBytes(str: string): Uint8Array {
  const bs58 = require("bs58");
  return bs58.decode(str);
}

/**
 * Format commitment for display (show first and last few characters)
 */
export function formatCommitment(commitment: string, length: number = 8): string {
  if (commitment.length <= length * 2) {
    return commitment;
  }
  return `${commitment.substring(0, length)}...${commitment.substring(commitment.length - length)}`;
}

/**
 * Convert BN to string safely
 */
export function bnToString(bn: any): string {
  return bn.toString(10);
}



