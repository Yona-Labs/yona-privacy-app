import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
  AccountMeta,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { Config } from './config';
import IDL from './zkcash.json';
import { findMerkleTreePDA, findGlobalConfigPDA, findNullifierPDAs } from './lib/derive';

export interface WithdrawRequest {
  proof: {
    proofA: number[];
    proofB: number[];
    proofC: number[];
    root: number[];
    publicAmount0: number[];
    publicAmount1: number[];
    extDataHash: number[];
    inputNullifiers: number[][];
    outputCommitments: number[][];
  };
  extDataMinified: {
    extAmount: string;
    fee: string;
  };
  encryptedOutput: number[];
  recipient: string;
  feeRecipient: string;
  inputMint: string;
}

export interface SwapRequest {
  proof: {
    proofA: number[];
    proofB: number[];
    proofC: number[];
    root: number[];
    publicAmount0: number[];
    publicAmount1: number[];
    extDataHash: number[];
    inputNullifiers: number[][];
    outputCommitments: number[][];
  };
  swapExtDataMinified: {
    extAmount: string;
    extMinAmountOut: string;
    fee: string;
  };
  encryptedOutput: number[];
  feeRecipient: string;
  inputMint: string;
  outputMint: string;
  jupiterSwapData: string; // base64 encoded
  jupiterRemainingAccounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  addressLookupTableAddresses: string[];
}

export interface WithdrawResponse {
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
}

export interface SwapResponse {
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
}


/**
 * Build withdraw instruction using Anchor
 */
