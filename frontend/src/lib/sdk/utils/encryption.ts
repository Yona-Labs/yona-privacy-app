// import { WasmFactory } from '@lightprotocol/hasher.rs';
import { PublicKey } from "@solana/web3.js";
import { Keypair as UtxoKeypair } from "../models/keypair";
import { Utxo } from "../models/utxo";
import { ctr } from "@noble/ciphers/aes"; 
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { Buffer } from "buffer";

import BN from "bn.js";
import { findMintByFirst4Bytes } from "./tokenInfo";


// Custom timingSafeEqual for browser compatibility
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Service for handling encryption and decryption of UTXO data
 */
export class EncryptionService {
  private encryptionKey: Uint8Array | null = null;

  /**
   * Initialize the encryption service with an encryption key
   * @param encryptionKey The encryption key to use for encryption and decryption
   */
  constructor(encryptionKey?: Uint8Array) {
    if (encryptionKey) {
      this.encryptionKey = encryptionKey;
    }
  }

  /**
   * Set the encryption key directly
   * @param encryptionKey The encryption key to set
   */
  public setEncryptionKey(encryptionKey: Uint8Array): void {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Generate an encryption key from a signature
   * @param signature The user's signature
   * @returns The generated encryption key
   */
  public deriveEncryptionKeyFromSignature(signature: Uint8Array): Uint8Array {
    // Extract the first 31 bytes of the signature to create a deterministic key
    const encryptionKey = signature.slice(0, 31);

    // Store the key in the service
    this.encryptionKey = encryptionKey;

    return encryptionKey;
  }

  /**
   * Encrypt data with the stored encryption key
   * @param data The data to encrypt
   * @returns The encrypted data as a Uint8Array
   * @throws Error if the encryption key has not been generated
   */
  public encrypt(data: Uint8Array | string): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error(
        "Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first."
      );
    }

    // Convert string to Uint8Array if needed
    const dataUint8Array =
      typeof data === "string" ? new TextEncoder().encode(data) : data;

    // Generate a standard initialization vector (16 bytes)
    const iv = randomBytes(16);

    // Create a key from our encryption key (using only first 16 bytes for AES-128)
    const key = this.encryptionKey.slice(0, 16);

    // Use AES-128-CTR from @noble/ciphers/aes
    const encryptedData = ctr(key, iv).encrypt(dataUint8Array);

    // Create an authentication tag (HMAC) to verify decryption with correct key
    const hmacKey = this.encryptionKey.slice(16, 31);
    const hmacHasher = hmac.create(sha256, hmacKey);
    hmacHasher.update(iv);
    hmacHasher.update(encryptedData);
    const authTag = hmacHasher.digest().slice(0, 16); // Use first 16 bytes of HMAC as auth tag

    // Combine IV, auth tag and encrypted data
    const combined = new Uint8Array(
      iv.length + authTag.length + encryptedData.length
    );
    combined.set(iv, 0);
    combined.set(authTag, iv.length);
    combined.set(encryptedData, iv.length + authTag.length);

