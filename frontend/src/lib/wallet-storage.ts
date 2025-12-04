// Utility functions for managing wallet signatures in localStorage

const SIGNATURE_PREFIX = 'wallet_signature_';

/**
 * Check if we're running in the browser
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Save wallet signature to localStorage
 */
export function saveWalletSignature(walletAddress: string, signature: string): void {
  if (!isBrowser) return;
  localStorage.setItem(`${SIGNATURE_PREFIX}${walletAddress}`, signature);
}

/**
 * Get wallet signature from localStorage
 */
export function getWalletSignature(walletAddress: string): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(`${SIGNATURE_PREFIX}${walletAddress}`);
}

/**
 * Remove wallet signature from localStorage
 */
export function removeWalletSignature(walletAddress: string): void {
  if (!isBrowser) return;
  localStorage.removeItem(`${SIGNATURE_PREFIX}${walletAddress}`);
}

/**
 * Get all wallet signatures from localStorage
 */
export function getAllWalletSignatures(): Record<string, string> {
  if (!isBrowser) return {};
  
  const signatures: Record<string, string> = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SIGNATURE_PREFIX)) {
      const walletAddress = key.replace(SIGNATURE_PREFIX, '');
      const signature = localStorage.getItem(key);
      if (signature) {
        signatures[walletAddress] = signature;
      }
    }
  }
  
  return signatures;
}

/**
 * Clear all wallet signatures from localStorage
 */
export function clearAllWalletSignatures(): void {
  if (!isBrowser) return;
  
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SIGNATURE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

