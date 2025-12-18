/**
 * Jupiter API utilities for getting swap quotes
 */

import { VersionedTransaction, TransactionInstruction, PublicKey, AccountMeta } from '@solana/web3.js';
import { Buffer } from 'buffer';

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  priceImpactPct: string;
  routePlan: any[];
}

export interface JupiterInstructionAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface JupiterInstruction {
  programId: string;
  accounts: JupiterInstructionAccount[];
  data: string;
}

export interface JupiterSwapResponse {
  tokenLedgerInstruction: JupiterInstruction | null;
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction: JupiterInstruction | null;
  otherInstructions: JupiterInstruction[];
  addressLookupTableAddresses: string[];
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationType?: any;
  simulationSlot?: number;
  dynamicSlippageReport?: any;
  simulationError?: any;
  addressesByLookupTableAddress?: any;
}

/**
 * Get a quote from Jupiter API for token swap
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @param amount - Amount in smallest unit (lamports for SOL, smallest unit for SPL tokens)
 * @param slippageBps - Slippage in basis points (default: 30 = 0.3%)
 * @returns Promise with quote response
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 30
): Promise<JupiterQuoteResponse | null> {
  try {
    const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true&maxAccounts=14&excludeDexes=1DEX`;

    // console.log('Jupiter API Request:', {
    //   url,
    //   inputMint,
    //   outputMint,
    //   amount,
    //   slippageBps,
    //   timestamp: new Date().toISOString()
    // });

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Jupiter API error:', response.status, response.statusText);
      return null;
    }

    const quote = await response.json();
    return quote;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    return null;
  }
}

/**
 * Get swap transaction from Jupiter API
 * @param quoteResponse - Quote response from getJupiterQuote
 * @param userPublicKey - User's public key (wallet address)
 * @param prioritizationFeeLamports - Optional prioritization fee in lamports (default: 1000000)
 * @param priorityLevel - Priority level: "veryHigh" | "high" | "medium" | "low" (default: "veryHigh")
 * @returns Promise with swap response containing transaction
 */
export async function getJupiterSwapTransaction(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string,
  prioritizationFeeLamports: number = 1000000,
  priorityLevel: "veryHigh" | "high" | "medium" | "low" = "veryHigh"
): Promise<JupiterSwapResponse> {
  try {
    const url = 'https://lite-api.jup.ag/swap/v1/swap-instructions';

    const requestBody = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: false,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: prioritizationFeeLamports,
          priorityLevel: priorityLevel
        }
      }
    };

    // console.log('Jupiter Swap API Request:', {
    //   url,
    //   userPublicKey,
    //   prioritizationFeeLamports,
    //   priorityLevel,
    //   timestamp: new Date().toISOString()
    // });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Jupiter Swap API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error('Jupiter Swap API error');
    }

    const swapResponse = await response.json();

    if (!swapResponse.swapInstruction) {
      console.error('Swap response missing swapInstruction');
      throw new Error('Swap response missing swapInstruction');
    }

    return swapResponse;
  } catch (error) {
    console.error('Error fetching Jupiter swap transaction:', error);
    throw error;
  }
}

/**
 * Extract swap instruction from Jupiter API response
 * @param swapResponse - Jupiter swap response
 * @returns TransactionInstruction object
 */
export function extractJupiterSwapInstruction(swapResponse: JupiterSwapResponse): TransactionInstruction {
  const swapIx = swapResponse.swapInstruction;

  const accounts: AccountMeta[] = swapIx.accounts.map(acc => ({
    pubkey: new PublicKey(acc.pubkey),
    isSigner: acc.isSigner,
    isWritable: acc.isWritable,
  }));

  const data = Buffer.from(swapIx.data, 'base64');

  return new TransactionInstruction({
    programId: new PublicKey(swapIx.programId),
    keys: accounts,
    data: data,
  });
}

/**
 * Extract all instructions from Jupiter API response
 * @param swapResponse - Jupiter swap response
 * @returns Array of TransactionInstruction objects in order: computeBudget, setup, swap, cleanup
 */
export function extractJupiterInstructions(swapResponse: JupiterSwapResponse): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];

  // Add compute budget instructions
  for (const computeIx of swapResponse.computeBudgetInstructions) {
    const accounts: AccountMeta[] = computeIx.accounts.map(acc => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    }));

    instructions.push(new TransactionInstruction({
      programId: new PublicKey(computeIx.programId),
      keys: accounts,
      data: Buffer.from(computeIx.data, 'base64'),
    }));
  }

  // Add setup instructions
  for (const setupIx of swapResponse.setupInstructions) {
    const accounts: AccountMeta[] = setupIx.accounts.map(acc => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    }));

    instructions.push(new TransactionInstruction({
      programId: new PublicKey(setupIx.programId),
      keys: accounts,
      data: Buffer.from(setupIx.data, 'base64'),
    }));
  }

  // Add swap instruction
  instructions.push(extractJupiterSwapInstruction(swapResponse));

  // Add cleanup instruction if present
  if (swapResponse.cleanupInstruction) {
    const cleanupIx = swapResponse.cleanupInstruction;
    const accounts: AccountMeta[] = cleanupIx.accounts.map(acc => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    }));

    instructions.push(new TransactionInstruction({
      programId: new PublicKey(cleanupIx.programId),
      keys: accounts,
      data: Buffer.from(cleanupIx.data, 'base64'),
    }));
  }

  // Add other instructions if present
  for (const otherIx of swapResponse.otherInstructions) {
    const accounts: AccountMeta[] = otherIx.accounts.map(acc => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    }));

    instructions.push(new TransactionInstruction({
      programId: new PublicKey(otherIx.programId),
      keys: accounts,
      data: Buffer.from(otherIx.data, 'base64'),
    }));
  }

  return instructions;
}
