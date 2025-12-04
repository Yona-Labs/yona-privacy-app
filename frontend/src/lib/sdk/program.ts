import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Zkcash, IDL  } from "@/lib/sdk";

export type ZkcashIDL = typeof IDL;  

/**
 * Create Anchor Provider from connection and wallet
 */
export function createProvider(connection: Connection, wallet: AnchorWallet): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

/**
 * Create Program instance
 */
export function createProgram(provider: AnchorProvider): Program<Zkcash> {
  return new Program(IDL as Zkcash, provider); 
}

/**
 * Get Program instance from connection and wallet
 */
export function getProgram(connection: Connection, wallet: AnchorWallet): Program<Zkcash> {
  const provider = createProvider(connection, wallet);
  return createProgram(provider);
}

