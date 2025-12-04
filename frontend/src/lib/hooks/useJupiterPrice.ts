import { useQuery, UseQueryResult } from "@tanstack/react-query";

export interface JupiterPriceResponse {
  [mintAddress: string]: {
    blockId: number;
    decimals: number;
    priceChange24h: number;
    usdPrice: number;
  };
}

/**
 * Hook to fetch USD price for a token using Jupiter Price API V3
 * @param mintAddress - Token mint address
 * @returns Query result with price data
 */
export function useJupiterPrice(
  mintAddress: string | null
): UseQueryResult<number | null, Error> {
  return useQuery({
    queryKey: ["jupiterPrice", mintAddress],
    queryFn: async (): Promise<number | null> => {
      if (!mintAddress) {
        return null;
      }

      try {
        // Jupiter Price API V3 endpoint
        const url = `https://lite-api.jup.ag/price/v3?ids=${mintAddress}`;

        const response = await fetch(url);

        if (!response.ok) {
          console.error(
            "Jupiter Price API error:",
            response.status,
            response.statusText
          );
          return null;
        }

        const data: JupiterPriceResponse = await response.json();

        // Extract price from response
        const priceData = data[mintAddress];
        if (priceData && priceData.usdPrice) {
          return priceData.usdPrice;
        }

        return null;
      } catch (error) {
        console.error("Error fetching Jupiter price:", error);
        return null;
      }
    },
    enabled: !!mintAddress,
    staleTime: 1000, // Consider price fresh for 10 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
}
