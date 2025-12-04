import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token";
import { ComputeBudgetProgram, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Zert } from "../idl/zert";
import {
  findNullifierPDAs,
  findMerkleTreePDA,
  findTreeTokenAccountPDA,
  findGlobalConfigPDA
} from "../utils/derive";
import { SwapData } from "../utils/types";
import { ProofToSubmit, ExtData } from "../utils/types";


/**
 * Minified external data structure (for on-chain)
 */
export interface ExtDataMinified {
  extAmount: anchor.BN;
  fee: anchor.BN;
}

/**
 * Minified swap external data structure (for on-chain)
 */
export interface SwapExtDataMinified {
  extAmount: anchor.BN;
  extMinAmountOut: anchor.BN;
  fee: anchor.BN;
}

/**
 * Helper function to create ExtDataMinified from ExtData
 * @param extData - Full ExtData object
 * @returns Minified ExtData with only extAmount and fee
 */
export function createExtDataMinified(extData: ExtData): ExtDataMinified {
  return {
    extAmount: extData.extAmount,
    fee: extData.fee
  };
}

/**
 * Helper function to create SwapExtDataMinified from SwapData
 * @param swapData - Full SwapData object
 * @returns Minified SwapData with extAmount, extMinAmountOut, fee, and feeRecipient
 */
export function createSwapExtDataMinified(swapData: SwapData): SwapExtDataMinified {
  return {
    extAmount: swapData.extAmount,
    extMinAmountOut: swapData.extMinAmountOut,
    fee: swapData.fee,
  };
}

/**
 * Build transact instruction
 * @param program - Anchor program instance
 * @param proof - ZK proof data
 * @param extData - External data (recipient, amount, fee, etc.)
 * @param signer - Transaction signer public key
 * @returns Transaction instruction
 */
