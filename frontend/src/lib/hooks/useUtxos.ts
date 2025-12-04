import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LightWasm } from "@lightprotocol/hasher.rs";
import {
  getMyUtxos,
  getBalanceFromUtxos,
  groupUtxosByMint,
} from "@/lib/sdk/utils/getMyUtxos";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import {
  fieldElementToPublicKey,
  getTokenInfo,
} from "@/lib/sdk/utils/tokenInfo";
import type { Utxo } from "@/lib/sdk/models/utxo";
import BN from "bn.js";

export interface TokenBalance {
  mint: string;
  symbol: string;
  decimals: number;
  balance: string; // Formatted balance string
  rawBalance: BN; // Raw balance in smallest unit
}

export interface UtxosData {
  utxos: Utxo[];
  balance: number; // SOL balance from UTXOs
  tokenBalances: TokenBalance[]; // SPL token balances (private tokens)
}

/**
 * Hook to fetch UTXOs and calculate balances
 * Returns SOL balance and SPL token balances (private tokens associated with TOKEN_PROGRAM_ID)
 * Returns the full query object from React Query
 */
export function useUtxos(
  hasher: LightWasm | null
): UseQueryResult<UtxosData, Error> {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["utxos", publicKey?.toString(), connected, hasher],
    queryFn: async (): Promise<UtxosData> => {
      if (!publicKey || !connected || !hasher) {
        throw new Error("Wallet not connected or hasher not loaded");
      }

      try {
        // Get account signature
        const signed = await getAccountSign();
        if (!signed) {
          throw new Error("Failed to get wallet signature");
        }
        console.log("signed:", signed);
        // Fetch UTXOs
        const myUtxos = await getMyUtxos(signed, connection, () => {}, hasher);
        console.log("myUtxos:", myUtxos);

        // Calculate SOL balance from UTXOs
        const balance = getBalanceFromUtxos(myUtxos);

        // SOL mint address as field element (to filter it out)
        const SOL_MINT =
          "14297923448564296417094361404830720001668866657658538855298779812503247422177";

        // Group UTXOs by mint address (field element)
        const balancesByMint = groupUtxosByMint(myUtxos);

        // Convert to token balances array, excluding SOL
        const tokenBalances: TokenBalance[] = [];
        for (const [mintFieldElement, rawBalance] of balancesByMint.entries()) {
          // Skip SOL (native token, not associated with TOKEN_PROGRAM_ID)
          if (mintFieldElement === SOL_MINT) {
            continue;
          }

          // Convert field element to Solana public key
          const mintAddress = fieldElementToPublicKey(mintFieldElement);
          if (!mintAddress) {
            // Skip if we can't convert (unknown token)
            continue;
          }

          // Get token metadata
          const tokenInfo = getTokenInfo(mintAddress);

          // Convert raw balance (in smallest unit) to human-readable format
          const divisor = new BN(10).pow(new BN(tokenInfo.decimals));
          const balanceNumber = rawBalance.toNumber() / divisor.toNumber();
          const balanceString = balanceNumber.toFixed(tokenInfo.decimals);

          tokenBalances.push({
            mint: mintAddress,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            balance: balanceString,
            rawBalance: rawBalance,
          });
        }

        return {
          utxos: myUtxos,
          balance,
          tokenBalances,
        };
      } catch (error) {
        console.error("Error fetching UTXOs:", error);
        throw error;
      }
    },
    enabled: !!publicKey && connected && !!hasher,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
}
