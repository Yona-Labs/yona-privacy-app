import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  getNearIntentsQuote,
  getNearIntentsSolToken,
  getNearIntentsZecToken,
  NearIntentsQuoteResponse,
  NearIntentsQuoteRequest,
} from "@/lib/sdk/utils/nearIntents";
import { WITHDRAW_FEE_RATE, SLIPPAGE_BPS } from "../sdk/utils/constants";
import { Keypair, PublicKey } from "@solana/web3.js";

/**
 * Hook to fetch 1Click cross-chain quote
 * SOL to ZEC bridge via NEAR Intents
 */
export function useNearIntentsQuote( 
  amount: string,
  destinationAddress: string,
  refundAddress: string,
  dry: boolean = true
): UseQueryResult<NearIntentsQuoteResponse | null, Error> {
  return useQuery({
    queryKey: ["nearQuote", amount, destinationAddress, refundAddress, dry],
    queryFn: async (): Promise<NearIntentsQuoteResponse | null> => {
      console.log("destinationAddress", destinationAddress);
      console.log("refundAddress", refundAddress);
      if (
        !amount ||
        parseFloat(amount) <= 0
      ) {
        return null;
      }
      try {
        // Get token info from 1Click API
        const [solToken, zecToken] = await Promise.all([
          getNearIntentsSolToken(),
          getNearIntentsZecToken(),
        ]);

        if (!solToken || !zecToken) {
          throw new Error("Failed to fetch token information from NEAR Intents");
        }

        // Convert amount to smallest unit (SOL has 9 decimals)
        const amountInSmallestUnit = Math.floor(
          parseFloat(amount) * Math.pow(10, solToken.decimals)
        );
        
        // Calculate fee that will be deducted (same as in useBridgeExecute)
        const feeAmount = Math.floor(amountInSmallestUnit * WITHDRAW_FEE_RATE);
        const amountAfterFee = amountInSmallestUnit - feeAmount;
        
        const amountInSmallestUnitWithFee = amountAfterFee.toString();

        // Set deadline to 3 min from now
        const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const request: NearIntentsQuoteRequest = {
          dry: dry,
          depositMode: "SIMPLE",
          swapType: "EXACT_INPUT",
          slippageTolerance: SLIPPAGE_BPS, // 0.3%
          originAsset: solToken.assetId,
          depositType: "ORIGIN_CHAIN",
          destinationAsset: zecToken.assetId,
          amount: amountInSmallestUnitWithFee,
          recipient: destinationAddress, 
          recipientType: "DESTINATION_CHAIN",
          refundTo: refundAddress,
          refundType: "ORIGIN_CHAIN",
          deadline: deadline,
        };

        if (!dry) {
          return await getNearIntentsQuote(request);
        }
        return await getNearIntentsQuote({
          dry: dry,
          depositMode: "SIMPLE",
          swapType: "EXACT_INPUT",
          slippageTolerance: SLIPPAGE_BPS, // 0.3%
          originAsset: solToken.assetId,
          depositType: "ORIGIN_CHAIN",
          destinationAsset: zecToken.assetId,
          amount: amountInSmallestUnitWithFee,
          recipient: "t1dai5eUZ1G1pVimLwKwj2pekHY2W2vfp6Z",
          recipientType: "DESTINATION_CHAIN",
          refundTo: Keypair.generate().publicKey.toString(),
          refundType: "ORIGIN_CHAIN",
          deadline: deadline,
        });
      } catch (error: any) {
        console.error("Error fetching NEAR Intents quote:", error);
        // Re-throw error with preserved message
        const errorMessage = error?.message || error?.toString() || "Unknown error";
        throw new Error(errorMessage);
      }
    },
    enabled:
      !!amount &&
      parseFloat(amount) > 0,
    staleTime: 30000, // Consider quote fresh for 30 seconds
    gcTime: 60000, // Keep in cache for 60 seconds
    retry: 2,
  });
}