export async function buildDepositInstruction(
  program: anchor.Program<Zert>,
  proof: ProofToSubmit,
  extData: ExtData,
  signer: PublicKey,
  inputMint: PublicKey
): Promise<TransactionInstruction[]> {
  // Derive all necessary PDAs
  const [treeAccount] = findMerkleTreePDA(program.programId);
  const [globalConfig] = findGlobalConfigPDA(program.programId);
  const nullifiers = findNullifierPDAs(program, proof);

  // Derive reserve token accounts
  const reserveTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    globalConfig,
    true
  );
  console.log('reserveTokenAccount', reserveTokenAccount.toString())
  const userTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    signer,
    true
  );
  console.log('userTokenAccount', userTokenAccount.toString())

  const ixs = [];
  // Build instruction
  const instruction = await program.methods
    .deposit(
      proof,
      createExtDataMinified(extData),
      extData.encryptedOutput
    )
    .accountsStrict({
      treeAccount,
      nullifier0: nullifiers.nullifier0PDA,
      nullifier1: nullifiers.nullifier1PDA,
      globalConfig,
      inputMint: inputMint,
      reserveTokenAccount: reserveTokenAccount,
      feeRecipientAccount: extData.feeRecipient,
      userTokenAccount: userTokenAccount,
      user: signer,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .instruction();

  ixs.push(instruction);

  return ixs;
}

/**
 * Build withdraw instruction
 * @param program - Anchor program instance
 * @param proof - ZK proof data
 * @param extData - External data (recipient, amount, fee, etc.)
 * @param signer - Transaction signer public key
 * @param inputMint - Token mint address
 * @returns Transaction instruction
 */
export async function buildWithdrawInstruction(
  program: anchor.Program<Zert>,
  proof: ProofToSubmit,
  extData: ExtData,
  signer: PublicKey,
  inputMint: PublicKey
): Promise<TransactionInstruction[]> {
  // Derive all necessary PDAs
  const [treeAccount] = findMerkleTreePDA(program.programId);
  const [globalConfig] = findGlobalConfigPDA(program.programId);
  const nullifiers = findNullifierPDAs(program, proof);

  // Derive reserve token account
  const reserveTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    globalConfig,
    true
  );

  // For WSOL, use signer's (relayer's) token account (will be closed and SOL sent to recipient)
  // For other tokens, use recipient's token account directly
  const isNativeSOL = inputMint.equals(NATIVE_MINT);
  const recipientTokenAccount = isNativeSOL
    ? getAssociatedTokenAddressSync(inputMint, signer, true)
    : getAssociatedTokenAddressSync(inputMint, extData.recipient, true);

  const ixs = [];

  // Build instruction
  const instruction = await program.methods
    .withdraw(
      proof,
      createExtDataMinified(extData),
      extData.encryptedOutput
    )
    .accountsStrict({
      treeAccount,
      nullifier0: nullifiers.nullifier0PDA,
      nullifier1: nullifiers.nullifier1PDA,
      globalConfig,
      inputMint: inputMint,
      reserveTokenAccount: reserveTokenAccount,
      recipientTokenAccount: recipientTokenAccount,
      feeRecipientAccount: extData.feeRecipient,
      recipient: extData.recipient,
      relayer: signer,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .instruction();

  ixs.push(instruction);

  return ixs;
}

/**
 * Build swap instruction
 * @param program - Anchor program instance
 * @param proof - ZK proof data
 * @param extData - External data (recipient, amount, fee, etc.)
 * @param signer - Transaction signer public key
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @param jupiterSwapData - Optional Jupiter swap data for testing
 * @param jupiterRemainingAccounts - Optional Jupiter remaining accounts for testing
 * @returns Transaction instruction
 */
export async function buildSwapInstruction(
  program: anchor.Program<Zert>,
  proof: ProofToSubmit,
  swapData: SwapData,
  signer: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  jupiterSwapData: Buffer,
  jupiterRemainingAccounts?: any[]
): Promise<TransactionInstruction[]> {
  // Derive all necessary PDAs
  const [treeAccount] = findMerkleTreePDA(program.programId);
  const [globalConfig] = findGlobalConfigPDA(program.programId);
  const nullifiers = findNullifierPDAs(program, proof);

  // Derive reserve token accounts for both mints
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

  const userInputTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    signer,
    true
  );
  const userOutputTokenAccount = getAssociatedTokenAddressSync(
    outputMint,
    signer,
    true
  );

  const ixs = [];

  // Jupiter program ID (required account even when not using Jupiter)
  const jupiterProgramId = new anchor.web3.PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
  console.log("jupiterSwapData length:", jupiterSwapData);


  // Build instruction
  // Create mock Jupiter swap data if not provided

  let instructionBuilder = program.methods
    .swap(
      proof,
      createSwapExtDataMinified(swapData),
      // Buffer.alloc(0),
      // Buffer.alloc(0),
      swapData.encryptedOutput,
      jupiterSwapData
    )
    .accountsStrict({
      treeAccount,
      nullifier0: nullifiers.nullifier0PDA,
      nullifier1: nullifiers.nullifier1PDA,
      globalConfig,
      inputMint: inputMint,
      outputMint: outputMint,
      reserveTokenAccountInput: reserveTokenAccountInput,
      reserveTokenAccountOutput: reserveTokenAccountOutput,
      feeRecipientAccount: swapData.feeRecipient,
      jupiterProgram: jupiterProgramId,
      user: signer,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    });

  // Add remaining accounts if provided
  if (jupiterRemainingAccounts && jupiterRemainingAccounts.length > 0) {
    instructionBuilder = instructionBuilder.remainingAccounts(jupiterRemainingAccounts);
  }

  const instruction = await instructionBuilder.instruction();

  ixs.push(instruction);

  return ixs;
}

/**
 * 
 * Execute update deposit limit instruction
 * @param program - Anchor program instance
 * @param newLimit - New deposit limit in lamports
 * @param signers - Array of signers (should include authority)
 * @param preInstructions - Optional pre-instructions
 * @returns Transaction signature
 */
export async function executeUpdateDepositLimit(
  program: anchor.Program<Zert>,
  newLimit: anchor.BN,
  signers: anchor.web3.Keypair[],
  preInstructions?: TransactionInstruction[]
): Promise<string> {
  const [treeAccount] = findMerkleTreePDA(program.programId);

  const txBuilder = program.methods
    .updateDepositLimit(newLimit)
    .accounts({
      treeAccount,
      authority: signers[0].publicKey
    })
    .signers(signers);

  if (preInstructions && preInstructions.length > 0) {
    txBuilder.preInstructions(preInstructions);
  }

  return await txBuilder.rpc();
}

/**
 * Build update global config instruction
 * @param program - Anchor program instance
 * @param authority - Authority public key
 * @param depositFeeRate - Optional new deposit fee rate (in basis points, 0-10000)
 * @param withdrawalFeeRate - Optional new withdrawal fee rate (in basis points, 0-10000)
 * @param feeErrorMargin - Optional new fee error margin (in basis points, 0-10000)
 * @returns Transaction instruction
 */
export async function buildUpdateGlobalConfigInstruction(
  program: anchor.Program<Zert>,
  authority: PublicKey,
  depositFeeRate?: number | null,
  withdrawalFeeRate?: number | null,
  feeErrorMargin?: number | null
) {
  const [globalConfig] = findGlobalConfigPDA(program.programId);

  return await program.methods
    .updateGlobalConfig(
      depositFeeRate ?? null,
      withdrawalFeeRate ?? null,
      feeErrorMargin ?? null
    )
    .accounts({
      globalConfig,
      authority
    })
    .instruction();
}

/**
 * Execute update global config instruction
 * @param program - Anchor program instance
 * @param signers - Array of signers (should include authority)
 * @param depositFeeRate - Optional new deposit fee rate (in basis points, 0-10000)
 * @param withdrawalFeeRate - Optional new withdrawal fee rate (in basis points, 0-10000)
 * @param feeErrorMargin - Optional new fee error margin (in basis points, 0-10000)
 * @param preInstructions - Optional pre-instructions
 * @returns Transaction signature
 */
export async function executeUpdateGlobalConfig(
  program: anchor.Program<Zert>,
  signers: anchor.web3.Keypair[],
  depositFeeRate?: number | null,
  withdrawalFeeRate?: number | null,
  feeErrorMargin?: number | null,
  preInstructions?: TransactionInstruction[]
): Promise<string> {
  const [globalConfig] = findGlobalConfigPDA(program.programId);

  const txBuilder = program.methods
    .updateGlobalConfig(
      depositFeeRate ?? null,
      withdrawalFeeRate ?? null,
      feeErrorMargin ?? null
    )
    .accounts({
      globalConfig,
      authority: signers[0].publicKey
    })
    .signers(signers);

  if (preInstructions && preInstructions.length > 0) {
    txBuilder.preInstructions(preInstructions);
  }

  return await txBuilder.rpc();
}

/**
 * Build initialize instruction
 * @param program - Anchor program instance
 * @param authority - Authority public key
 * @returns Transaction instruction
 */
export async function buildInitializeInstruction(
  program: anchor.Program<Zert>,
  authority: PublicKey
) {
  const [treeAccount] = findMerkleTreePDA(program.programId);
  const [treeTokenAccount] = findTreeTokenAccountPDA(program.programId);
  const [globalConfig] = findGlobalConfigPDA(program.programId);

  return await program.methods
    .initialize()
    .accountsStrict({
      treeAccount,
      treeTokenAccount,
      globalConfig,
      authority,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .instruction();
}

/**
 * Execute initialize instruction
 * @param program - Anchor program instance
 * @param signers - Array of signers (should include authority)
 * @param preInstructions - Optional pre-instructions
 * @returns Transaction signature
 */
export async function executeInitialize(
  program: anchor.Program<Zert>,
  signers: anchor.web3.Keypair[],
  preInstructions?: TransactionInstruction[]
): Promise<string> {
  const [treeAccount] = findMerkleTreePDA(program.programId);
  const [treeTokenAccount] = findTreeTokenAccountPDA(program.programId);
  const [globalConfig] = findGlobalConfigPDA(program.programId);

  const txBuilder = program.methods
    .initialize()
    .accountsStrict({
      treeAccount,
      treeTokenAccount,
      globalConfig,
      authority: signers[0].publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers(signers);

  if (preInstructions && preInstructions.length > 0) {
    txBuilder.preInstructions(preInstructions);
  }

  return await txBuilder.rpc();
}






/**
 * Send transaction with Address Lookup Table support (for localnet/devnet/mainnet)
 */
export async function sendTransactionWithALT(
  connection: anchor.web3.Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[],
  altAddress: PublicKey[],
  computeUnitLimit?: number
): Promise<string> {
  // Add compute budget instruction
  const allInstructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit || 1400000 }),
    ...instructions
  ];

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  let versionedTx: anchor.web3.VersionedTransaction;

  if (altAddress && altAddress.length > 0) {
    // Use versioned transaction with ALT
    const lookupTableAccounts = [];
    for (const alt of altAddress) {
      const lookupTableAccount = await connection.getAddressLookupTable(alt);
      if (!lookupTableAccount.value) {
        throw new Error(`ALT not found: ${alt.toString()}`);
      }
      lookupTableAccounts.push(lookupTableAccount.value);
    }
    console.log("lookupTableAccounts:", lookupTableAccounts.map(alt => alt.state.addresses.map(addr => addr.toString())));
    const messageV0 = new anchor.web3.TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message(lookupTableAccounts);

    console.log("Transaction compiled successfully");
    console.log("Message accountKeys length:", messageV0.staticAccountKeys.length);
    console.log("Message addressTableLookups length:", messageV0.addressTableLookups?.length || 0);
    console.log("Message compiledInstructions length:", messageV0.compiledInstructions.length);

    // Calculate approximate message size
    let estimatedSize = 0;
    for (const ix of messageV0.compiledInstructions) {
      estimatedSize += ix.data.length;
      console.log("  Instruction data length:", ix.data.length, "bytes");
      console.log("  Instruction accounts:", ix.accountKeyIndexes.length);
    }
    console.log("Total instruction data size:", estimatedSize, "bytes");
    console.log("Static account keys:", messageV0.staticAccountKeys.length);

    // Try to serialize to see the actual size
    try {
      const serialized = messageV0.serialize();
      console.log("Serialized message size:", serialized.length, "bytes");
    } catch (e) {
      console.error("Failed to serialize message:", e instanceof Error ? e.message : 'Unknown error');
      console.log("This usually means the transaction is too large");

      // Print detailed info about each instruction
      for (let i = 0; i < allInstructions.length; i++) {
        const ix = allInstructions[i];
        console.log(`Instruction ${i}:`, {
          programId: ix.programId.toBase58(),
          dataLength: ix.data.length,
          keysLength: ix.keys.length
        });
      }
    }

    versionedTx = new anchor.web3.VersionedTransaction(messageV0);
  } else {
    // Fallback to V0 without ALT
    const messageV0 = new anchor.web3.TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message([]);

    versionedTx = new anchor.web3.VersionedTransaction(messageV0);
  }

  // Sign transaction
  const allSigners = [payer, ...signers];
  versionedTx.sign(allSigners);

  // Send and confirm
  const signature = await connection.sendTransaction(versionedTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

