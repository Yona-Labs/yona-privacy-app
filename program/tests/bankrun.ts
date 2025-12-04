import { setProvider, Program, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { calculateDepositFee, calculateWithdrawalFee } from "./lib/math";
import { ProgramTestContext, BanksClient, startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";
import {
  PublicKey,
  Transaction,
  Keypair,
  Connection,
  clusterApiUrl,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Zkcash } from "../target/types/zkcash";
import { LightWasm, WasmFactory } from "@lightprotocol/hasher.rs";
import { MerkleTree } from "./lib/merkle_tree";
import { buildDepositInstruction, buildWithdrawInstruction, buildSwapInstruction, executeInitialize, sendBankrunTransaction, startSetupBankrun, createAtaBankrun, transferTokenBankrun } from "./instructions";
import { Utxo } from "./lib/utxo";
import { DEFAULT_HEIGHT, FIELD_SIZE, ROOT_HISTORY_SIZE, ZERO_BYTES, DEPOSIT_FEE_RATE, WITHDRAW_FEE_RATE } from "./lib/constants";
import { getExtDataHash, getSwapExtDataHash, publicKeyToFieldElement } from "./lib/utils";
import { parseProofToBytesArray, parseToBytesArray, prove } from "./lib/prover";
import { findCommitmentPDAs, findGlobalConfigPDA, findNullifierPDAs, findTreeTokenAccountPDA } from "./lib/derive";
import path from "path";
import { createMint } from "./lib/token";
import { createGlobalTestALT, createVersionedTransactionWithALT, getTestProtocolAddresses } from "./lib/test_alt";
import { ExtData, ProofToSubmit, ProofInput, SwapData } from "./lib/types";

describe("bankrun", () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Zkcash>;
  let banksClient: BanksClient;
  let admin: Keypair;
  let mintAddressA: PublicKey;
  let mintAddressB: PublicKey;
  let lightWasm: LightWasm;
  let globalMerkleTree: MerkleTree;
  let recipient: Keypair;
  let feeRecipient: Keypair;
  let globalConfig: PublicKey;
  let depositedUtxo: Utxo; // Store the deposited UTXO for withdraw test
  let depositedUtxoMintB: Utxo; // Store the deposited UTXO for swap test
  let withdrawOutputUtxo: Utxo; // Store the output from withdraw for swap test
  const keyBasePath = path.resolve(__dirname, '../../circuits2/artifacts/transaction2_js/transaction2');


  before(async () => {
    context = await startAnchor("", [{ name: "zkcash", programId: new PublicKey("6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx") }], []);
    
    const wallet = new anchor.Wallet(context.payer);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    lightWasm = await WasmFactory.getInstance();
    globalMerkleTree = new MerkleTree(DEFAULT_HEIGHT, lightWasm);

    program = anchor.workspace.Zkcash as Program<Zkcash>;
    banksClient = context.banksClient;
    admin = context.payer;

    recipient = anchor.web3.Keypair.generate();
    feeRecipient = anchor.web3.Keypair.generate();

    const setupResult = await startSetupBankrun(program, admin, banksClient, context, recipient, feeRecipient);
    mintAddressA = setupResult.mintAddressA;
    mintAddressB = setupResult.mintAddressB;
    globalConfig = findGlobalConfigPDA(program.programId)[0];
  });


  it("Deposit", async () => {
    const depositAmount = 1000;
    const depositFee = new anchor.BN(calculateDepositFee(depositAmount));

    const depositExtData: ExtData = {
      recipient: getAssociatedTokenAddressSync(mintAddressA, globalConfig, true),
      extAmount: new anchor.BN(depositAmount),
      encryptedOutput1: Buffer.from("depositEncryptedOutput1"),
      encryptedOutput2: Buffer.from("depositEncryptedOutput2"),
      fee: depositFee,
      feeRecipient: feeRecipient.publicKey,
      mintAddressA: mintAddressA,
      mintAddressB: mintAddressA,
    };

    const depositInputs = [
      new Utxo({ lightWasm, mintAddress: publicKeyToFieldElement(mintAddressA) }),
      new Utxo({ lightWasm, mintAddress: publicKeyToFieldElement(mintAddressA) })
    ];


    const publicAmount = depositExtData.extAmount.sub(depositFee);
    const publicAmountNumber = publicAmount.add(FIELD_SIZE).mod(FIELD_SIZE);
    const outputAmount = publicAmountNumber.toString();

    const depositOutputs = [
      new Utxo({
        lightWasm,
        amount: outputAmount,
        index: globalMerkleTree._layers[0].length,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      }),
      new Utxo({
        lightWasm,
        amount: 0,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      })
    ];

    const depositInputMerklePathIndices = depositInputs.map(() => 0);
    const depositInputMerklePathElements = depositInputs.map(() => {
      return [...new Array(globalMerkleTree.levels).fill(0)];
    });
    const depositInputNullifiers = await Promise.all(depositInputs.map(x => x.getNullifier()));
    const depositOutputCommitments = await Promise.all(depositOutputs.map(x => x.getCommitment()));
    const depositRoot = globalMerkleTree.root();
    const depositExtDataHash = getExtDataHash(depositExtData);

    const depositInput: ProofInput = {
      root: depositRoot,
      inputNullifier: depositInputNullifiers,
      outputCommitment: depositOutputCommitments,
      publicAmount0: publicAmountNumber.toString(),
      publicAmount1: "0",
      extDataHash: depositExtDataHash,
      mintAddress0: publicKeyToFieldElement(mintAddressA),
      mintAddress1: publicKeyToFieldElement(mintAddressA),
      inAmount: depositInputs.map(x => x.amount.toString(10)),
      inMintAddress: depositInputs.map(x => x.mintAddress),
      inPrivateKey: depositInputs.map(x => x.keypair.privkey),
      inBlinding: depositInputs.map(x => x.blinding.toString(10)),
      inPathIndices: depositInputMerklePathIndices,
      inPathElements: depositInputMerklePathElements,
      outAmount: depositOutputs.map(x => x.amount.toString(10)),
      outMintAddress: depositOutputs.map(x => x.mintAddress),
      outPubkey: depositOutputs.map(x => x.keypair.pubkey),
      outBlinding: depositOutputs.map(x => x.blinding.toString(10)),
    };


    const depositProofResult = await prove(depositInput, keyBasePath);
    const depositProofInBytes = parseProofToBytesArray(depositProofResult.proof);
    const depositInputsInBytes = parseToBytesArray(depositProofResult.publicSignals);

    const depositProofToSubmit: ProofToSubmit = {
      proofA: depositProofInBytes.proofA,
      proofB: depositProofInBytes.proofB.flat(),
      proofC: depositProofInBytes.proofC,
      root: depositInputsInBytes[0],
      publicAmount0: depositInputsInBytes[1],
      publicAmount1: depositInputsInBytes[2],
      extDataHash: depositInputsInBytes[3],
      inputNullifiers: [depositInputsInBytes[6], depositInputsInBytes[7]],
      outputCommitments: [depositInputsInBytes[8], depositInputsInBytes[9]],
    };


    const depositTx = await buildDepositInstruction(program, depositProofToSubmit, depositExtData, admin.publicKey, mintAddressA);
    await sendBankrunTransaction(
      banksClient,
      depositTx,
      admin,
      [],
      1000000
    );
    for (const commitment of depositOutputCommitments) {
      globalMerkleTree.insert(commitment);
    }

    depositedUtxo = depositOutputs[0];
    console.log("depositedUtxo: ", depositedUtxo);
  });

  it("Withdraw", async () => {
    const withdrawalAmount = 500; // Withdraw 500 tokens 
    const withdrawalFee = new anchor.BN(calculateWithdrawalFee(withdrawalAmount)); // Fee based on withdrawal amount

    await createAtaBankrun(banksClient, admin, recipient.publicKey, mintAddressA); 
    const withdrawExtData: ExtData = {
      recipient: getAssociatedTokenAddressSync(
        mintAddressA,
        recipient.publicKey
      ),
      extAmount: new anchor.BN(-withdrawalAmount),
      encryptedOutput1: Buffer.from("withdrawEncryptedOutput1"),
      encryptedOutput2: Buffer.from("withdrawEncryptedOutput2"),
      fee: withdrawalFee,
      feeRecipient: feeRecipient.publicKey,
      mintAddressA: mintAddressA,
      mintAddressB: mintAddressA,
    };

    const withdrawInputs = [
      depositedUtxo,
      new Utxo({ lightWasm, mintAddress: publicKeyToFieldElement(mintAddressA) }),
    ];

    const inputsSum = withdrawInputs.reduce((sum, x) => sum.add(x.amount), new anchor.BN(0));
    console.log("inputsSum: ", inputsSum.toString());
    // publicAmount = extAmount - fee (for withdrawals, extAmount is negative)
    // For the circuit: sumIns + publicAmount = sumOuts
    // sumIns = input amount, sumOuts = remaining amount
    // input amount + publicAmount = remaining amount
    // publicAmount = remaining amount - input amount = -withdrawalAmount - fee
    const publicAmount0 = new anchor.BN(-withdrawalAmount).sub(withdrawalFee).add(FIELD_SIZE).mod(FIELD_SIZE);

    const remainingAmount = inputsSum.sub(new anchor.BN(withdrawalAmount)).sub(withdrawalFee);

    const withdrawOutputs = [
      new Utxo({
        lightWasm,
        amount: remainingAmount.toString(),
        index: globalMerkleTree._layers[0].length,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      }),
      new Utxo({
        lightWasm,
        amount: 0,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      })
    ];

    const withdrawInputMerklePathIndices = [];
    const withdrawInputMerklePathElements = [];

    for (let i = 0; i < withdrawInputs.length; i++) {
      const input = withdrawInputs[i];
      if (input.amount.gt(new anchor.BN(0))) {
        // Find the commitment in the tree
        const commitment = await input.getCommitment();
        input.index = globalMerkleTree.indexOf(commitment);
        if (input.index === -1) {
          input.index = 0;
        }
        withdrawInputMerklePathIndices.push(input.index);
        withdrawInputMerklePathElements.push(globalMerkleTree.path(input.index).pathElements);
      } else {
        withdrawInputMerklePathIndices.push(0);
        withdrawInputMerklePathElements.push(new Array(globalMerkleTree.levels).fill(0));
      }
    }

    const withdrawInputNullifiers = await Promise.all(withdrawInputs.map(x => x.getNullifier()));
    const withdrawOutputCommitments = await Promise.all(withdrawOutputs.map(x => x.getCommitment()));

    const withdrawRoot = globalMerkleTree.root();
    const withdrawExtDataHash = getExtDataHash(withdrawExtData);

    const withdrawInput: ProofInput = {
      root: withdrawRoot,
      inputNullifier: withdrawInputNullifiers,
      outputCommitment: withdrawOutputCommitments,
      publicAmount0: publicAmount0.toString(),
      publicAmount1: "0",
      extDataHash: withdrawExtDataHash,
      mintAddress0: publicKeyToFieldElement(mintAddressA),
      mintAddress1: publicKeyToFieldElement(mintAddressA),
      inAmount: withdrawInputs.map(x => x.amount.toString(10)),
      inMintAddress: withdrawInputs.map(x => x.mintAddress),
      inPrivateKey: withdrawInputs.map(x => x.keypair.privkey),
      inBlinding: withdrawInputs.map(x => x.blinding.toString(10)),
      inPathIndices: withdrawInputMerklePathIndices,
      inPathElements: withdrawInputMerklePathElements,
      outAmount: withdrawOutputs.map(x => x.amount.toString(10)),
      outMintAddress: withdrawOutputs.map(x => x.mintAddress),
      outPubkey: withdrawOutputs.map(x => x.keypair.pubkey),
      outBlinding: withdrawOutputs.map(x => x.blinding.toString(10)),
    };

    const withdrawProofResult = await prove(withdrawInput, keyBasePath);
    const withdrawProofInBytes = parseProofToBytesArray(withdrawProofResult.proof);
    const withdrawInputsInBytes = parseToBytesArray(withdrawProofResult.publicSignals);

    const withdrawProofToSubmit: ProofToSubmit = {
      proofA: withdrawProofInBytes.proofA,
      proofB: withdrawProofInBytes.proofB.flat(),
      proofC: withdrawProofInBytes.proofC,
      root: withdrawInputsInBytes[0],
      publicAmount0: withdrawInputsInBytes[1],
      publicAmount1: withdrawInputsInBytes[2],
      extDataHash: withdrawInputsInBytes[3],
      inputNullifiers: [withdrawInputsInBytes[6], withdrawInputsInBytes[7]],
      outputCommitments: [withdrawInputsInBytes[8], withdrawInputsInBytes[9]],
    };

    const withdrawTx = await buildWithdrawInstruction(program, withdrawProofToSubmit, withdrawExtData, admin.publicKey, mintAddressA);
    const withdrawVersionedTx = await sendBankrunTransaction(
      banksClient,
      withdrawTx,
      admin,
      [],
      1000000
    );

    for (const commitment of withdrawOutputCommitments) {
      globalMerkleTree.insert(commitment);
    }

    // Save the remaining UTXO for swap test
    withdrawOutputUtxo = withdrawOutputs[0];

    console.log("Withdraw successful");
    console.log("withdrawOutputUtxo: ", withdrawOutputUtxo.amount.toString());
  });

  it("Deposit with existing UTXO (top-up)", async () => {
    // Add 300 tokens to the existing UTXO from withdraw test
    const topUpAmount = 300;
    const topUpFee = new anchor.BN(calculateDepositFee(topUpAmount));

    const topUpExtData: ExtData = {
      recipient: getAssociatedTokenAddressSync(mintAddressA, globalConfig, true),
      extAmount: new anchor.BN(topUpAmount),
      encryptedOutput1: Buffer.from("topUpEncryptedOutput1"),
      encryptedOutput2: Buffer.from("topUpEncryptedOutput2"),
      fee: topUpFee,
      feeRecipient: feeRecipient.publicKey,
      mintAddressA: mintAddressA,
      mintAddressB: mintAddressA,
    };

    // Use existing UTXO from withdraw + dummy
    const topUpInputs = [
      withdrawOutputUtxo, // Existing UTXO with remaining balance
      new Utxo({ lightWasm, mintAddress: publicKeyToFieldElement(mintAddressA) }) // Dummy
    ];

    const inputsSum = topUpInputs.reduce((sum, x) => sum.add(x.amount), new anchor.BN(0));
    console.log("Existing UTXO amount: ", withdrawOutputUtxo.amount.toString());
    console.log("Top-up amount: ", topUpAmount);
    console.log("Fee: ", topUpFee.toString());

    // publicAmount = topUpAmount - fee
    const publicAmount = new anchor.BN(topUpAmount).sub(topUpFee);
    const publicAmountNumber = publicAmount.add(FIELD_SIZE).mod(FIELD_SIZE);

    // Total output = existing UTXO + new deposit - fee
    const totalOutputAmount = inputsSum.add(publicAmount);
    console.log("Total output amount: ", totalOutputAmount.toString());

    const topUpOutputs = [
      new Utxo({
        lightWasm,
        amount: totalOutputAmount.toString(),
        index: globalMerkleTree._layers[0].length,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      }),
      new Utxo({
        lightWasm,
        amount: 0,
        mintAddress: publicKeyToFieldElement(mintAddressA)
      })
    ];

    // Get Merkle proof for existing UTXO
    const topUpInputMerklePathIndices = [];
    const topUpInputMerklePathElements = [];

    for (let i = 0; i < topUpInputs.length; i++) {
      const input = topUpInputs[i];
      if (input.amount.gt(new anchor.BN(0))) {
        const commitment = await input.getCommitment();
        input.index = globalMerkleTree.indexOf(commitment);
        if (input.index === -1) {
          throw new Error(`UTXO commitment not found in tree: ${commitment}`);
        }
        topUpInputMerklePathIndices.push(input.index);
        topUpInputMerklePathElements.push(globalMerkleTree.path(input.index).pathElements);
      } else {
        topUpInputMerklePathIndices.push(0);
        topUpInputMerklePathElements.push(new Array(globalMerkleTree.levels).fill(0));
      }
    }

    const topUpInputNullifiers = await Promise.all(topUpInputs.map(x => x.getNullifier()));
    const topUpOutputCommitments = await Promise.all(topUpOutputs.map(x => x.getCommitment()));
    const topUpRoot = globalMerkleTree.root();
    const topUpExtDataHash = getExtDataHash(topUpExtData);

    console.log("Balance equation check:");
    console.log(`  Input sum: ${inputsSum.toString()}`);
    console.log(`  Public amount: ${publicAmountNumber.toString()}`);
    console.log(`  Output sum: ${totalOutputAmount.toString()}`);
    console.log(`  Equation: ${inputsSum.toString()} + ${publicAmountNumber.toString()} = ${totalOutputAmount.toString()}`);

    const topUpInput: ProofInput = {
      root: topUpRoot,
      inputNullifier: topUpInputNullifiers,
      outputCommitment: topUpOutputCommitments,
      publicAmount0: publicAmountNumber.toString(),
      publicAmount1: "0",
      extDataHash: topUpExtDataHash,
      mintAddress0: publicKeyToFieldElement(mintAddressA),
      mintAddress1: publicKeyToFieldElement(mintAddressA),
      inAmount: topUpInputs.map(x => x.amount.toString(10)),
      inMintAddress: topUpInputs.map(x => x.mintAddress),
      inPrivateKey: topUpInputs.map(x => x.keypair.privkey),
      inBlinding: topUpInputs.map(x => x.blinding.toString(10)),
      inPathIndices: topUpInputMerklePathIndices,
      inPathElements: topUpInputMerklePathElements,
      outAmount: topUpOutputs.map(x => x.amount.toString(10)),
      outMintAddress: topUpOutputs.map(x => x.mintAddress),
      outPubkey: topUpOutputs.map(x => x.keypair.pubkey),
      outBlinding: topUpOutputs.map(x => x.blinding.toString(10)),
    };

    // Verify all mint addresses are the same
    console.log("Mint address validation:");
    console.log(`  mintAddress0: ${topUpInput.mintAddress0}`);
    console.log(`  mintAddress1: ${topUpInput.mintAddress1}`);
    console.log(`  inMintAddress[0]: ${topUpInput.inMintAddress[0]}`);
    console.log(`  inMintAddress[1]: ${topUpInput.inMintAddress[1]}`);
    console.log(`  outMintAddress[0]: ${topUpInput.outMintAddress[0]}`);
    console.log(`  outMintAddress[1]: ${topUpInput.outMintAddress[1]}`);

    const topUpProofResult = await prove(topUpInput, keyBasePath);
    const topUpProofInBytes = parseProofToBytesArray(topUpProofResult.proof);
    const topUpInputsInBytes = parseToBytesArray(topUpProofResult.publicSignals);

    const topUpProofToSubmit: ProofToSubmit = {
      proofA: topUpProofInBytes.proofA,
      proofB: topUpProofInBytes.proofB.flat(),
      proofC: topUpProofInBytes.proofC,
      root: topUpInputsInBytes[0],
      publicAmount0: topUpInputsInBytes[1],
      publicAmount1: topUpInputsInBytes[2],
      extDataHash: topUpInputsInBytes[3],
      inputNullifiers: [topUpInputsInBytes[6], topUpInputsInBytes[7]],
      outputCommitments: [topUpInputsInBytes[8], topUpInputsInBytes[9]],
    };

    const topUpTx = await buildDepositInstruction(program, topUpProofToSubmit, topUpExtData, admin.publicKey, mintAddressA);
    await sendBankrunTransaction(
      banksClient,
      topUpTx,
      admin,
      [],
      1000000
    );

    for (const commitment of topUpOutputCommitments) {
      globalMerkleTree.insert(commitment);
    }

    console.log("Top-up successful!");
    console.log(`Previous balance: ${withdrawOutputUtxo.amount.toString()}`);
    console.log(`Added: ${publicAmount.toString()}`);
    console.log(`New balance: ${totalOutputAmount.toString()}`);
  });


  // it("Swap mintA to mintB", async () => {
  //   await transferTokenBankrun(banksClient, admin, globalConfig, mintAddressB, 1000);
  //   // Use the UTXO from withdraw test (not the original deposited one, which is already spent)
  //   const targetUtxoMintA = withdrawOutputUtxo;

  //   const swapAmountIn = 200; // Swap 200 tokens from mintA to mintB 
  //   const swapMinAmountOut = 100; // TODO
  //   const swapFee = new anchor.BN(0); // No fee for pure swap (extAmount = 0)

  //   const reserveTokenAccountOutput = getAssociatedTokenAddressSync(
  //     mintAddressB,
  //     globalConfig,
  //     true
  //   );

  //   const swapExtData: SwapData = {
  //     recipient: reserveTokenAccountOutput,
  //     extAmount: new anchor.BN(-swapAmountIn), // Pure swap, no deposit/withdrawal
  //     extMinAmountOut: new anchor.BN(swapMinAmountOut), // TODO
  //     encryptedOutput1: Buffer.from("swapEncryptedOutput1"),
  //     encryptedOutput2: Buffer.from("swapEncryptedOutput2"),
  //     fee: swapFee,
  //     feeRecipient: feeRecipient.publicKey,
  //     mintAddressA: mintAddressA,
  //     mintAddressB: mintAddressB,
  //   };

  //   const swapInputs = [
  //     targetUtxoMintA,
  //     new Utxo({ lightWasm, mintAddress: publicKeyToFieldElement(mintAddressB) })
  //   ];

  //   const inputsSum = swapInputs.reduce((sum, x) => sum.add(x.amount), new anchor.BN(0));

  //   // For swap with different mints:
  //   // mintA: inSum = 1000, outSum = 800 (remaining), publicAmount0 = 800 - 1000 = -200
  //   // mintB: inSum = 0, outSum = 100 (swapped), publicAmount1 = 100 - 0 = 100
  //   // So: publicAmount0 = -(swapAmountIn + fee), publicAmount1 = +swapMinAmountOut
  //   const publicAmount0 = new anchor.BN(-swapAmountIn).sub(swapFee).add(FIELD_SIZE).mod(FIELD_SIZE);
  //   const publicAmount1 = new anchor.BN(swapMinAmountOut).add(FIELD_SIZE).mod(FIELD_SIZE);

  //   // Calculate actual output amounts
  //   const remainingAmountMintA = inputsSum.sub(new anchor.BN(swapAmountIn)).sub(swapFee);
  //   const swappedAmountMintB = new anchor.BN(swapMinAmountOut);

  //   const swapOutputs = [
  //     new Utxo({
  //       lightWasm,
  //       amount: remainingAmountMintA.toString(),
  //       index: globalMerkleTree._layers[0].length,
  //       mintAddress: publicKeyToFieldElement(mintAddressA)
  //     }),
  //     new Utxo({
  //       lightWasm,
  //       amount: swappedAmountMintB.toString(),
  //       index: globalMerkleTree._layers[0].length + 1,
  //       mintAddress: publicKeyToFieldElement(mintAddressB)
  //     })
  //   ];

  //   const swapInputMerklePathIndices = [];
  //   const swapInputMerklePathElements = [];

  //   for (let i = 0; i < swapInputs.length; i++) {
  //     const input = swapInputs[i];
  //     if (input.amount.gt(new anchor.BN(0))) {
  //       const commitment = await input.getCommitment();
  //       input.index = globalMerkleTree.indexOf(commitment);
  //       if (input.index === -1) {
  //         input.index = 0;
  //       }
  //       swapInputMerklePathIndices.push(input.index);
  //       swapInputMerklePathElements.push(globalMerkleTree.path(input.index).pathElements);
  //     } else {
  //       swapInputMerklePathIndices.push(0);
  //       swapInputMerklePathElements.push(new Array(globalMerkleTree.levels).fill(0));
  //     }
  //   }

  //   const swapInputNullifiers = await Promise.all(swapInputs.map(x => x.getNullifier()));
  //   const swapOutputCommitments = await Promise.all(swapOutputs.map(x => x.getCommitment()));
  //   const swapRoot = globalMerkleTree.root();
  //   const swapExtDataHash = getSwapExtDataHash(swapExtData);

  //   const swapInput: ProofInput = {
  //     root: swapRoot,
  //     inputNullifier: swapInputNullifiers,
  //     outputCommitment: swapOutputCommitments,
  //     publicAmount0: publicAmount0.toString(),
  //     publicAmount1: publicAmount1.toString(),
  //     extDataHash: swapExtDataHash,
  //     mintAddress0: publicKeyToFieldElement(mintAddressA),
  //     mintAddress1: publicKeyToFieldElement(mintAddressB),
  //     inAmount: swapInputs.map(x => x.amount.toString(10)),
  //     inMintAddress: swapInputs.map(x => x.mintAddress),
  //     inPrivateKey: swapInputs.map(x => x.keypair.privkey),
  //     inBlinding: swapInputs.map(x => x.blinding.toString(10)),
  //     inPathIndices: swapInputMerklePathIndices,
  //     inPathElements: swapInputMerklePathElements,
  //     outAmount: swapOutputs.map(x => x.amount.toString(10)),
  //     outMintAddress: swapOutputs.map(x => x.mintAddress),
  //     outPubkey: swapOutputs.map(x => x.keypair.pubkey),
  //     outBlinding: swapOutputs.map(x => x.blinding.toString(10)),
  //   };

  //   const swapProofResult = await prove(swapInput, keyBasePath);
  //   const swapProofInBytes = parseProofToBytesArray(swapProofResult.proof);
  //   const swapInputsInBytes = parseToBytesArray(swapProofResult.publicSignals);

  //   const swapProofToSubmit: ProofToSubmit = {
  //     proofA: swapProofInBytes.proofA,
  //     proofB: swapProofInBytes.proofB.flat(),
  //     proofC: swapProofInBytes.proofC,
  //     root: swapInputsInBytes[0],
  //     publicAmount0: swapInputsInBytes[1],
  //     publicAmount1: swapInputsInBytes[2],
  //     extDataHash: swapInputsInBytes[3],
  //     inputNullifiers: [swapInputsInBytes[6], swapInputsInBytes[7]],
  //     outputCommitments: [swapInputsInBytes[8], swapInputsInBytes[9]],
  //   };

  //   const swapTx = await buildSwapInstruction(program, swapProofToSubmit, swapExtData, admin.publicKey, mintAddressA, mintAddressB);
    
  //   // Use legacy transaction for bankrun (doesn't support ALT)
  //   await sendBankrunTransaction(
  //     banksClient,
  //     swapTx,
  //     admin,
  //     [],
  //     1400000
  //   );

  //   for (const commitment of swapOutputCommitments) {
  //     globalMerkleTree.insert(commitment);
  //   }

  //   console.log("Swap successful - swapped mintA to mintB");
  // });

});

