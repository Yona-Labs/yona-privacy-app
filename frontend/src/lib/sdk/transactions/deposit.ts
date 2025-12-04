import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { Keypair as UtxoKeypair } from "../models/keypair";
import { Utxo } from "../models/utxo";
import {
  ALT_ADDRESS,
  CIRCUIT_PATH,
  FEE_RECIPIENT,
  FIELD_SIZE,
  MERKLE_TREE_DEPTH,
} from "../utils/constants";
import { EncryptionService } from "../utils/encryption";
import type { Signed } from "../utils/getAccountSign";

import { getExtDataHash, publicKeyToFieldElement } from "../utils/getExtDataHash";
import { getMyUtxos, isUtxoSpent } from "../utils/getMyUtxos";
import { MerkleTree } from "../utils/merkle_tree";
import { parseProofToBytesArray, parseToBytesArray, prove } from "../utils/prover";
import {
  findGlobalConfigPDA,
  findMerkleTreePDA,
  findTreeTokenAccountPDA,
} from "../utils/derive";
import { Zert } from "../idl/zert";
import { Program } from "@coral-xyz/anchor";
import { ExtData, ProofInput, ProofToSubmit } from "../utils/types";  
import { buildDepositInstruction } from "./instructions";
import { queryRemoteTreeState, fetchMerkleProof } from "../utils/indexer";

