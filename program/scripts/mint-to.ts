// import {
//   Connection,
//   Keypair,
//   PublicKey,
//   LAMPORTS_PER_SOL,
// } from "@solana/web3.js";
// import {
//   mintTo,
//   getOrCreateAssociatedTokenAccount,
// } from "@solana/spl-token";
// import fs from "fs";
// import path from "path";

// async function mintTokens() {
//   try {
//     // Get cluster from command line args or use devnet
//     const rpcUrl =
//       "https://devnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f";

//     console.log(`\n💰 Minting tokens on devnet...\n`);

//     // Load wallet (mint authority)
//     const walletPath = path.resolve(__dirname, "../admin.json");
//     if (!fs.existsSync(walletPath)) {
//       console.error("❌ Wallet file not found at:", walletPath);
//       console.log("Please create admin.json with your keypair");
//       process.exit(1);
//     }

//     const payer = Keypair.fromSecretKey(
//       new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
//     );

//     console.log("👛 Mint Authority:", payer.publicKey.toString());

//     // Setup connection
//     const connection = new Connection(rpcUrl, "confirmed");

//     // Check balance
//     const balance = await connection.getBalance(payer.publicKey);
//     console.log("💰 Balance:", balance / LAMPORTS_PER_SOL, "SOL");

//     if (balance < 0.01 * LAMPORTS_PER_SOL) {
//       console.error("❌ Insufficient balance. Need at least 0.01 SOL");
//       process.exit(1);
//     }

//     // Load mints from file
//     const mintsPath = path.resolve(__dirname, "../test-mints.json");
//     if (!fs.existsSync(mintsPath)) {
//       console.error("❌ Mints file not found at:", mintsPath);
//       console.log("Please run 'yarn cli:mints' first to create test mints");
//       process.exit(1);
//     }

//     const mintsData = JSON.parse(fs.readFileSync(mintsPath, "utf-8"));
//     const mintA = new PublicKey(mintsData.mintA);
//     const mintB = new PublicKey(mintsData.mintB);
//     const mintC = new PublicKey(mintsData.mintC);

//     console.log("\n🪙 Token Mints:");
//     console.log("  Token A (6 decimals):", mintA.toString());
//     console.log("  Token B (9 decimals):", mintB.toString());
//     console.log("  Token C (9 decimals):", mintC.toString());

//     // Get recipient from command line args or use payer
//     let recipient = payer.publicKey;
//     const args = process.argv.slice(2);
    
//     if (args.length > 0) {
//       try {
//         recipient = new PublicKey(args[0]);
//         console.log("\n🎯 Recipient:", recipient.toString());
//       } catch (e) {
//         console.error("❌ Invalid recipient address:", args[0]);
//         process.exit(1);
//       }
//     } else {
//       console.log("\n🎯 Recipient (default to mint authority):", recipient.toString());
//       console.log("💡 Usage: yarn cli:mint-to <recipient_address> [tokenA_amount] [tokenB_amount] [tokenC_amount]");
//     }

//     // Get amounts from command line args or use defaults
//     const amountA = args.length > 1 ? parseInt(args[1]) : 10000;
//     const amountB = args.length > 2 ? parseInt(args[2]) : 10000;
//     const amountC = args.length > 3 ? parseInt(args[3]) : 10000;

//     console.log("\n📊 Amounts to mint:");
//     console.log("  Token A:", amountA.toLocaleString(), "tokens");
//     console.log("  Token B:", amountB.toLocaleString(), "tokens");
//     console.log("  Token C:", amountC.toLocaleString(), "tokens");

//     // Mint Token A
//     if (amountA > 0) {
//       console.log("\n⚙️  Minting Token A...");
//       const tokenAccountA = await getOrCreateAssociatedTokenAccount(
//         connection,
//         payer,
//         mintA,
//         recipient
//       );
      
//       const balanceBefore = await connection.getTokenAccountBalance(tokenAccountA.address);
      
//       await mintTo(
//         connection,
//         payer,
//         mintA,
//         tokenAccountA.address,
//         payer,
//         amountA * 10 ** 6 // 6 decimals
//       );
      
//       const balanceAfter = await connection.getTokenAccountBalance(tokenAccountA.address);
      
//       console.log("  ✅ Token A minted");
//       console.log("    Account:", tokenAccountA.address.toString());
//       console.log("    Balance before:", balanceBefore.value.uiAmountString);
//       console.log("    Balance after:", balanceAfter.value.uiAmountString);
//     }

//     // Mint Token B
//     if (amountB > 0) {
//       console.log("\n⚙️  Minting Token B...");
//       const tokenAccountB = await getOrCreateAssociatedTokenAccount(
//         connection,
//         payer,
//         mintB,
//         recipient
//       );
      
//       const balanceBefore = await connection.getTokenAccountBalance(tokenAccountB.address);
      
//       await mintTo(
//         connection,
//         payer,
//         mintB,
//         tokenAccountB.address,
//         payer,
//         amountB * 10 ** 9 // 9 decimals
//       );
      
//       const balanceAfter = await connection.getTokenAccountBalance(tokenAccountB.address);
      
//       console.log("  ✅ Token B minted");
//       console.log("    Account:", tokenAccountB.address.toString());
//       console.log("    Balance before:", balanceBefore.value.uiAmountString);
//       console.log("    Balance after:", balanceAfter.value.uiAmountString);
//     }

//     // Mint Token C
//     if (amountC > 0) {
//       console.log("\n⚙️  Minting Token C...");
//       const tokenAccountC = await getOrCreateAssociatedTokenAccount(
//         connection,
//         payer,
//         mintC,
//         recipient
//       );
      
//       const balanceBefore = await connection.getTokenAccountBalance(tokenAccountC.address);
      
//       await mintTo(
//         connection,
//         payer,
//         mintC,
//         tokenAccountC.address,
//         payer,
//         amountC * 10 ** 9 // 9 decimals
//       );
      
//       const balanceAfter = await connection.getTokenAccountBalance(tokenAccountC.address);
      
//       console.log("  ✅ Token C minted");
//       console.log("    Account:", tokenAccountC.address.toString());
//       console.log("    Balance before:", balanceBefore.value.uiAmountString);
//       console.log("    Balance after:", balanceAfter.value.uiAmountString);
//     }

//     console.log("\n🎉 Tokens minted successfully!");
//     console.log("\n📋 Summary:");
//     console.log("  Recipient:", recipient.toString());
//     console.log("  Token A minted:", amountA.toLocaleString());
//     console.log("  Token B minted:", amountB.toLocaleString());
//     console.log("  Token C minted:", amountC.toLocaleString());
    
//   } catch (error) {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   }
// }

// mintTokens();