async function buildWithdrawInstruction(
  program: Program,
  request: WithdrawRequest,
  relayerPubkey: PublicKey,
  config: Config
) {
  const inputMint = new PublicKey(request.inputMint);
  const recipient = new PublicKey(request.recipient);
  const feeRecipient = new PublicKey(request.feeRecipient);

  // Find all required PDAs
  const [treeAccount] = findMerkleTreePDA(config.programId);
  const [globalConfig] = findGlobalConfigPDA(config.programId);
  const { nullifier0, nullifier1 } = findNullifierPDAs(config.programId, request.proof);

  // Get token accounts
  const reserveTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    globalConfig,
    true
  );

  // For WSOL, use relayer's token account (will be closed and SOL sent to recipient)
  // For other tokens, use recipient's token account directly
  const isNativeSOL = inputMint.equals(NATIVE_MINT);
  const recipientTokenAccount = isNativeSOL
    ? getAssociatedTokenAddressSync(inputMint, relayerPubkey, true)
    : getAssociatedTokenAddressSync(inputMint, recipient, true);
  // Convert proof and extData to proper format
  const proof = {
    proofA: request.proof.proofA,
    proofB: request.proof.proofB,
    proofC: request.proof.proofC,
    root: request.proof.root,
    publicAmount0: request.proof.publicAmount0,
    publicAmount1: request.proof.publicAmount1,
    extDataHash: request.proof.extDataHash,
    inputNullifiers: request.proof.inputNullifiers,
    outputCommitments: request.proof.outputCommitments,
  };

  const extDataMinified = {
    extAmount: new BN(request.extDataMinified.extAmount),
    fee: new BN(request.extDataMinified.fee),
  };

  // Build the instruction
  const instruction = await program.methods
    .withdraw(
      proof,
      extDataMinified,
      Buffer.from(request.encryptedOutput),
    )
    .accounts({
      treeAccount,
      nullifier0,
      nullifier1,
      globalConfig,
      inputMint,
      reserveTokenAccount,
      recipient,
      recipientTokenAccount,
      feeRecipientAccount: feeRecipient,
      relayer: relayerPubkey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return instruction;
}

/**
 * Process withdrawal request
 */
export async function handleWithdraw(
  request: WithdrawRequest,
  config: Config
): Promise<WithdrawResponse> {
  if (!config.relayerEnabled || !config.relayerKeypair) {
    return {
      success: false,
      error: 'Relayer is not enabled on this server',
    };
  }

  try {
    console.log('Processing withdrawal request:', {
      recipient: request.recipient,
      inputMint: request.inputMint,
      extAmount: request.extDataMinified.extAmount,
      fee: request.extDataMinified.fee,
    });

    // Setup connection and program
    const connection = new Connection(config.solanaRpcUrl, 'confirmed');
    const wallet = new Wallet(config.relayerKeypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    const program = new Program(IDL as any, provider);

    // Validate fee
    const fee = new BN(request.extDataMinified.fee);
    if (fee.lt(new BN(config.minFeeLamports))) {
      return {
        success: false,
        error: `Fee too low. Minimum fee is ${config.minFeeLamports} lamports`,
      };
    }

    // Check if we need to create token accounts and prepare instructions
    const inputMint = new PublicKey(request.inputMint);
    const recipient = new PublicKey(request.recipient);
    const isNativeSOL = inputMint.equals(NATIVE_MINT);

    const instructions = [];
    
    if (isNativeSOL) {
      // For WSOL withdrawals, create relayer's token account if it doesn't exist
      const relayerTokenAccount = getAssociatedTokenAddressSync(
        inputMint,
        config.relayerKeypair.publicKey,
        true
      );

      try {
        console.log('Checking relayer WSOL token account:', relayerTokenAccount.toString());
        await getAccount(connection, relayerTokenAccount);
        console.log('Relayer WSOL token account already exists');
      } catch (error) {
        console.log('Relayer WSOL token account does not exist, will create in same transaction');
        const createAccountIx = createAssociatedTokenAccountInstruction(
          config.relayerKeypair.publicKey, // payer
          relayerTokenAccount, // ata
          config.relayerKeypair.publicKey, // owner
          inputMint // mint
        );
        instructions.push(createAccountIx);
      }
    } else {
      // For regular token withdrawals, create recipient's token account if it doesn't exist
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        inputMint,
        recipient,
        true
      );

      try {
        console.log('Checking recipient token account:', recipientTokenAccount.toString());
        await getAccount(connection, recipientTokenAccount);
        console.log('Recipient token account already exists');
      } catch (error) {
        console.log('Recipient token account does not exist, will create in same transaction');
        const createAccountIx = createAssociatedTokenAccountInstruction(
          config.relayerKeypair.publicKey, // payer (relayer pays for account creation)
          recipientTokenAccount, // ata
          recipient, // owner
          inputMint // mint
        );
        instructions.push(createAccountIx);
      }
    }

    // Build withdraw instruction
    const withdrawInstruction = await buildWithdrawInstruction(
      program,
      request,
      config.relayerKeypair.publicKey,
      config
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Build versioned transaction
    let lookupTableAccounts = [];
    if (config.altAddress) {
      const lookupTableAccount = await connection.getAddressLookupTable(config.altAddress);
      if (lookupTableAccount.value) {
        lookupTableAccounts.push(lookupTableAccount.value);
      }
    }

    // Add compute budget and withdraw instruction
    instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: config.maxComputeUnits }));
    instructions.push(withdrawInstruction);

    const message = new TransactionMessage({
      payerKey: config.relayerKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message(lookupTableAccounts);

    const transaction = new VersionedTransaction(message);

    // Sign transaction
    transaction.sign([config.relayerKeypair]);

    console.log('Sending withdraw transaction...');

    // Send transaction
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log('Withdraw transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        signature,
      };
    }

    console.log('Transaction confirmed:', signature);

    return {
      success: true,
      signature,
      message: 'Withdrawal processed successfully',
    };
  } catch (error: any) {
    console.error('Error processing withdrawal:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Build swap instruction using Anchor
 */
async function buildSwapInstruction(
  program: Program,
  request: SwapRequest,
  relayerPubkey: PublicKey,
  config: Config
) {
  const inputMint = new PublicKey(request.inputMint);
  const outputMint = new PublicKey(request.outputMint);
  const feeRecipient = new PublicKey(request.feeRecipient);

  // Find all required PDAs
  const [treeAccount] = findMerkleTreePDA(config.programId);
  const [globalConfig] = findGlobalConfigPDA(config.programId);
  const { nullifier0, nullifier1 } = findNullifierPDAs(config.programId, request.proof);

  // Get reserve token accounts for both mints
  const reserveTokenAccountInput = getAssociatedTokenAddressSync(
    inputMint,
    globalConfig,
    true
  );
  const reserveTokenAccountOutput = getAssociatedTokenAddressSync(
    outputMint,
    globalConfig,
    true
  );

  // Convert proof and swapExtData to proper format
  const proof = {
    proofA: request.proof.proofA,
    proofB: request.proof.proofB,
    proofC: request.proof.proofC,
    root: request.proof.root,
    publicAmount0: request.proof.publicAmount0,
    publicAmount1: request.proof.publicAmount1,
    extDataHash: request.proof.extDataHash,
    inputNullifiers: request.proof.inputNullifiers,
    outputCommitments: request.proof.outputCommitments,
  };

  const swapExtDataMinified = {
    extAmount: new BN(request.swapExtDataMinified.extAmount),
    extMinAmountOut: new BN(request.swapExtDataMinified.extMinAmountOut),
    fee: new BN(request.swapExtDataMinified.fee),
  };

  // Decode Jupiter swap data from base64
  const jupiterSwapData = Buffer.from(request.jupiterSwapData, 'base64');

  // Convert remaining accounts
  const jupiterRemainingAccounts: AccountMeta[] = request.jupiterRemainingAccounts.map(acc => ({
    pubkey: new PublicKey(acc.pubkey),
    isSigner: acc.pubkey === globalConfig.toString() ? false : acc.isSigner,
    isWritable: acc.isWritable,
  }));

  // Jupiter program ID
  const jupiterProgramId = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

  // Build the instruction
  let instructionBuilder = program.methods
    .swap(
      proof,
      swapExtDataMinified,
      Buffer.from(request.encryptedOutput),
      jupiterSwapData
    )
    .accounts({
      treeAccount,
      nullifier0,
      nullifier1,
      globalConfig,
      inputMint,
      outputMint,
      reserveTokenAccountInput,
      reserveTokenAccountOutput,
      feeRecipientAccount: feeRecipient,
      jupiterProgram: jupiterProgramId,
      user: relayerPubkey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

  // Add remaining accounts if provided
  if (jupiterRemainingAccounts && jupiterRemainingAccounts.length > 0) {
    instructionBuilder = instructionBuilder.remainingAccounts(jupiterRemainingAccounts);
  }

  const instruction = await instructionBuilder.instruction();
  return instruction;
}

/**
 * Process swap request
 */
export async function handleSwap(
  request: SwapRequest,
  config: Config
): Promise<SwapResponse> {
  if (!config.relayerEnabled || !config.relayerKeypair) {
    return {
      success: false,
      error: 'Relayer is not enabled on this server',
    };
  }

  try {
    console.log('Processing swap request:', {
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      extAmount: request.swapExtDataMinified.extAmount,
      extMinAmountOut: request.swapExtDataMinified.extMinAmountOut,
      fee: request.swapExtDataMinified.fee,
    });

    // Setup connection and program
    const connection = new Connection(config.solanaRpcUrl, 'confirmed');
    const wallet = new Wallet(config.relayerKeypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    const program = new Program(IDL as any, provider);

    // Build swap instruction
    const swapInstruction = await buildSwapInstruction(
      program,
      request,
      config.relayerKeypair.publicKey,
      config
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Build versioned transaction with Address Lookup Tables
    let lookupTableAccounts = [];
    
    // Add our ALT if configured
    if (config.altAddress) {
      const lookupTableAccount = await connection.getAddressLookupTable(config.altAddress);
      if (lookupTableAccount.value) {
        lookupTableAccounts.push(lookupTableAccount.value);
      }
    }

    // Add Jupiter's ALTs
    if (request.addressLookupTableAddresses && request.addressLookupTableAddresses.length > 0) {
      for (const address of request.addressLookupTableAddresses) {
        const lookupTableAccount = await connection.getAddressLookupTable(new PublicKey(address));
        if (lookupTableAccount.value) {
          lookupTableAccounts.push(lookupTableAccount.value);
        }
      }
    }

    const message = new TransactionMessage({
      payerKey: config.relayerKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: config.maxComputeUnits }),
        swapInstruction,
      ],
    }).compileToV0Message(lookupTableAccounts);

    const transaction = new VersionedTransaction(message);

    // Sign transaction
    transaction.sign([config.relayerKeypair]);

    console.log('Sending swap transaction...');

    // Send transaction
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log('Swap transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        signature,
      };
    }

    console.log('Swap transaction confirmed:', signature);

    return {
      success: true,
      signature,
      message: 'Swap processed successfully',
    };
  } catch (error: any) {
    console.error('Error processing swap:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