export async function deposit(
  amount_in_sol: number,
  signed: Signed,
  connection: Connection,
  program: Program<Zert>,
  mintAddress: string,
  signAllTransactions: any,
  setStatus?: Function,
  hasher?: any
) {
  const amount_in_lamports = amount_in_sol * LAMPORTS_PER_SOL;
  const fee_amount_in_lamports = 0;

  let lightWasm = hasher;
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

  const [globalConfigAccount] = findGlobalConfigPDA(program.programId);

  const tree = new MerkleTree(MERKLE_TREE_DEPTH, lightWasm);

  let root: string;
  let currentNextIndex: number;

  try {
    const data = await queryRemoteTreeState();
    root = data.root;
    currentNextIndex = data.nextIndex;
  } catch (error) {
    console.error("Failed to fetch root and nextIndex from API, exiting");
    return; // Return early without a fallback
  }


  const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();

  const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

  const allUtxosArray = await getMyUtxos(signed, connection, setStatus, hasher);
  const allUtxos = allUtxosArray.filter(utxo => utxo.mintAddress === publicKeyToFieldElement(mintAddress));

  const nonZeroUtxos = allUtxos.filter((utxo) => utxo.amount.gt(new BN(0)));

  const utxoSpentStatuses = await Promise.all(
    nonZeroUtxos.map((utxo) => isUtxoSpent(connection, utxo))
  );

  const existingUnspentUtxos = nonZeroUtxos.filter(
    (_utxo, index) => !utxoSpentStatuses[index]
  );

  let extAmount: number;
  let outputAmount: string;

  let inputs: Utxo[];
  let inputMerklePathIndices: number[];
  let inputMerklePathElements: string[][];  

  if (existingUnspentUtxos.length === 0) {
    extAmount = amount_in_lamports;
    outputAmount = new BN(amount_in_lamports)
      .sub(new BN(fee_amount_in_lamports))
      .toString();

    inputs = [
      new Utxo({
        lightWasm,
        keypair: utxoKeypair,
        mintAddress: mintAddress,
      }),
      new Utxo({
        lightWasm,
        keypair: utxoKeypair,
        mintAddress: mintAddress,
      }),
    ];

    inputMerklePathIndices = inputs.map((input) => input.index || 0);
    inputMerklePathElements = inputs.map(() => {
      return [...new Array(tree.levels).fill("0")];
    });
  } else {
    // Scenario 2: Deposit that consolidates with existing UTXO
    const firstUtxo = existingUnspentUtxos[0];
    const firstUtxoAmount = firstUtxo.amount;
    const secondUtxoAmount =
      existingUnspentUtxos.length > 1
        ? existingUnspentUtxos[1].amount
        : new BN(0);
    extAmount = amount_in_lamports; // Still depositing new funds

    // Output combines existing UTXO amount + new deposit amount - fee
    outputAmount = firstUtxoAmount
      .add(secondUtxoAmount)
      .add(new BN(amount_in_lamports))
      .sub(new BN(fee_amount_in_lamports))
      .toString();

    const secondUtxo =
      existingUnspentUtxos.length > 1
        ? existingUnspentUtxos[1]
        : new Utxo({
          lightWasm,
          keypair: utxoKeypair,
          amount: "0",
          mintAddress: mintAddress,
        });

    inputs = [
      firstUtxo,
      secondUtxo,
    ];

    const firstUtxoCommitment = await firstUtxo.getCommitment();
    const firstUtxoMerkleProof = await fetchMerkleProof(firstUtxoCommitment);

    inputMerklePathIndices = [
      firstUtxo.index || 0,
      secondUtxo.amount.gt(new BN(0)) ? secondUtxo.index || 0 : 0,
    ];

    let secondUtxoMerkleProof;
    if (secondUtxo.amount.gt(new BN(0))) {
      const secondUtxoCommitment = await secondUtxo.getCommitment();
      secondUtxoMerkleProof = await fetchMerkleProof(secondUtxoCommitment);
    }

    inputMerklePathElements = [
      firstUtxoMerkleProof.pathElements,
      secondUtxo.amount.gt(new BN(0))
        ? secondUtxoMerkleProof!.pathElements
        : [...new Array(tree.levels).fill("0")],
    ];
  }

  const publicAmountForCircuit = new BN(extAmount)
    .sub(new BN(fee_amount_in_lamports))
    .add(FIELD_SIZE)
    .mod(FIELD_SIZE);

  const outputs = [
    new Utxo({
      lightWasm,
      amount: outputAmount,
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

  const inputNullifiers = await Promise.all(
    inputs.map((x) => x.getNullifier())
  );
  const outputCommitments = await Promise.all(
    outputs.map((x) => x.getCommitment())
  );

  const encryptedOutput = encryptionService.encryptUtxos(outputs);

  const reserveTokenAccount = getAssociatedTokenAddressSync(
    new PublicKey(mintAddress),
    globalConfigAccount,
    true
  );
  const extData: ExtData = {
    recipient: reserveTokenAccount,
    extAmount: new BN(extAmount),
    encryptedOutput: Buffer.from(encryptedOutput),
    fee: new BN(fee_amount_in_lamports),
    feeRecipient: FEE_RECIPIENT,
    mintAddressA: new PublicKey(mintAddress),
    mintAddressB: new PublicKey(mintAddress),
  };

  const calculatedExtDataHash = getExtDataHash(extData);

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

  setStatus?.(`(generating ZK proof...)`);
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

  const transactions: VersionedTransaction[] = [];
  const isNativeMint = mintAddress === NATIVE_MINT.toString();
  let userTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    signed.publicKey
  );

  if (isNativeMint) {
    const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
    const wrapInstructions: TransactionInstruction[] = [];

    if (!tokenAccountInfo) {
      wrapInstructions.push(
        createAssociatedTokenAccountInstruction(
          signed.publicKey,
          userTokenAccount,
          signed.publicKey,
          NATIVE_MINT
        )
      );
    }

    wrapInstructions.push(
      SystemProgram.transfer({
        fromPubkey: signed.publicKey,
        toPubkey: userTokenAccount,
        lamports: amount_in_lamports,
      })
    );

    wrapInstructions.push(createSyncNativeInstruction(userTokenAccount));

    const wrapBlockhash = await connection.getLatestBlockhash();
    const wrapTxMsg = new TransactionMessage({
      payerKey: signed.publicKey,
      recentBlockhash: wrapBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
        ...wrapInstructions,
      ],
    }).compileToV0Message();

    transactions.push(new VersionedTransaction(wrapTxMsg));
  }

  const depositTx = await buildDepositInstruction(
    program,
    proofToSubmit,
    extData,
    signed.publicKey,
    new PublicKey(mintAddress)
  );

  const depositBlockhash = await connection.getLatestBlockhash();

  let lookupTableAccounts = [];
  const lookupTableAccount = await connection.getAddressLookupTable(
    ALT_ADDRESS
  );
  if (!lookupTableAccount.value) {
    throw new Error(`ALT not found: ${ALT_ADDRESS.toString()}`);
  }
  lookupTableAccounts.push(lookupTableAccount.value);

  const depositTxMsg = new TransactionMessage({
    payerKey: signed.publicKey,
    recentBlockhash: depositBlockhash.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
      ...depositTx,
    ],
  }).compileToV0Message(lookupTableAccounts);

  transactions.push(new VersionedTransaction(depositTxMsg));

  if (isNativeMint) {
    const closeInstructions: TransactionInstruction[] = [
      createCloseAccountInstruction(
        userTokenAccount,
        signed.publicKey,
        signed.publicKey
      ),
    ];

    const closeBlockhash = await connection.getLatestBlockhash();
    const closeTxMsg = new TransactionMessage({
      payerKey: signed.publicKey,
      recentBlockhash: closeBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
        ...closeInstructions,
      ],
    }).compileToV0Message();

    transactions.push(new VersionedTransaction(closeTxMsg));
  }

  const signedTransactions = await signAllTransactions(transactions);

  const signatures: string[] = [];
  for (let i = 0; i < signedTransactions.length; i++) {
    const txType = isNativeMint
      ? i === 0
        ? "wrap"
        : i === 1
          ? "deposit"
          : "close"
      : "deposit";

    setStatus?.(`(sending ${txType} transaction...)`);

    const signature = await connection.sendTransaction(signedTransactions[i], {
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(signature, "confirmed");

    signatures.push(signature);
  }

  return signatures[isNativeMint ? 1 : 0];
}

