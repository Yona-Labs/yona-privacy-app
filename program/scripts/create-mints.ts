import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";

async function createTestMints() {
  try {
    // Get cluster from command line args or use localnet
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f"

    console.log(`\n🪙 Creating test mints on devnet...\n`);

    // Load wallet
    const walletPath = path.resolve(__dirname, "../admin.json");
    if (!fs.existsSync(walletPath)) {
      console.error("❌ Wallet file not found at:", walletPath);
      console.log("Please create owner.json with your keypair");
      process.exit(1);
    }

    const payer = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );

    console.log("👛 Payer:", payer.publicKey.toString());

    // Setup connection
    const connection = new Connection(rpcUrl, "confirmed");

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log("💰 Balance:", balance / LAMPORTS_PER_SOL, "SOL");

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      console.error("❌ Insufficient balance. Need at least 0.1 SOL");
      process.exit(1);
    }

    // Create Token A
    console.log("\n🔨 Creating Token A (USDC-like)...");
    const mintA = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      6 // 6 decimals like USDC
    );
    console.log("✅ Token A Mint:", mintA.toString());

    // Create Token B  
    console.log("\n🔨 Creating Token B (SOL-wrapped like)...");
    const mintB = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      9 // 9 decimals like SOL
    );
    console.log("✅ Token B Mint:", mintB.toString());

    // Create Token C
    console.log("\n🔨 Creating Token C (Custom token)...");
    const mintC = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      9 // 9 decimals
    );
    console.log("✅ Token C Mint:", mintC.toString());

    // Create associated token accounts and mint tokens
    console.log("\n💰 Minting tokens to wallet...");
    
    // Mint Token A
    const tokenAccountA = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintA,
      payer.publicKey
    );
    await mintTo(
      connection,
      payer,
      mintA,
      tokenAccountA.address,
      payer,
      1000000 * 10 ** 6 // 1,000,000 tokens with 6 decimals
    );
    console.log("  Token A:", tokenAccountA.address.toString());
    console.log("    Minted: 1,000,000 tokens");

    // Mint Token B
    const tokenAccountB = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintB,
      payer.publicKey
    );
    await mintTo(
      connection,
      payer,
      mintB,
      tokenAccountB.address,
      payer,
      1000000 * 10 ** 9 // 1,000,000 tokens with 9 decimals
    );
    console.log("  Token B:", tokenAccountB.address.toString());
    console.log("    Minted: 1,000,000 tokens");

    // Mint Token C
    const tokenAccountC = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintC,
      payer.publicKey
    );
    await mintTo(
      connection,
      payer,
      mintC,
      tokenAccountC.address,
      payer,
      1000000 * 10 ** 9 // 1,000,000 tokens with 9 decimals
    );
    console.log("  Token C:", tokenAccountC.address.toString());
    console.log("    Minted: 1,000,000 tokens");

    // Save mints to file
    const mintsData = {
      mintA: mintA.toString(),
      mintB: mintB.toString(),
      mintC: mintC.toString(),
      tokenAccountA: tokenAccountA.address.toString(),
      tokenAccountB: tokenAccountB.address.toString(),
      tokenAccountC: tokenAccountC.address.toString(),
      timestamp: new Date().toISOString(),
    };

    const outputPath = path.resolve(__dirname, "../test-mints.json");
    fs.writeFileSync(outputPath, JSON.stringify(mintsData, null, 2));
    console.log("\n💾 Mints saved to:", outputPath);

    console.log("\n🎉 Test mints created successfully!");
    console.log("\n📋 Summary:");
    console.log("  Token A (6 decimals):", mintA.toString());
    console.log("  Token B (9 decimals):", mintB.toString());
    console.log("  Token C (9 decimals):", mintC.toString());
    console.log("\n💡 Use these mint addresses in your tests");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

createTestMints();

