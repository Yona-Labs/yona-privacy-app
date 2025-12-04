import { PublicKey } from "@solana/web3.js";
import { LSK_ENCRYPTED_OUTPUTS, LSK_FETCH_OFFSET, PROGRAM_ID } from "@/lib/sdk";

/**
 * Generate localStorage key for a given public key
 */
export function getStorageKey(publicKey: PublicKey): string {
  return PROGRAM_ID.toString().substring(0, 6) + publicKey.toString();
}

/**
 * Clear all SDK-related data from localStorage for a specific wallet
 */
export function clearWalletStorage(publicKey: PublicKey | string): void {
  if (typeof window === "undefined") return;

  const pubKey =
    typeof publicKey === "string" ? publicKey : publicKey.toString();
  const storageKey = PROGRAM_ID.toString().substring(0, 6) + pubKey;

  // Clear UTXO cache
  localStorage.removeItem(LSK_FETCH_OFFSET + storageKey);
  localStorage.removeItem(LSK_ENCRYPTED_OUTPUTS + storageKey);

  // Clear trade history

  // Clear wallet signature (using the same key as wallet-button.tsx)
  const walletSignatureKey = `wallet_signature_${pubKey}`;
  localStorage.removeItem(walletSignatureKey);
}

/**
 * Get all SDK storage keys (for debugging)
 */
export function listSDKStorageKeys(): string[] {
  if (typeof window === "undefined") return [];

  const sdkKeys: string[] = [];
  const programIdPrefix = PROGRAM_ID.toString().substring(0, 6);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.includes(programIdPrefix) ||
        key.startsWith("wallet_signature_") ||
        key.startsWith("tradeHistory"))
    ) {
      sdkKeys.push(key);
    }
  }

  return sdkKeys;
}
