// import {
//   ComputeBudgetProgram,
//   Connection,
//   PublicKey,
//   TransactionMessage,
//   VersionedTransaction,
// } from "@solana/web3.js";
// import BN from "bn.js";
// import { Keypair as UtxoKeypair } from "../models/keypair";
// import { Utxo } from "../models/utxo";
// import {
//   ALT_ADDRESS,
//   CIRCUIT_PATH,
//   FEE_RECIPIENT,
//   FIELD_SIZE,
//   MERKLE_TREE_DEPTH,
// } from "../utils/constants";
// import { EncryptionService } from "../utils/encryption";
// import type { Signed } from "../utils/getAccountSign";

// import { publicKeyToFieldElement, getSwapExtDataHash } from "../utils/getExtDataHash";
// import { getMyUtxos, isUtxoSpent } from "../utils/getMyUtxos";
// import { findMintByFirst4Bytes } from "../utils/tokenInfo";
// import { MerkleTree } from "../utils/merkle_tree";
// import { parseProofToBytesArray, parseToBytesArray, prove } from "../utils/prover";
// import { findGlobalConfigPDA, findMerkleTreePDA } from "../utils/derive";
// import { Zkcash } from "../idl/zkcash";
// import { Program } from "@coral-xyz/anchor";
// import { ProofInput, ProofToSubmit, SwapData } from "../utils/types";
// import { queryRemoteTreeState, fetchMerkleProof } from "../utils/indexer";
// import { buildSwapInstruction } from "./instructions";
// import { extractJupiterSwapInstruction, getJupiterSwapTransaction, JupiterQuoteResponse, JupiterSwapResponse } from "../utils/jupiter";

// export async function swap(
//   amountToSwap: number,
//   minAmountOut: number,
//   signed: Signed,
//   connection: Connection,
//   program: Program<Zkcash>,
//   inputMintAddress: string,
//   outputMintAddress: string,
//   signAllTransactions: any,
//   quoteResponse: JupiterQuoteResponse,
//   setStatus?: Function,
//   hasher?: any
// ) {
//   const [treeAccount] = findMerkleTreePDA(program.programId);
//   const [globalConfigAccount] = findGlobalConfigPDA(program.programId);

//   const swapResponse = await getJupiterSwapTransaction(quoteResponse, globalConfigAccount.toString());
//   const jupiterSwapInstruction = extractJupiterSwapInstruction(swapResponse);

//   const swapFee = 0;

//   let lightWasm = hasher;

//   const encryptionService = new EncryptionService();
//   encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

//   const tree = new MerkleTree(MERKLE_TREE_DEPTH, lightWasm);

//   let root: string;
//   let currentNextIndex: number;

//   try {
//     const data = await queryRemoteTreeState();
//     root = data.root;
//     currentNextIndex = data.nextIndex;
//   } catch (error) {
//     console.error("Failed to fetch root and nextIndex from API, exiting");
//     return;
//   }

//   const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();

//   const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

//   const allUtxos = await getMyUtxos(signed, connection, setStatus, hasher);

//   const inputMintUtxos = allUtxos.filter((utxo) => {
//     if (!utxo.amount.gt(new BN(0))) {
//       return false;
//     }

//     const utxoMintString = publicKeyToFieldElement(inputMintAddress);
//     return utxo.amount.gt(new BN(0)) && utxo.mintAddress === utxoMintString;
//   });

//   const utxoSpentStatuses = await Promise.all(
//     inputMintUtxos.map((utxo) => isUtxoSpent(connection, utxo))
//   );

//   const existingUnspentUtxos = inputMintUtxos.filter(
//     (_, index) => !utxoSpentStatuses[index]
//   );

//   if (existingUnspentUtxos.length === 0) {
//     throw new Error(
//       "No unspent UTXOs found for the input mint. Please deposit first."
//     );
//   }

//   const firstUtxo = existingUnspentUtxos[0];
//   if (firstUtxo.amount.lt(new BN(amountToSwap))) {
//     throw new Error(
//       `Insufficient balance in UTXO: ${firstUtxo.amount.toString()} < ${amountToSwap}`
//     );
//   }


//   const inputs = [
//     firstUtxo,
//     new Utxo({
//       lightWasm,
//       keypair: utxoKeypair,
//       mintAddress: outputMintAddress,
//     }),
//   ];

//   const publicAmount0 = new BN(-amountToSwap)
//     .sub(new BN(swapFee))
//     .add(FIELD_SIZE)
//     .mod(FIELD_SIZE);
//   const publicAmount1 = new BN(minAmountOut).add(FIELD_SIZE).mod(FIELD_SIZE);

//   const inputsSum = inputs.reduce((sum, x) => sum.add(x.amount), new BN(0));
//   const remainingAmountInputMint = inputsSum
//     .sub(new BN(amountToSwap))
//     .sub(new BN(swapFee));
//   const swappedAmountOutputMint = new BN(minAmountOut);

//   const outputs = [
//     new Utxo({
//       lightWasm,
//       amount: remainingAmountInputMint.toString(),
//       keypair: utxoKeypair,
//       mintAddress: inputMintAddress,
//       index: currentNextIndex,
//     }),
//     new Utxo({
//       lightWasm,
//       amount: swappedAmountOutputMint.toString(),
//       keypair: utxoKeypair,
//       mintAddress: outputMintAddress,
//       index: currentNextIndex + 1,
//     }),
//   ];

