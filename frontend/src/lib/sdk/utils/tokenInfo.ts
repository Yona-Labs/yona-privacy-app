'use client'
import { PublicKey, Connection } from '@solana/web3.js';
import BN from 'bn.js';
import { Buffer } from 'buffer';

// BN254 field size for ZK circuits
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

// Known token registry - mapping from PublicKey string to token metadata
export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Common tokens on Solana
export const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  'So11111111111111111111111111111111111111112': {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS': {
    address: 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
    symbol: 'ZEC',
    name: 'ZCash',
    decimals: 9,
  },
};

// Cache for field element to PublicKey mapping
const fieldElementCache: Map<string, string> = new Map();

/**
 * Converts a field element (string representation) back to a Solana PublicKey string
 * This is the reverse operation of publicKeyToFieldElement
 * 
 * Note: This conversion has limitations because field element is modulo FIELD_SIZE,
 * so we need to use a registry of known tokens.
 * 
 * @param fieldElement - The field element as a decimal string
 * @returns The Solana PublicKey as base58 string, or null if not found
 */
export function fieldElementToPublicKey(fieldElement: string): string | null {
  // Check cache first
  if (fieldElementCache.has(fieldElement)) {
    return fieldElementCache.get(fieldElement)!;
  }

  // Try to match against known tokens
  for (const [address, metadata] of Object.entries(KNOWN_TOKENS)) {
    const computedFieldElement = publicKeyToFieldElement(address);
    if (computedFieldElement === fieldElement) {
      fieldElementCache.set(fieldElement, address);
      return address;
    }
  }

  return null;
}

/**
 * Converts a Solana PublicKey to a numeric string representation for circuit inputs
 * (Same as in getExtDataHash.ts)
 */
export function publicKeyToFieldElement(publicKey: string | PublicKey): string {
  const pk = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
  const bytes = pk.toBytes();

  // Convert all 32 bytes to BigInt (big-endian)
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }

  return (value % FIELD_SIZE).toString();
}

/**
 * Registers a new token in the known tokens registry
 * Useful for adding tokens dynamically
 */
export function registerToken(metadata: TokenMetadata): void {
  KNOWN_TOKENS[metadata.address] = metadata;
  // Clear cache to force recomputation
  fieldElementCache.clear();
}

/**
 * Gets token metadata by PublicKey or field element
 * @param identifier - Either a PublicKey string, field element string, or PublicKey object
 * @returns Token metadata or default metadata for unknown tokens
 */
export function getTokenInfo(identifier: string | PublicKey): TokenMetadata {
  let address: string;

  // If it's a PublicKey object, convert to string
  if (identifier instanceof PublicKey) {
    address = identifier.toString();
  } else {
    address = identifier;
  }

  // Check if it's a known token address
  if (KNOWN_TOKENS[address]) {
    return KNOWN_TOKENS[address];
  }

  // Try to convert from field element
  const convertedAddress = fieldElementToPublicKey(address);
  if (convertedAddress && KNOWN_TOKENS[convertedAddress]) {
    return KNOWN_TOKENS[convertedAddress];
  }

  // Return default metadata for unknown token
  return {
    address: address,
    symbol: address.slice(0, 4).toUpperCase(),
    name: 'Unknown Token',
    decimals: 9, // Default to 9 decimals like SOL
  };
}


/**
 * Formats amount based on token decimals
 */
export function formatTokenAmount(amount: number | string, decimals: number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const divisor = Math.pow(10, decimals);
  const formatted = numAmount / divisor;
  
  // For very small numbers, use all available decimals
  // For larger numbers, use adaptive formatting
  if (Math.abs(formatted) < 0.01 || Math.abs(formatted) >= 1000) {
    return formatted.toFixed(decimals);
  }
  
  // Use adaptive decimals for middle-range numbers
  let adaptiveDecimals = decimals;
  if (Math.abs(formatted) >= 1) {
    adaptiveDecimals = Math.min(6, decimals);
  } else if (Math.abs(formatted) >= 0.1) {
    adaptiveDecimals = Math.min(8, decimals);
  }
  
  // Remove trailing zeros
  return parseFloat(formatted.toFixed(adaptiveDecimals)).toString();
}

/**
 * Finds a mint address from KNOWN_TOKENS where the first 4 bytes match the given value
 * This matches the encryption logic: takes first 4 chars of decimal string, converts to BN, then to 4 bytes
 * @param mintBnString - The decimal string representation from mintBn.toString()
 * @returns The matching mint address (PublicKey string) or null if not found
 */
export function findMintByFirst4Bytes(mintBnString: string): string | null {
  // Replicate encryption logic: take first 4 chars of decimal string, convert to BN, then to bytes
  const first4Chars = mintBnString.slice(0, 4);
  const mintBn = new BN(first4Chars);
  const mintBytes = mintBn.toArrayLike(Buffer, 'le', 4); // 4 bytes as in encryption
  const first4BytesValue = new BN(mintBytes, 'le');

  // Check each known token
  for (const [address, metadata] of Object.entries(KNOWN_TOKENS)) {
    try {
      // Convert token address to field element (decimal string), then replicate encryption logic
      const fieldElement = publicKeyToFieldElement(address);
      const tokenFirst4Chars = fieldElement.slice(0, 4);
      const tokenMintBn = new BN(tokenFirst4Chars);
      const tokenMintBytes = tokenMintBn.toArrayLike(Buffer, 'le', 4);
      const tokenFirst4BytesValue = new BN(tokenMintBytes, 'le');

      // Compare the first 4 bytes
      if (first4BytesValue.eq(tokenFirst4BytesValue)) {
        return address;
      }
    } catch (e) {
      // Skip invalid public keys or conversion errors
      continue;
    }
  }

  return null;
}


