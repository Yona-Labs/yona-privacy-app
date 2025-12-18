import { Buffer } from 'buffer';
import bs58 from 'bs58';

// Event type interfaces
export interface CommitmentDataEvent {
  index: bigint;           // 8 bytes - u64
  commitment0: string;     // 32 bytes - [u8; 32] as decimal string (field element)
  commitment1?: string;    // 32 bytes - [u8; 32] as decimal string (field element) - optional for old format
  encryptedOutput: string; // variable length - bytes as hex string
  isOldFormat?: boolean;  // true if this is old format with single commitment
}

// Event discriminators from IDL
const EVENT_DISCRIMINATORS = {
  CommitmentData: Buffer.from([13, 110, 215, 127, 244, 62, 234, 34]),
} as const;

type EventType = keyof typeof EVENT_DISCRIMINATORS;

export type ParsedEvent =
  | { type: 'CommitmentData'; data: CommitmentDataEvent; signature?: string };

// Helper function to read Borsh-encoded bytes (length-prefixed)
function readBorshBytes(buffer: Buffer, offset: number): { value: Buffer; newOffset: number } {
  const length = buffer.readUInt32LE(offset);
  const value = buffer.subarray(offset + 4, offset + 4 + length);
  return { value, newOffset: offset + 4 + length };
}

// Layout decoders
function decodeCommitmentDataEvent(payload: Buffer): CommitmentDataEvent {
  let offset = 0;
  
  // Read index (u64)
  const index = payload.readBigUInt64LE(offset);
  offset += 8;
  
  // Determine format: old format has only one commitment (8 + 32 = 40 bytes before encrypted_output)
  // New format has two commitments (8 + 32 + 32 = 72 bytes before encrypted_output)
  // Try to read encrypted_output length from both possible positions
  let isOldFormat = false;
  
  if (payload.length >= offset + 32 + 4) {
    // Try reading encrypted_output length from position after first commitment
    const encryptedOutputLength1 = payload.readUInt32LE(offset + 32);
    const expectedSizeOld = offset + 32 + 4 + encryptedOutputLength1;
    
    // Try reading encrypted_output length from position after second commitment (if exists)
    if (payload.length >= offset + 32 + 32 + 4) {
      const encryptedOutputLength2 = payload.readUInt32LE(offset + 32 + 32);
      const expectedSizeNew = offset + 32 + 32 + 4 + encryptedOutputLength2;
      
      // Determine format based on which expected size matches actual payload size better
      const diffOld = Math.abs(payload.length - expectedSizeOld);
      const diffNew = Math.abs(payload.length - expectedSizeNew);
      
      isOldFormat = diffOld < diffNew;
    } else {
      // Not enough bytes for new format
      isOldFormat = true;
    }
  } else {
    // Not enough bytes even for old format
    throw new Error(`Invalid payload size: ${payload.length} bytes`);
  }
  
  console.log(`Payload length: ${payload.length}, detected format: ${isOldFormat ? 'old (single commitment)' : 'new (two commitments)'}`);
  
  // Read commitment0 ([u8; 32]) - this is a field element in big-endian format
  const commitment0Bytes = payload.subarray(offset, offset + 32);
  console.log(`Commitment0 bytes (hex): ${commitment0Bytes.toString('hex')}`);
  const commitment0 = bytesToFieldElement(commitment0Bytes);
  console.log(`Decoded commitment0: ${commitment0} (length: ${commitment0.length})`);
  offset += 32;
  
  let commitment1: string | undefined;
  
  if (!isOldFormat) {
    // Read commitment1 ([u8; 32]) - this is a field element in big-endian format
    const commitment1Bytes = payload.subarray(offset, offset + 32);
    console.log(`Commitment1 bytes (hex): ${commitment1Bytes.toString('hex')}`);
    commitment1 = bytesToFieldElement(commitment1Bytes);
    console.log(`Decoded commitment1: ${commitment1} (length: ${commitment1.length})`);
    offset += 32;
  } else {
    console.log(`Old format detected: only one commitment in event`);
  }
  
  // Read encrypted_output (Borsh-encoded bytes)
  const { value: encryptedOutputBytes } = readBorshBytes(payload, offset);
  const encryptedOutput = bufferToHex(encryptedOutputBytes);
  console.log(`Encrypted output (hex): ${encryptedOutput.substring(0, 32)}... (length: ${encryptedOutput.length})`);
  
  return {
    index,
    commitment0,
    commitment1,
    encryptedOutput,
    isOldFormat,
  };
}

// Helper function to convert 32 bytes (big-endian) to field element string
function bytesToFieldElement(bytes: Buffer): string {
  // Read as big-endian BigInt (as per Rust comment: "all public inputs needs to be in big endian format")
  let value = 0n;
  for (let i = 0; i < 32; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value.toString();
}

/**
 * Decode event from base64 data
 */
export function decodeEvent(base64Data: string, signature?: string): ParsedEvent | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 8) {
      return null;
    }
    
    // Event discriminator is first 8 bytes
    const discriminator = buffer.subarray(0, 8);
    const payload = buffer.subarray(8);
    
    console.log(`Discriminator: [${discriminator.join(', ')}], payload length: ${payload.length}`);
    
    // Find matching event type
    for (const [eventType, expectedDiscriminator] of Object.entries(EVENT_DISCRIMINATORS)) {
      if (discriminator.equals(expectedDiscriminator)) {
        console.log(`Found matching event type: ${eventType}`);
        
        try {
          let decodedData: any;
          
          switch (eventType) {
            case 'CommitmentData':
              decodedData = decodeCommitmentDataEvent(payload);
              break;
            default:
              return null;
          }
          
          return {
            type: eventType as EventType,
            data: decodedData,
            signature,
          } as ParsedEvent;
        } catch (error) {
          console.error(`Error decoding ${eventType}:`, error);
          return null;
        }
      }
    }
    
    console.log(`No matching discriminator found for: [${discriminator.join(', ')}]`);
    return null;
  } catch (error) {
    console.error('Error decoding event:', error);
    return null;
  }
}

export function bufferToBase58(buffer: Buffer): string {
  return bs58.encode(buffer);
}

export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

