import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Program } from "@coral-xyz/anchor";
import { getProgram } from "@/lib/sdk/program";
import { Zkcash } from "@/lib/sdk";

/**
 * Hook to get the Laplace program instance
 * Returns null if wallet is not connected
 */
export function useProgram(): Program<Zkcash> | null {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useMemo(() => {
    try {
      return getProgram(connection, wallet as AnchorWallet);
    } catch (error) {
      console.error("Failed to create program instance:", error);
      return null;
    }
  }, [connection, wallet]);

  return program;
}

