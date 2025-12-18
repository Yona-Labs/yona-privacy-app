import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { Keypair as UtxoKeypair } from "../models/keypair";
import { Utxo } from "../models/utxo";
import {
  parseProofToBytesArray,
  parseToBytesArray,
  prove,
} from "../utils/prover";
import {
  ALT_ADDRESS,
  CIRCUIT_PATH,
  FEE_RECIPIENT,
  FIELD_SIZE,
  MERKLE_TREE_DEPTH,
  WITHDRAW_FEE_RATE,
} from "../utils/constants";
import { EncryptionService } from "../utils/encryption"; 
import type { Signed } from "../utils/getAccountSign";
import { getExtDataHash, publicKeyToFieldElement } from "../utils/getExtDataHash";
import { getMyUtxos, isUtxoSpent } from "../utils/getMyUtxos";
import {
  findMerkleTreePDA,
  findTreeTokenAccountPDA,
  findGlobalConfigPDA,
} from "../utils/derive";
import { Program } from "@coral-xyz/anchor";
import { Zkcash } from "@/lib/sdk/idl/zkcash";
import { ExtData, ProofInput, ProofToSubmit } from "../utils/types";
import { buildWithdrawInstruction } from "./instructions"; 
import {
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { sendWithdrawToRelayer, waitForJobCompletion } from "../utils/relayer";
import { queryRemoteTreeState, fetchMerkleProof } from "../utils/indexer";
import { parseTransactionError } from "../utils/errorParser";



/**
 * Withdraw with Relayer (Async Job-based)
 * Submits withdrawal to relayer and polls for completion
 */
export async function withdrawWithRelayer(
  recipient_address: PublicKey,
  amount_in_lamports: number,
  signed: Signed,
  connection: Connection,
  _program: Program<Zkcash>,
  mintAddress: string,
  setStatus?: Function,
  hasher?: any,
) {
  let fee_amount_in_lamports = Math.floor(
    amount_in_lamports * WITHDRAW_FEE_RATE
  );
  amount_in_lamports -= fee_amount_in_lamports;
  let isPartial = false;

  const lightWasm = hasher;
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

  console.log("Preparing withdrawal with relayer...");
  console.log(`Recipient: ${recipient_address.toString()}`);
  console.log(`Amount: ${amount_in_lamports} lamports`);   
  console.log(`Fee: ${fee_amount_in_lamports} lamports`);

  // Get current tree state
  const { root, nextIndex: currentNextIndex } = await queryRemoteTreeState();
  console.log(`Using tree root: ${root}`);

  // Generate UTXO keypair
  const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();
  const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

  // Fetch existing UTXOs
  setStatus?.("Fetching UTXOs...");
  const allUtxosArray = await getMyUtxos(signed, connection, setStatus, hasher);
  const allUtxos = allUtxosArray.filter(utxo => utxo.mintAddress === publicKeyToFieldElement(mintAddress));
  const nonZeroUtxos = allUtxos.filter((utxo) => utxo.amount.gt(new BN(0)));
  console.log("nonZeroUtxos:", nonZeroUtxos);
  const utxoSpentStatuses = await Promise.all(
    nonZeroUtxos.map((utxo) => isUtxoSpent(connection, utxo))
  );
  const unspentUtxos = nonZeroUtxos.filter(
    (_, index) => !utxoSpentStatuses[index]
  );

  if (unspentUtxos.length < 1) {
    throw new Error("Need at least 1 unspent UTXO to perform a withdrawal");
  }

  unspentUtxos.sort((a, b) => b.amount.cmp(a.amount));

  const firstInput = unspentUtxos[0];
  const secondInput = new Utxo({
          lightWasm,
          keypair: utxoKeypair,
          amount: "0",
          mintAddress: mintAddress,
        });

  const inputs = [firstInput, secondInput];
  const totalInputAmount = firstInput.amount.add(secondInput.amount);

  if (totalInputAmount.toNumber() === 0) {
    throw new Error("No balance available");
  }

  if (
    totalInputAmount.lt(new BN(amount_in_lamports + fee_amount_in_lamports))
  ) {
    throw new Error("Insufficient balance");
    // isPartial = true;
    // amount_in_lamports = totalInputAmount.toNumber();
    // fee_amount_in_lamports = Math.floor(amount_in_lamports * WITHDRAW_FEE_RATE);
    // amount_in_lamports -= fee_amount_in_lamports;
  }

  const changeAmount = totalInputAmount
    .sub(new BN(amount_in_lamports))
    .sub(new BN(fee_amount_in_lamports));
  console.log(
    `Withdrawing ${amount_in_lamports} lamports with ${fee_amount_in_lamports} fee, ${changeAmount.toString()} as change`
  );

  // Get Merkle proofs
  setStatus?.("Fetching Merkle proofs...");
  const inputMerkleProofs = await Promise.all(
    inputs.map(async (utxo) => {
      if (utxo.amount.eq(new BN(0))) {
        return {
          pathElements: [...new Array(MERKLE_TREE_DEPTH).fill("0")],
          pathIndices: Array(MERKLE_TREE_DEPTH).fill(0),
        };
      }
      const commitment = await utxo.getCommitment();
      return fetchMerkleProof(commitment);
    })
  );

  const inputMerklePathElements = inputMerkleProofs.map(
    (proof) => proof.pathElements
  );
  const inputMerklePathIndices = inputs.map((utxo) => utxo.index || 0);

  // Create outputs
  const outputs = [
    new Utxo({
      lightWasm,
      amount: changeAmount.toString(),
      keypair: utxoKeypair,
      mintAddress: mintAddress,
      index: currentNextIndex,
    }),
    new Utxo({
      lightWasm,
      amount: "0",
      keypair: utxoKeypair,
      mintAddress: mintAddress,
      index: currentNextIndex + 1,
    }),
  ];

  const extAmount = -amount_in_lamports;
  const publicAmountForCircuit = new BN(extAmount)
    .sub(new BN(fee_amount_in_lamports))
    .add(FIELD_SIZE)
    .mod(FIELD_SIZE);

  const inputNullifiers = await Promise.all(
    inputs.map((x) => x.getNullifier())
  );
  const outputCommitments = await Promise.all(
    outputs.map((x) => x.getCommitment())
  );

  // Encrypt outputs
  setStatus?.("Encrypting outputs...");
  const encryptedOutput = encryptionService.encryptUtxos(outputs);
  const feeRecipientTokenAccount = getAssociatedTokenAddressSync(new PublicKey(mintAddress), FEE_RECIPIENT, true)
  // Prepare ExtData
  const extData: ExtData = {
    recipient: recipient_address,
    extAmount: new BN(extAmount),
    encryptedOutput: Buffer.from(encryptedOutput),
    fee: new BN(fee_amount_in_lamports),
    feeRecipient: feeRecipientTokenAccount,
    mintAddressA: new PublicKey(mintAddress),
    mintAddressB: new PublicKey(mintAddress),
  };

  const calculatedExtDataHash = getExtDataHash(extData);

  // Create proof input
  const input: ProofInput = {
    root: root,
    inputNullifier: inputNullifiers,
    outputCommitment: outputCommitments,
    publicAmount0: publicAmountForCircuit.toString(10),
    publicAmount1: "0",
    extDataHash: calculatedExtDataHash,
    mintAddress0: publicKeyToFieldElement(mintAddress),
    mintAddress1: publicKeyToFieldElement(mintAddress),
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
  console.log("input:", input);
  // Generate proof
  setStatus?.("Generating ZK proof... (this may take a minute)");
  console.log("Generating proof...");
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
  setStatus?.("Submitting withdrawal to relayer...");
  console.log("Submitting withdrawal to relayer...");
  console.log("proofToSubmit", proofToSubmit);
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
    extDataMinified: {
      extAmount: extAmount.toString(),
      fee: fee_amount_in_lamports.toString(),
    },
    encryptedOutput: Array.from(encryptedOutput), 
    recipient: recipient_address.toString(),
    feeRecipient: feeRecipientTokenAccount.toString(),
    inputMint: mintAddress,
  };

  const submitResponse = await sendWithdrawToRelayer(relayerRequest); 

  if (!submitResponse.success || !submitResponse.jobId) {
    throw new Error(
      submitResponse.error || "Failed to submit withdrawal to relayer"
    );
  }

  console.log(`Withdrawal submitted! Job ID: ${submitResponse.jobId}`);
  setStatus?.(
    `Withdrawal queued (Job: ${submitResponse.jobId.substring(0, 12)}...)`
  );

  // Wait for job completion
  setStatus?.("Processing withdrawal...");
  const jobResult = await waitForJobCompletion(
    submitResponse.jobId,
    (status) => {
      console.log(`Job status: ${status}`);
      setStatus?.(`Processing withdrawal... (${status})`);
    },
    90000, // 90 seconds max wait
    3000 // Check every 3 seconds
  );

  if (!jobResult) {
    throw new Error("Withdrawal processing timed out. Check job status later.");
  }

  if (jobResult.status === "failed" || !jobResult.result?.success) {
    const errorMsg = jobResult.result?.error || jobResult.error || "Withdrawal failed";
    // Error message is already parsed by relayer, but we keep parseTransactionError just in case
    throw new Error(errorMsg);
  }

  console.log("Withdrawal completed successfully!");
  console.log("Transaction signature:", jobResult.result.signature);
  console.log(
    `Explorer: https://orb.helius.dev/tx/${jobResult.result.signature}`
  );

  // Wait for confirmation
  setStatus?.("Waiting for blockchain confirmation...");
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    isPartial,
    signature: jobResult.result.signature,
    jobId: submitResponse.jobId,
  };
}
