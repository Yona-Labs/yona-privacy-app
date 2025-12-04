import {
    PublicKey,
    Keypair,
    Connection,
    AddressLookupTableProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

/**
 * Add addresses to an existing Address Lookup Table
 */
async function addAddressesToALT(
    connection: Connection,
    payer: Keypair,
    lookupTableAddress: PublicKey,
    addresses: PublicKey[]
): Promise<void> {
    try {
        console.log("\n⚙️  Adding addresses to existing ALT...");
        console.log("📍 ALT Address:", lookupTableAddress.toString());
        console.log(`📊 Addresses to add: ${addresses.length}`);

        // Verify the ALT exists
        const altAccount = await connection.getAddressLookupTable(lookupTableAddress);
        if (!altAccount.value) {
            throw new Error("ALT not found. Please create it first using create-alt.ts");
        }

        const currentAddresses = altAccount.value.state.addresses.length;
        console.log(`📋 Current addresses in ALT: ${currentAddresses}`);

        // Add addresses to the lookup table in chunks
        console.log(`\n⚙️  Adding ${addresses.length} addresses to ALT in chunks...`);
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

        // Verify the addresses were added
        const updatedAltAccount = await connection.getAddressLookupTable(
            lookupTableAddress
        );
        if (!updatedAltAccount.value) {
            throw new Error("Failed to fetch updated ALT");
        }

        const newAddressCount = updatedAltAccount.value.state.addresses.length;
        console.log(`\n✅ Successfully added ${addresses.length} addresses to ALT`);
        console.log(`📊 Total addresses in ALT: ${newAddressCount} (was ${currentAddresses})`);

    } catch (error) {
        console.error("❌ Failed to add addresses to ALT:", error);
        throw error;
    }
}

async function addToAddressLookupTable() {
    try {
        const rpcUrl =
            "https://mainnet.helius-rpc.com/?api-key=f454a99e-a9c6-4b24-9303-79eebadc519f";

        // Load wallet
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
        console.log("👛 Wallet:", walletKeypair.publicKey.toString());

        // Load existing ALT address from file
        const altFilePath = path.resolve(__dirname, "../alt-address.json");
        if (!fs.existsSync(altFilePath)) {
            console.error("❌ ALT file not found at:", altFilePath);
            console.log("Please create ALT first using create-alt.ts");
            process.exit(1);
        }

        const altData = JSON.parse(fs.readFileSync(altFilePath, "utf-8"));
        const lookupTableAddress = new PublicKey(altData.altAddress);

        // Define new addresses to add
        // Example: add new mints or ATAs here
        const newAddresses: PublicKey[] = [
            new PublicKey("SysvarC1ock11111111111111111111111111111111"),
            new PublicKey("SV2EYYJyRz2YhfXwXnhNAevDEui5Q6yrfyo13WtupPF"),
            new PublicKey("65ZHSArs5XxPseKQbB1B4r16vDxMWnCxHMzogDAqiDUc"),
        ];

        if (newAddresses.length === 0) {
            console.log("⚠️  No addresses specified to add. Please add addresses to the newAddresses array.");
            process.exit(0);
        }

        console.log("\n📋 New addresses to add:");
        newAddresses.forEach((addr, i) => {
            console.log(`  ${i + 1}. ${addr.toString()}`);
        });

        // Check wallet balance
        const balance = await connection.getBalance(walletKeypair.publicKey);
        console.log("\n💰 Wallet Balance:", balance / 1e9, "SOL");

        if (balance < 0.01 * 1e9) {
            console.error("❌ Insufficient balance. Need at least 0.01 SOL");
            process.exit(1);
        }

        // Add addresses to ALT
        await addAddressesToALT(connection, walletKeypair, lookupTableAddress, newAddresses);

        console.log("\n🎉 Addresses added to ALT successfully!");
        console.log("\n📋 Summary:");
        console.log("  ALT Address:", lookupTableAddress.toString());
        console.log("  New Addresses Added:", newAddresses.length);
        console.log("\n💡 Updated ALT can now be used for transactions");

    } catch (error) {
        console.error("\n❌ Error:", error);
        process.exit(1);
    }
}

addToAddressLookupTable();

