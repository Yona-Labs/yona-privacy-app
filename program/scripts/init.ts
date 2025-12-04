import { setProvider, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
} from "@solana/web3.js";
import { Zkcash } from "../target/types/zkcash";
import fs from "fs";
import path from "path";

async function initialize() {
  try {
    // Get cluster from command line args or use localnet
    const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f"

    console.log(`\n🚀 Initializing ZKCash contract on mainnet...\n`);

    // Load wallet
    const walletPath = path.resolve(__dirname, "../keys/owner.json");
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Wallet file not found at:", walletPath);
      console.log("Please create keys/owner.json with your keypair");
      process.exit(1);
    }

    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );

    console.log("👛 Wallet:", walletKeypair.publicKey.toString());

    // Setup connection and provider
    const connection = new Connection(rpcUrl, "confirmed");
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    setProvider(provider);

    // Load program
    const program = anchor.workspace.Zkcash as Program<Zkcash>;
    console.log("📋 Program ID:", program.programId.toString());

    // Derive PDAs
    const [treeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("merkle_tree")],
      program.programId
    );
    const [treeTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("tree_token")],
      program.programId
    );
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );

    console.log("\n📍 PDAs:");
    console.log("  Tree Account:", treeAccount.toString());
    console.log("  Tree Token Account:", treeTokenAccount.toString());
    console.log("  Global Config:", globalConfig.toString());

    // Check wallet balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("\n💰 Wallet Balance:", balance / 1e9, "SOL");

    if (balance < 0.1 * 1e9) {
      console.error("❌ Insufficient balance. Need at least 0.1 SOL");
      process.exit(1);
    }

    // Check if already initialized
    try {
      const treeAccountInfo = await connection.getAccountInfo(treeAccount);
      if (treeAccountInfo) {
        console.log("\n⚠️  Contract already initialized!");
        console.log("Tree account already exists");
        process.exit(0);
      }
    } catch (e) {
      // Account doesn't exist, continue
    }

    // Initialize
    console.log("\n⚙️  Sending initialize transaction...");
    const tx = await program.methods
      .initialize()
      .accountsStrict({
        treeAccount,
        treeTokenAccount,
        globalConfig: globalConfig,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    console.log("✅ Transaction confirmed:", tx);
    console.log("\n🎉 ZKCash contract initialized successfully!");

    // Fetch and display config
    const globalConfigAccount = await program.account.globalConfig.fetch(globalConfig);
    console.log("\n📊 Global Configuration:");
    console.log("  Authority:", globalConfigAccount.authority.toString());
    console.log("  Deposit Fee Rate:", globalConfigAccount.depositFeeRate, "basis points (0%)");
    console.log("  Withdrawal Fee Rate:", globalConfigAccount.withdrawalFeeRate, "basis points (0.25%)");
    console.log("  Fee Error Margin:", globalConfigAccount.feeErrorMargin, "basis points (5%)");

    const treeAccountData = await program.account.merkleTreeAccount.fetch(treeAccount);
    console.log("\n🌳 Merkle Tree:");
    console.log("  Height:", treeAccountData.height);
    console.log("  Max Deposit Amount:", treeAccountData.maxDepositAmount.toString(), "lamports");
    console.log("  Root History Size:", treeAccountData.rootHistorySize);

    console.log("\n✨ Setup complete!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

initialize();

