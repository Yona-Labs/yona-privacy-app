import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getJupiterQuote, JupiterQuoteResponse } from "@/lib/sdk/utils/jupiter";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { SLIPPAGE_BPS } from "@/lib/sdk/utils/constants";

/**
 * Hook to fetch Jupiter swap quote
 * Returns the full query object from React Query
 */
export function useJupiterQuote(
  inputMint: string | null,
  outputMint: string | null,
  amount: string,
  slippageBps: number = SLIPPAGE_BPS
): UseQueryResult<JupiterQuoteResponse | null, Error> {
  return useQuery({
    queryKey: ["jupiterQuote", inputMint, outputMint, amount, slippageBps],
    queryFn: async (): Promise<JupiterQuoteResponse | null> => {
      if (
        !inputMint ||
        !outputMint ||
        !amount ||
        parseFloat(amount) <= 0 ||
        inputMint === outputMint
      ) {
        return null;
      }

      try {
        const inputTokenInfo = getTokenInfo(inputMint);
        const amountInSmallestUnit = Math.floor(
          parseFloat(amount) * Math.pow(10, inputTokenInfo.decimals)
        ).toString();

        const quote = await getJupiterQuote(
          inputMint,
          outputMint,
          amountInSmallestUnit,
          slippageBps
        );

        return quote;
      } catch (error) {
        console.error("Error fetching Jupiter quote:", error);
        throw error;
      }
    },
    enabled:
      !!inputMint &&
      !!outputMint &&
      !!amount &&
      parseFloat(amount) > 0 &&
      inputMint !== outputMint,
    staleTime: 10000, // Consider quote fresh for 10 seconds
    gcTime: 30000, // Keep in cache for 30 seconds
    refetchInterval: 20000, // Refetch quote every 20 seconds to keep the quote fresh
  });
}
