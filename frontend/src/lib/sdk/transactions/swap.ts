import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { Keypair as UtxoKeypair } from "../models/keypair";
import { Utxo } from "../models/utxo";
import {
  CIRCUIT_PATH,
  FEE_RECIPIENT,
  FIELD_SIZE,
  MERKLE_TREE_DEPTH,
  SWAP_FEE_RATE,
} from "../utils/constants";
import { EncryptionService } from "../utils/encryption";
import type { Signed } from "../utils/getAccountSign";
import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { publicKeyToFieldElement, getSwapExtDataHash } from "../utils/getExtDataHash";
import { getMyUtxos, isUtxoSpent } from "../utils/getMyUtxos";
import { MerkleTree } from "../utils/merkle_tree";
import { parseProofToBytesArray, parseToBytesArray, prove } from "../utils/prover";
import { findGlobalConfigPDA } from "../utils/derive";
import { Zkcash } from "../idl/zkcash";
import { Program } from "@coral-xyz/anchor";
import { ProofInput, ProofToSubmit, SwapData } from "../utils/types";
import { queryRemoteTreeState, fetchMerkleProof } from "../utils/indexer";
import { extractJupiterSwapInstruction, getJupiterSwapTransaction, JupiterQuoteResponse } from "../utils/jupiter";
import { sendSwapToRelayer, waitForJobCompletion } from "../utils/relayer";
import { parseTransactionError } from "../utils/errorParser";

/**
 * Swap with Relayer (Async Job-based)
 * Submits swap to relayer and polls for completion
 */
