import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Hook to fetch wallet SOL balance
 * Returns the full query object from React Query
 */
export function useWalletSolBalance(): UseQueryResult<number, Error> {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["walletSolBalance", publicKey?.toString(), connected],
    queryFn: async (): Promise<number> => {
      if (!publicKey || !connected) {
        throw new Error("Wallet not connected");
      }

      try {
        const walletBalance = await connection.getBalance(publicKey);
        return walletBalance / LAMPORTS_PER_SOL;
      } catch (error) {
        console.error("Error fetching wallet SOL balance:", error);
        throw error;
      }
    },
    enabled: !!publicKey && connected,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
}