//   const inputMerklePathIndices = [];
//   const inputMerklePathElements = [];

//   for (let i = 0; i < inputs.length; i++) {
//     const input = inputs[i];
//     if (input.amount.gt(new BN(0))) {
//       const commitment = await input.getCommitment();
//       const merkleProof = await fetchMerkleProof(commitment);
//       inputMerklePathIndices.push(input.index || 0);
//       inputMerklePathElements.push(merkleProof.pathElements);
//     } else {
//       inputMerklePathIndices.push(0);
//       inputMerklePathElements.push(new Array(tree.levels).fill("0"));
//     }
//   }

//   const inputNullifiers = await Promise.all(
//     inputs.map((x) => x.getNullifier())
//   );
//   const outputCommitments = await Promise.all(
//     outputs.map((x) => x.getCommitment())
//   );

//   const encryptedOutput = encryptionService.encryptUtxos(outputs);

//   const swapData: SwapData = {
//     extAmount: new BN(-amountToSwap),
//     extMinAmountOut: new BN(minAmountOut),
//     encryptedOutput: Buffer.from(encryptedOutput),
//     fee: new BN(swapFee),
//     feeRecipient: FEE_RECIPIENT,
//     mintAddressA: new PublicKey(inputMintAddress),
//     mintAddressB: new PublicKey(outputMintAddress),
//   };

//   const calculatedExtDataHash = getSwapExtDataHash(swapData);

//   const input: ProofInput = {
//     root: root,
//     inputNullifier: inputNullifiers,
//     outputCommitment: outputCommitments,
//     publicAmount0: publicAmount0.toString(10),
//     publicAmount1: publicAmount1.toString(10),
//     extDataHash: calculatedExtDataHash,
//     mintAddress0: publicKeyToFieldElement(inputMintAddress),
//     mintAddress1: publicKeyToFieldElement(outputMintAddress),
//     inAmount: inputs.map((x) => x.amount.toString(10)),
//     inMintAddress: inputs.map((x) => x.mintAddress),
//     inPrivateKey: inputs.map((x) => x.keypair.privkey),
//     inBlinding: inputs.map((x) => x.blinding.toString(10)),
//     inPathIndices: inputMerklePathIndices,
//     inPathElements: inputMerklePathElements,
//     outAmount: outputs.map((x) => x.amount.toString(10)),
//     outMintAddress: outputs.map((x) => x.mintAddress),
//     outPubkey: outputs.map((x) => x.keypair.pubkey),
//     outBlinding: outputs.map((x) => x.blinding.toString(10)),
//   };

//   setStatus?.(`(generating ZK proof...)`);

//   const { proof, publicSignals } = await prove(input, CIRCUIT_PATH);

//   const proofInBytes = parseProofToBytesArray(proof);
//   const inputsInBytes = parseToBytesArray(publicSignals);

//   const proofToSubmit: ProofToSubmit = {
//     proofA: proofInBytes.proofA,
//     proofB: proofInBytes.proofB.flat(),
//     proofC: proofInBytes.proofC,
//     root: inputsInBytes[0],
//     publicAmount0: inputsInBytes[1],
//     publicAmount1: inputsInBytes[2],
//     extDataHash: inputsInBytes[3],
//     inputNullifiers: [inputsInBytes[6], inputsInBytes[7]],
//     outputCommitments: [inputsInBytes[8], inputsInBytes[9]],
//   };

//   const swapTx = await buildSwapInstruction(
//     program,
//     proofToSubmit,
//     swapData,
//     signed.publicKey,
//     new PublicKey(inputMintAddress),
//     new PublicKey(outputMintAddress),
//     jupiterSwapInstruction.data,
//     jupiterSwapInstruction.keys.map(key => ({
//       pubkey: key.pubkey,
//       isSigner: key.pubkey.equals(globalConfigAccount) ? false : key.isSigner,
//       isWritable: key.isWritable,
//     }))
//   );

//   const swapBlockhash = await connection.getLatestBlockhash();

//   let lookupTableAccounts = [];
//   const lookupTableAccount = await connection.getAddressLookupTable(
//     ALT_ADDRESS
//   );
//   if (!lookupTableAccount.value) {
//     throw new Error(`ALT not found: ${ALT_ADDRESS.toString()}`);
//   }
//   lookupTableAccounts.push(lookupTableAccount.value);

//   const swapTxMsg = new TransactionMessage({
//     payerKey: signed.publicKey,
//     recentBlockhash: swapBlockhash.blockhash,
//     instructions: [
//       ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
//       ...swapTx,
//     ],
//   }).compileToV0Message(lookupTableAccounts);

//   const swapTransaction = new VersionedTransaction(swapTxMsg);

//   const signedTransactions = await signAllTransactions([swapTransaction]);

//   setStatus?.(`(sending swap transaction...)`);

//   const signature = await connection.sendTransaction(signedTransactions[0], {
//     preflightCommitment: "confirmed",
//   });

//   await connection.confirmTransaction(signature, "confirmed");

//   return signature;
// }