export async function swapWithRelayer(
  amountToSwap: number,
  minAmountOut: number,
  signed: Signed,
  connection: Connection,
  program: Program<Zkcash>,
  inputMintAddress: string,
  outputMintAddress: string,
  quoteResponse: JupiterQuoteResponse,
  setStatus?: Function,
  hasher?: any
) {
  const [globalConfigAccount] = findGlobalConfigPDA(program.programId);

  const swapResponse = await getJupiterSwapTransaction(quoteResponse, globalConfigAccount.toString());
  console.log("swapResponse:", swapResponse);
  const jupiterSwapInstruction = extractJupiterSwapInstruction(swapResponse);

  const swapFee = Math.floor(amountToSwap * SWAP_FEE_RATE);

  let lightWasm = hasher;

  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

  console.log("Preparing swap with relayer...");
  console.log(`Amount to swap: ${amountToSwap} lamports`);
  console.log(`Min amount out: ${minAmountOut} lamports`);
  console.log(`Fee: ${swapFee} lamports`);

  const tree = new MerkleTree(MERKLE_TREE_DEPTH, lightWasm);

  let root: string;
  let currentNextIndex: number;

  try {
    const data = await queryRemoteTreeState();
    root = data.root;
    console.log("root:", root);
    currentNextIndex = data.nextIndex;  
  } catch (error) {
    console.error("Failed to fetch root and nextIndex from API, exiting");
    throw new Error("Failed to fetch tree state from indexer");
  }

  const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();

  const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

  setStatus?.("Fetching UTXOs...");
  const allUtxos = await getMyUtxos(signed, connection, setStatus, hasher);

  const inputMintUtxos = allUtxos.filter((utxo) => {
    if (!utxo.amount.gt(new BN(0))) {
      return false;
    }

    const utxoMintString = publicKeyToFieldElement(inputMintAddress);
    return utxo.amount.gt(new BN(0)) && utxo.mintAddress === utxoMintString;
  });
  const outputMintUtxos = allUtxos.filter((utxo) => {
    if (!utxo.amount.gt(new BN(0))) {
      return false;
    }

    const utxoMintString = publicKeyToFieldElement(outputMintAddress);
    return utxo.amount.gt(new BN(0)) && utxo.mintAddress === utxoMintString;
  });

  const utxoSpentStatuses = await Promise.all(
    inputMintUtxos.map((utxo) => isUtxoSpent(connection, utxo))
  );

  const outputMintUtxoSpentStatuses = await Promise.all(
    outputMintUtxos.map((utxo) => isUtxoSpent(connection, utxo))
  );

  const existingUnspentInputMintUtxos = inputMintUtxos.filter(
    (_, index) => !utxoSpentStatuses[index]
  );
  const existingUnspentOutputMintUtxos = outputMintUtxos.filter(
    (_, index) => !outputMintUtxoSpentStatuses[index]
  );
  if (existingUnspentInputMintUtxos.length === 0) {
    throw new Error(
      "No unspent UTXOs found for the input mint. Please deposit first."
    );
  }

  const firstUtxo = existingUnspentInputMintUtxos[0];
  if (firstUtxo.amount.lt(new BN(amountToSwap + swapFee))) {
    throw new Error(
      `Insufficient balance in UTXO: ${firstUtxo.amount.toString()} < ${amountToSwap + swapFee} (including fee)`
    );
  }
  let inputs: Utxo[];
  let inputMerklePathIndices: number[];
  let inputMerklePathElements: string[][];

  setStatus?.("Fetching Merkle proofs...");

  if (existingUnspentOutputMintUtxos.length === 0) {
    console.log("existingUnspentOutputMintUtxos.length === 0");
    inputs = [
      firstUtxo,
      new Utxo({
        lightWasm,
        keypair: utxoKeypair,
        mintAddress: outputMintAddress,
      }),
    ];
    const firstUtxoCommitment = await firstUtxo.getCommitment();
    const firstUtxoMerkleProof = await fetchMerkleProof(firstUtxoCommitment);

    inputMerklePathIndices = [
      firstUtxo.index || 0,
      0,
    ];

    inputMerklePathElements = [
      firstUtxoMerkleProof.pathElements,
      [...new Array(tree.levels).fill("0")],
    ];
  } else {
    const outputMintUtxo = existingUnspentOutputMintUtxos[0];

    inputs = [
      firstUtxo,
      outputMintUtxo,
    ];
    const firstUtxoCommitment = await firstUtxo.getCommitment();
    const firstUtxoMerkleProof = await fetchMerkleProof(firstUtxoCommitment);

    const outputMintUtxoCommitment = await outputMintUtxo.getCommitment();
    const outputMintUtxoMerkleProof = await fetchMerkleProof(outputMintUtxoCommitment);

    inputMerklePathIndices = [
      firstUtxo.index || 0,
      outputMintUtxo.index || 0,
    ];

    inputMerklePathElements = [
      firstUtxoMerkleProof.pathElements,
      outputMintUtxoMerkleProof.pathElements,
    ];
  }

  const publicAmount0 = new BN(-amountToSwap)
    .sub(new BN(swapFee))
    .add(FIELD_SIZE)
    .mod(FIELD_SIZE);
  const publicAmount1 = new BN(minAmountOut).add(FIELD_SIZE).mod(FIELD_SIZE);

  // Sum only input mint UTXOs, not output mint UTXOs
  const inputMintField = publicKeyToFieldElement(inputMintAddress);
  const inputMintInputsSum = inputs
    .filter(utxo => utxo.mintAddress === inputMintField)
    .reduce((sum, x) => sum.add(x.amount), new BN(0));

  console.log("inputMintInputsSum:", inputMintInputsSum.toString());
  const remainingAmountInputMint = inputMintInputsSum
    .sub(new BN(amountToSwap))
    .sub(new BN(swapFee));
  console.log("remainingAmountInputMint:", remainingAmountInputMint.toString());
  console.log(
    `Swapping ${amountToSwap} lamports with ${swapFee} fee, ${remainingAmountInputMint.toString()} remaining`
  );
  // Output combines existing output mint UTXO amount + swapped amount
  const existingOutputMintAmount = existingUnspentOutputMintUtxos.length > 0
    ? existingUnspentOutputMintUtxos[0].amount
    : new BN(0);
  const swappedAmountOutputMint = existingOutputMintAmount.add(new BN(minAmountOut));
  
  const outputs = [
    new Utxo({
      lightWasm,
      amount: remainingAmountInputMint.toString(),
      keypair: utxoKeypair,
      mintAddress: inputMintAddress,
      index: currentNextIndex,
    }),
    new Utxo({
      lightWasm,
      amount: swappedAmountOutputMint.toString(),
      keypair: utxoKeypair,
      mintAddress: outputMintAddress,
      index: currentNextIndex + 1,
    }),
  ];
  console.log("outputs:", outputs);
  const inputNullifiers = await Promise.all(
    inputs.map((x) => x.getNullifier())
  );
  const outputCommitments = await Promise.all(
    outputs.map((x) => x.getCommitment())
  );

  setStatus?.("Encrypting outputs...");
  const encryptedOutput = encryptionService.encryptUtxos(outputs);
  const feeRecipientTokenAccount = getAssociatedTokenAddressSync(new PublicKey(outputMintAddress), FEE_RECIPIENT, true)

  const swapData: SwapData = {
    extAmount: new BN(-amountToSwap),
    extMinAmountOut: new BN(minAmountOut),
    encryptedOutput: Buffer.from(encryptedOutput),
    fee: new BN(swapFee),
    feeRecipient: feeRecipientTokenAccount,
    mintAddressA: new PublicKey(inputMintAddress),
    mintAddressB: new PublicKey(outputMintAddress),
  };

  const calculatedExtDataHash = getSwapExtDataHash(swapData);

  const input: ProofInput = {
    root: root,
    inputNullifier: inputNullifiers,
    outputCommitment: outputCommitments,
    publicAmount0: publicAmount0.toString(10),
    publicAmount1: publicAmount1.toString(10),
    extDataHash: calculatedExtDataHash,
    mintAddress0: publicKeyToFieldElement(inputMintAddress),
    mintAddress1: publicKeyToFieldElement(outputMintAddress),
    inAmount: inputs.map((x) => x.amount.toString(10)),
    inMintAddress: inputs.map((x) => x.mintAddress),
    inPrivateKey: inputs.map((x) => x.keypair.privkey),
    inBlinding: inputs.map((x) => x.blinding.toString(10)),
    inPathIndices: inputMerklePathIndices,
    inPathElements: inputMerklePathElements,
    outAmount: outputs.map((x) => x.amount.toString(10)),
    outMintAddress: outputs.map((x) => x.mintAddress),
    outPubkey: outputs.map((x) => x.keypair.pubkey),
    outBlinding: outputs.map((x) => x.blinding.toString(10)),
  };

  setStatus?.("Generating ZK proof... (this may take a minute)");
  console.log("Generating proof...");
  console.log("input:", input);
  const { proof, publicSignals } = await prove(input, CIRCUIT_PATH);

  const proofInBytes = parseProofToBytesArray(proof);
  const inputsInBytes = parseToBytesArray(publicSignals);

  const proofToSubmit: ProofToSubmit = {
    proofA: proofInBytes.proofA,
    proofB: proofInBytes.proofB.flat(),
    proofC: proofInBytes.proofC,
    root: inputsInBytes[0],
    publicAmount0: inputsInBytes[1],
    publicAmount1: inputsInBytes[2],
    extDataHash: inputsInBytes[3],
    inputNullifiers: [inputsInBytes[6], inputsInBytes[7]],
    outputCommitments: [inputsInBytes[8], inputsInBytes[9]],
  };

  // Submit to relayer
  setStatus?.("Submitting swap to relayer...");
  console.log("Submitting swap to relayer...");
  console.log("proofToSubmit", proofToSubmit);

  // Prepare Jupiter remaining accounts for relayer
  const jupiterRemainingAccounts = jupiterSwapInstruction.keys.map(key => ({
    pubkey: key.pubkey.toString(),
    isSigner: key.pubkey.equals(globalConfigAccount) ? false : key.isSigner,
    isWritable: key.isWritable,
  }));

  const relayerRequest = {
    proof: {
      proofA: Array.from(proofToSubmit.proofA),
      proofB: Array.from(proofToSubmit.proofB),
      proofC: Array.from(proofToSubmit.proofC),
      root: Array.from(proofToSubmit.root),
      publicAmount0: Array.from(proofToSubmit.publicAmount0),
      publicAmount1: Array.from(proofToSubmit.publicAmount1),
      extDataHash: Array.from(proofToSubmit.extDataHash),
      inputNullifiers: proofToSubmit.inputNullifiers.map((n) => Array.from(n)),
      outputCommitments: proofToSubmit.outputCommitments.map((c) =>
        Array.from(c)
      ),
    },
    swapExtDataMinified: {
      extAmount: (-amountToSwap).toString(),
      extMinAmountOut: minAmountOut.toString(),
      fee: swapFee.toString(),
    },
    encryptedOutput: Array.from(encryptedOutput),
    feeRecipient: feeRecipientTokenAccount.toString(), 
    inputMint: inputMintAddress,
    outputMint: outputMintAddress,
    jupiterSwapData: jupiterSwapInstruction.data.toString('base64'),
    jupiterRemainingAccounts,
    addressLookupTableAddresses: swapResponse.addressLookupTableAddresses,
  };

  const submitResponse = await sendSwapToRelayer(relayerRequest);

  if (!submitResponse.success || !submitResponse.jobId) {
    throw new Error(
      submitResponse.error || "Failed to submit swap to relayer"
    );
  }

  console.log(`Swap submitted! Job ID: ${submitResponse.jobId}`);
  setStatus?.(
    `Swap queued (Job: ${submitResponse.jobId.substring(0, 12)}...)`
  );

  // Wait for job completion
  setStatus?.("Processing swap...");
  const jobResult = await waitForJobCompletion(
    submitResponse.jobId,
    (status) => {
      console.log(`Job status: ${status}`);
      setStatus?.(`Processing swap... (${status})`);
    },
    90000, // 90 seconds max wait
    3000 // Check every 3 seconds
  );

  if (!jobResult) {
    throw new Error("Swap processing timed out. Check job status later.");
  }

  if (jobResult.status === "failed" || !jobResult.result?.success) {
    const errorMsg = jobResult.result?.error || jobResult.error || "Swap failed";
    // Error message is already parsed by relayer, but we keep parseTransactionError just in case
    throw new Error(errorMsg);
  }

  console.log("Swap completed successfully!");
  console.log("Transaction signature:", jobResult.result.signature);
  console.log(
    `Explorer: https://orb.helius.dev/tx/${jobResult.result.signature}`
  );

  // Wait for confirmation
  setStatus?.("Waiting for blockchain confirmation...");
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    signature: jobResult.result.signature,
    jobId: submitResponse.jobId,
  };
}

// Keep the old swap function for backwards compatibility but mark as deprecated
/**
 * @deprecated Use swapWithRelayer instead for better privacy
 */
export { swapWithRelayer as swap };
