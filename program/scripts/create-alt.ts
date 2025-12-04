import { setProvider, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
    PublicKey,
    Keypair,
    Connection,
    SystemProgram,
    AddressLookupTableProgram,
    Transaction,
    sendAndConfirmTransaction,
    ComputeBudgetProgram,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
} from "@solana/spl-token";
import { Zkcash } from "../target/types/zkcash";
import fs from "fs";
import path from "path";

/**
 * Get all protocol addresses for the ALT
 * These are constant addresses used across all transactions
 */
function getProtocolAddresses(
    programId: PublicKey,
    authority: PublicKey,
    feeRecipient: PublicKey
): PublicKey[] {
    // Derive global config PDA
    const [globalConfigAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_config")],
        programId
    );

    // Derive tree accounts
    const [treeAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("merkle_tree")],
        programId
    );

    const [treeTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("tree_token")],
        programId
    );

    return [
        // Core program accounts (constant)
        programId,
        treeAccount,
        treeTokenAccount,
        globalConfigAccount,
        authority,
        feeRecipient,

        // System programs (constant)
        SystemProgram.programId,
        ComputeBudgetProgram.programId,
        TOKEN_PROGRAM_ID,
    ];
}

/**
 * Create a new Address Lookup Table
 */
async function createALT(
    connection: Connection,
    payer: Keypair,
    addresses: PublicKey[]
): Promise<PublicKey> {
    try {
        console.log("\n⚙️  Creating Address Lookup Table...");

        // Create the lookup table with a recent slot
        const recentSlot = await connection.getSlot("confirmed");

        let [lookupTableInst, lookupTableAddress] =
            AddressLookupTableProgram.createLookupTable({
                authority: payer.publicKey,
                payer: payer.publicKey,
                recentSlot: recentSlot,
            });

        const createALTTx = new Transaction().add(lookupTableInst);

        try {
            const sig = await sendAndConfirmTransaction(connection, createALTTx, [
                payer,
            ]);
            console.log("✅ ALT created, signature:", sig);
        } catch (error: any) {
            const isSlotTooOld =
                error.message?.includes("not a recent slot") ||
                error.transactionLogs?.some((log: string) =>
                    log.includes("not a recent slot")
                );

            if (isSlotTooOld) {
                console.log("⚠️  Slot too old, retrying with newer slot...");
                const newerSlot = await connection.getSlot("finalized");

                [lookupTableInst, lookupTableAddress] =
                    AddressLookupTableProgram.createLookupTable({
                        authority: payer.publicKey,
                        payer: payer.publicKey,
                        recentSlot: newerSlot,
                    });

                const retryCreateALTTx = new Transaction().add(lookupTableInst);
                const sig = await sendAndConfirmTransaction(
                    connection,
                    retryCreateALTTx,
                    [payer]
                );
                console.log("✅ ALT created on retry, signature:", sig);
            } else {
                throw error;
            }
        }

        console.log("📍 ALT Address:", lookupTableAddress.toString());

        // Wait a moment for the ALT to be available
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Add addresses to the lookup table in chunks
        console.log(
            `\n⚙️  Adding ${addresses.length} addresses to ALT in chunks...`
        );
        const chunkSize = 20;
        const addressChunks = [];
        for (let i = 0; i < addresses.length; i += chunkSize) {
            addressChunks.push(addresses.slice(i, i + chunkSize));
        }

        for (let i = 0; i < addressChunks.length; i++) {
            const chunk = addressChunks[i];

            const extendInstruction = AddressLookupTableProgram.extendLookupTable({
                payer: payer.publicKey,
                authority: payer.publicKey,
                lookupTable: lookupTableAddress,
                addresses: chunk,
            });

            const extendTx = new Transaction().add(extendInstruction);
            const sig = await sendAndConfirmTransaction(connection, extendTx, [
                payer,
            ]);

            console.log(
                `  ✅ Chunk ${i + 1}/${addressChunks.length} added (${chunk.length} addresses), signature: ${sig}`
            );

            // Small delay between chunks
            if (i < addressChunks.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        // Wait for all address additions to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify the ALT was created successfully
        const altAccount = await connection.getAddressLookupTable(
            lookupTableAddress
        );
        if (!altAccount.value) {
            throw new Error("Failed to fetch created ALT");
        }

        console.log(`\n✅ ALT created successfully with ${addresses.length} addresses`);

        return lookupTableAddress;
    } catch (error) {
        console.error("❌ Failed to create ALT:", error);
        throw error;
    }
}

async function createAddressLookupTable() {
    try {
        const rpcUrl =
            "https://mainnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f";


        const walletPath = path.resolve(__dirname, "../keys/relayer.json");
        if (!fs.existsSync(walletPath)) {
            console.error("❌ Wallet file not found at:", walletPath);
            console.log("Please create keys/relayer.json with your keypair");
            process.exit(1);
        }

        const walletKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
        );

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
        const [globalConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_config")],
            program.programId
        );

      
        const mintA = new PublicKey(NATIVE_MINT);
        const mintB = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const mintC = new PublicKey("A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS");

        console.log("\n🪙 Token Mints:");
        console.log("  Token A:", mintA.toString());
        console.log("  Token B:", mintB.toString());
        console.log("  Token C:", mintC.toString());

        // Check wallet balance
        const balance = await connection.getBalance(walletKeypair.publicKey);
        console.log("\n💰 Wallet Balance:", balance / 1e9, "SOL");

        if (balance < 0.1 * 1e9) {
            console.error("❌ Insufficient balance. Need at least 0.1 SOL");
            process.exit(1);
        }

        // Load fee recipient (or use admin as default)
        let feeRecipient = walletKeypair.publicKey;
        const feeRecipientPath = path.resolve(__dirname, "../relayer.json");
        if (fs.existsSync(feeRecipientPath)) {
            const feeRecipientKeypair = Keypair.fromSecretKey(
                new Uint8Array(JSON.parse(fs.readFileSync(feeRecipientPath, "utf-8")))
            );
            feeRecipient = feeRecipientKeypair.publicKey;
            console.log("💸 Fee Recipient:", feeRecipient.toString());
        } else {
            console.log("💸 Fee Recipient (default to admin):", feeRecipient.toString());
        }

        // Get protocol addresses
        const protocolAddresses = getProtocolAddresses(
            program.programId,
            walletKeypair.publicKey,
            feeRecipient,
            
        );

        console.log("\n📋 Protocol addresses:", protocolAddresses.length);

        // Get all ATA addresses
        const ataAddressA = getAssociatedTokenAddressSync(
            mintA,
            globalConfig,
            true
        );
        const ataAddressB = getAssociatedTokenAddressSync(
            mintB,
            globalConfig,
            true
        );
        const ataAddressC = getAssociatedTokenAddressSync(
            mintC,
            globalConfig,
            true
        );
        const ataAddressNative = getAssociatedTokenAddressSync(
            NATIVE_MINT,
            globalConfig,
            true
        );

        const relayerTokenAccount = getAssociatedTokenAddressSync(
            NATIVE_MINT,
            walletKeypair.publicKey,
            true
        );
        console.log("📋 ATA addresses: 4");

        // Combine all addresses for ALT
        const allAddresses = [
            ...protocolAddresses,
            mintA,
            mintB,
            mintC,
            NATIVE_MINT,
            ataAddressA,
            ataAddressB,
            ataAddressC,
            ataAddressNative,
            walletKeypair.publicKey,
            relayerTokenAccount,
        ];

        console.log("\n📊 Total addresses to add to ALT:", allAddresses.length);
        console.log("  Protocol addresses:", protocolAddresses.length);
        console.log("  Mint addresses: 4");
        console.log("  ATA addresses: 4");

        // Create the ALT
        const altAddress = await createALT(connection, walletKeypair, allAddresses);

        // Save ALT address to file
        const altData = {
            altAddress: altAddress.toString(),
            programId: program.programId.toString(),
            globalConfig: globalConfig.toString(),
            authority: walletKeypair.publicKey.toString(),
            feeRecipient: feeRecipient.toString(),
            mints: {
                mintA: mintA.toString(),
                mintB: mintB.toString(),
                mintC: mintC.toString(),
                native: NATIVE_MINT.toString(),
            },
            atas: {
                ataA: ataAddressA.toString(),
                ataB: ataAddressB.toString(),
                ataC: ataAddressC.toString(),
                ataNative: ataAddressNative.toString(),
            },
            totalAddresses: allAddresses.length,
            timestamp: new Date().toISOString(),
        };

        const outputPath = path.resolve(__dirname, "../alt-address.json");
        fs.writeFileSync(outputPath, JSON.stringify(altData, null, 2));
        console.log("\n💾 ALT address saved to:", outputPath);

        console.log("\n🎉 Address Lookup Table created successfully!");
        console.log("\n📋 Summary:");
        console.log("  ALT Address:", altAddress.toString());
        console.log("  Total Addresses:", allAddresses.length);
        console.log("\n💡 This ALT can now be used for transactions to reduce size");
    } catch (error) {
        console.error("\n❌ Error:", error);
        process.exit(1);
    }
}

createAddressLookupTable();


