import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { formatNumber } from "@/lib/utils/formatNumber";

export interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
  balance: string;
}

/**
 * Hook to fetch wallet tokens NOT associated with TOKEN_PROGRAM_ID (i.e., native SOL only)
 * IMPORTANT: This only returns tokens from the wallet balance, NOT private tokens (UTXOs)
 * Returns the full query object from React Query, including data, isLoading, error, etc.
 */
export function useTokens(): UseQueryResult<TokenInfo[], Error> {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["tokens", publicKey?.toString(), connected],
    queryFn: async (): Promise<TokenInfo[]> => {
      if (!publicKey || !connected) {
        return [];
      }

      try {
        // Get SOL balance (native token, not associated with TOKEN_PROGRAM_ID)
        const solBalance = await connection.getBalance(publicKey);

        const tokenList: TokenInfo[] = [];

        // Add SOL if it has balance > 0
        // Only show wallet tokens, not private tokens
        if (solBalance > 0) {
          tokenList.push({
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            decimals: 9,
            balance: formatNumber(solBalance / LAMPORTS_PER_SOL),
          });
        }

        return tokenList;
      } catch (err) {
        console.error("Error fetching tokens:", err);
        throw err;
      }
    },
    enabled: !!publicKey && connected,
  });
}
