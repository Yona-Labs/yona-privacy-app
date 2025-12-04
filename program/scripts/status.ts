import { setProvider, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
} from "@solana/web3.js";
import { Zkcash } from "../target/types/zkcash";
import fs from "fs";
import path from "path";

async function checkStatus() {
  try {
    // Get cluster from command line args or use localnet
    const cluster = process.argv[2] || "localnet";
    const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f";

    console.log(`\n📊 Checking ZKCash status on ${cluster}...\n`);

    // Load wallet
    const walletPath = path.resolve(__dirname, "../owner.json");
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Wallet file not found at:", walletPath);
      process.exit(1);
    }

    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );

    // Setup connection and provider
    const connection = new Connection(rpcUrl, "confirmed");
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    setProvider(provider);

    // Load program
    const program = anchor.workspace.Zkcash as Program<Zkcash>;

    // Derive PDAs
    const [treeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("merkle_tree")],
      program.programId
    );
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );

    console.log("╔═══════════════════════════════════════════╗");
    console.log("║   ZKCash Status Report                   ║");
    console.log("╚═══════════════════════════════════════════╝");

    // Check if initialized
    try {
      const treeAccountInfo = await connection.getAccountInfo(treeAccount);
      if (!treeAccountInfo) {
        console.log("\n❌ Contract NOT initialized");
        console.log("\n💡 Run: yarn cli:setup to initialize");
        process.exit(1);
      }

      console.log("\n✅ Contract Status: INITIALIZED");

      // Fetch config
      const globalConfigAccount = await program.account.globalConfig.fetch(globalConfig);
      const treeAccountData = await program.account.merkleTreeAccount.fetch(treeAccount);

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📋 Program Information");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Program ID:", program.programId.toString());
      console.log("  Cluster:", cluster);
      console.log("  RPC URL:", rpcUrl);

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📍 PDAs");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Tree Account:", treeAccount.toString());
      console.log("  Global Config:", globalConfig.toString());

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚙️  Global Configuration");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Authority:", globalConfigAccount.authority.toString());
      console.log("  Deposit Fee:", globalConfigAccount.depositFeeRate / 100, "%");
      console.log("  Withdrawal Fee:", globalConfigAccount.withdrawalFeeRate / 100, "%");
      console.log("  Fee Error Margin:", globalConfigAccount.feeErrorMargin / 100, "%");

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🌳 Merkle Tree");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Height:", treeAccountData.height);
      console.log("  Next Index:", treeAccountData.nextIndex);
      console.log("  Root Index:", treeAccountData.rootIndex);
      console.log("  Max Deposit:", (treeAccountData.maxDepositAmount.toNumber() / 1e9).toFixed(2), "SOL");
      console.log("  Root History Size:", treeAccountData.rootHistorySize);

      // Load test mints if available
      const mintsPath = path.resolve(__dirname, "../test-mints.json");
      if (fs.existsSync(mintsPath)) {
        const mints = JSON.parse(fs.readFileSync(mintsPath, "utf-8"));
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🪙 Test Mints");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("  Token A:", mints.mintA);
        console.log("  Token B:", mints.mintB);
        console.log("  Token C:", mints.mintC);
        console.log("\n  Created:", new Date(mints.timestamp).toLocaleString());
      }

      // Wallet balance
      const balance = await connection.getBalance(walletKeypair.publicKey);
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("👛 Wallet");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Address:", walletKeypair.publicKey.toString());
      console.log("  Balance:", (balance / 1e9).toFixed(4), "SOL");

      console.log("\n✨ All systems operational!\n");
    } catch (error) {
      console.error("\n❌ Error fetching status:", error.message);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

checkStatus();

