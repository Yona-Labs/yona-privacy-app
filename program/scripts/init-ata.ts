import { setProvider, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import { Zkcash } from "../target/types/zkcash";
import fs from "fs";
import path from "path";

async function initializeATA() {
  try {
    // Get cluster from command line args or use localnet
    const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f";

    console.log(`\n🔧 Initializing Associated Token Accounts (ATA) on devnet...\n`);

    // Load wallet
    const walletPath = path.resolve(__dirname, "../keys/relayer.json");
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Wallet file not found at:", walletPath);
      console.log("Please create admin.json with your keypair");
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

    // Derive global config PDA
    const globalConfig = new PublicKey("BySnWGpuT4KfXoeWTmraKCFitzfne4du1ZkpnTWGxTzv")
    console.log("📍 Global Config PDA:", globalConfig.toString());

    // Check if global config is initialized
    // try {
    //   await program.account.globalConfig.fetch(globalConfig);
    // } catch (e) {
    //   console.error("❌ Global config not initialized. Please run 'yarn cli:init' first");
    //   process.exit(1);
    // }

    // Load mints from array
    const mintsData = [
      "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS"
    ];


    const instructions = [];
    const atasToCreate = [];
    const ataData: any = {
      globalConfig: globalConfig.toString(),
      timestamp: new Date().toISOString(),
    };

    // Process each mint
    for (let i = 0; i < mintsData.length; i++) {
      const mint = mintsData[i];
      const mintName = mintsData[i];
      const ataAddress = getAssociatedTokenAddressSync(new PublicKey(mint), globalConfig, true);
      try {
        await connection.getAccountInfo(ataAddress);
      } catch (e) {
        console.error("❌ ATA not found:", e);
        process.exit(1);
      }
        instructions.push(
          createAssociatedTokenAccountInstruction(
            walletKeypair.publicKey,
            ataAddress,
            globalConfig,
            new PublicKey(mint)
          )
        );
      atasToCreate.push(mintName);
    }

    if (instructions.length === 0) {
      console.log("\n✅ All ATAs already exist! Nothing to do.");
      process.exit(0);
    }

    console.log(`\n⚙️  Creating ${instructions.length} ATAs: ${atasToCreate.join(", ")}...`);

    // Create transaction with all instructions
    const transaction = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair]
    );

    console.log("✅ Transaction confirmed:", signature);

    // Save ATA addresses to file
    const outputPath = path.resolve(__dirname, "../ata-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(ataData, null, 2));
    console.log("\n💾 ATA addresses saved to:", outputPath);

    console.log("\n🎉 Associated Token Accounts initialized successfully!");
    console.log("\n📋 Summary:");
    console.log("  Global Config:", globalConfig.toString());
    for (let i = 0; i < mintsData.length; i++) {
      const mintName = mintsData[i];
      const ataAddress = getAssociatedTokenAddressSync(new PublicKey(mintName), globalConfig, true);
      console.log(`  ${mintName} ATA:`, ataAddress.toString());
    }
    console.log("\n💡 These ATAs can now be used for deposits and swaps");

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

initializeATA();