    return combined;
  }

  /**
   * Decrypt data with the stored encryption key
   * @param encryptedData The encrypted data to decrypt
   * @returns The decrypted data as a Uint8Array
   * @throws Error if the encryption key has not been generated or if the wrong key is used
   */
  public decrypt(encryptedData: Uint8Array): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error(
        "Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first."
      );
    }

    // Extract the IV from the first 16 bytes
    const iv = encryptedData.slice(0, 16);
    // Extract the auth tag from the next 16 bytes
    const authTag = encryptedData.slice(16, 32);
    // The rest is the actual encrypted data
    const data = encryptedData.slice(32);

    // Verify the authentication tag
    const hmacKey = this.encryptionKey.slice(16, 31);
    const hmacHasher = hmac.create(sha256, hmacKey);
    hmacHasher.update(iv);
    hmacHasher.update(data);
    const calculatedTag = hmacHasher.digest().slice(0, 16);

    // Compare tags - if they don't match, the key is wrong
    if (!timingSafeEqual(authTag, calculatedTag)) {
      throw new Error(
        "Failed to decrypt data. Invalid encryption key or corrupted data."
      );
    }

    // Create a key from our encryption key (using only first 16 bytes for AES-128)
    const key = this.encryptionKey.slice(0, 16);

    try {
      // Use the same algorithm as in encrypt from @noble/ciphers/aes
      return ctr(key, iv).decrypt(data);
    } catch (error) {
      throw new Error(
        "Failed to decrypt data. Invalid encryption key or corrupted data."
      );
    }
  }

  public encryptUtxos(utxos: Utxo[]): Uint8Array {
    if (!this.encryptionKey)
      throw new Error(
        "Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first."
      );
    
    const data = Buffer.concat(utxos.map((utxo) => {
      const amountBytes = utxo.amount.toArrayLike(Buffer, "le", 8); // u64: 8 bytes
      const blindingBytes = utxo.blinding.toArrayLike(Buffer, "le", 4); // u32: 4 bytes
      const indexBytes = new BN(utxo.index).toArrayLike(Buffer, "le", 4); // u32: 4 bytes
      const mintBn = new BN(utxo.mintAddress.slice(0, 4)); // Parse the decimal string to BN
      const mintBytes = mintBn.toArrayLike(Buffer, "le", 4); // 4 bytes for BN254 field element  

      return Buffer.concat([amountBytes, blindingBytes, indexBytes, mintBytes]);
    }));
    return this.encrypt(data);
  }

  /**
   * Decrypt an encrypted UTXO and parse it to a Utxo instance
   * @param encryptedData The encrypted UTXO data
   * @param keypair The UTXO keypair to use for the decrypted UTXO
   * @param lightWasm Optional LightWasm instance. If not provided, a new one will be created
   * @returns Promise resolving to the decrypted Utxo instance
   * @throws Error if the encryption key has not been set or if decryption fails
   */
  public async decryptUtxos(
    encryptedData: Uint8Array | string,
    keypair: UtxoKeypair,
    lightWasm?: any
  ): Promise<Utxo[]> {

    if (!this.encryptionKey) {
      throw new Error(
        "Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first."
      );
    }

    const utxos: Utxo[] = [];

    const encryptedUint8Array =
      typeof encryptedData === "string"
        ? Uint8Array.from(Buffer.from(encryptedData, "hex"))
        : encryptedData;

    const decrypted = this.decrypt(encryptedUint8Array);
    
    // Each UTXO is 20 bytes (8 amount + 4 blinding + 4 index + 4 mintAddress)
    // Support 1 or 2 UTXOs per encrypted output (20 or 40 bytes)
    if (decrypted.length !== 40) {
      throw new Error(`Invalid decrypted data length: ${decrypted.length} (expected 20 or 40 bytes)`);
    }
    
    for (let i = 0; i < decrypted.length; i += 20) {
      const amount = new BN(decrypted.slice(i, i + 8), "le");
      const blinding = new BN(decrypted.slice(i + 8, i + 12), "le");
      const index = Number(new BN(decrypted.slice(i + 12, i + 16), "le"));
      const mintBn = new BN(decrypted.slice(i + 16, i + 20), "le");
      const mintAddress = mintBn.toString();
      utxos.push(new Utxo({
        lightWasm,
        amount,
        blinding,
        keypair,
        index,
        mintAddress: findMintByFirst4Bytes(mintAddress) || '',
      }));
    }

    return utxos;
  }

  /**
   * Derive a deterministic UTXO private key from the wallet's encryption key
   * @returns A private key in hex format that can be used to create a UTXO keypair
   * @throws Error if the encryption key has not been set
   */
  public deriveUtxoPrivateKey(): string {
    if (!this.encryptionKey) {
      throw new Error(
        "Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first."
      );
    }

    // Use a hash function to generate a deterministic private key from the encryption key
    const hashedSeed = sha256(this.encryptionKey);

    // Convert to a hex string compatible with ethers.js private key format
    return (
      "0x" +
      Array.from(hashedSeed)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
}
