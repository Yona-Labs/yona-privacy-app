import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EncryptionService } from "@/lib/sdk/utils/encryption";
import { useProgram } from "@/lib/hooks";
import { swapWithRelayer } from "@/lib/sdk/transactions/swap";
import { Zkcash } from "@/lib/sdk";
import { Program } from "@coral-xyz/anchor";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { JupiterQuoteResponse } from "@/lib/sdk/utils/jupiter";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { formatNumber } from "@/lib/utils/formatNumber";

export function useSwapExecute(hasher: LightWasm) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const encryptionService = new EncryptionService();
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const program = useProgram() as Program<Zkcash>;

  const handleSwap = async (
    sellingAmount: string,
    buyingAmount: string,
    sellingTokenAddress: string,
    buyingTokenAddress: string,
    quoteResponse: JupiterQuoteResponse | null,
    sellingBalance: number
  ): Promise<boolean> => {
    if (!publicKey) {
      setError("Wallet not connected");
      toast.error("Wallet not connected");
      return false;
    }

    if (!encryptionService) {
      const errorMsg = "Encryption service not initialized. Please sign the message when prompted.";
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    }
    if (!program) {
      setError("Program not initialized");
      toast.error("Program not initialized");
      return false;
    }

    if (!sellingAmount || parseFloat(sellingAmount) <= 0) {
      setError("Please enter a valid selling amount");
      toast.error("Please enter a valid selling amount");
      return false;
    }

    if (!buyingAmount || parseFloat(buyingAmount) <= 0) {
      setError("Please wait for quote to calculate");
      toast.error("Please wait for quote to calculate");
      return false;
    }

    if (sellingTokenAddress === buyingTokenAddress) {
      setError("Cannot swap the same token");
      toast.error("Cannot swap the same token");
      return false;
    }

    if (parseFloat(sellingAmount) > sellingBalance) {
      const errorMsg = `Insufficient balance. Available: ${formatNumber(sellingBalance)}`;
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    if (!quoteResponse) {
      setError("No quote response received");
      toast.error("No quote response received");
      return false;
    }

    setIsSwapping(true);
    setError(null);
    setStatusMessage("Preparing swap...");

    const toastId = toast.loading("Preparing swap...");

    try {
      // Get account signature for encryption
      setStatusMessage("Requesting signature for encryption...");
      toast.loading("Requesting signature for encryption...", { id: toastId });
      const signed = await getAccountSign();

      if (!signed) {
        throw new Error(
          "Failed to get signature. Please ensure your wallet is connected."
        );
      }

      // Get storage
      const storage =
        typeof window !== "undefined" ? window.localStorage : null;
      if (!storage) {
        throw new Error("LocalStorage not available");
      }
      
      // Convert amounts to smallest units based on token decimals
      const inputTokenInfo = getTokenInfo(sellingTokenAddress);
      const outputTokenInfo = getTokenInfo(buyingTokenAddress);

      const amountToSwap = Math.floor(
        parseFloat(sellingAmount) * Math.pow(10, inputTokenInfo.decimals)
      );
      const minAmountOut = Math.floor(
        parseFloat(buyingAmount) * Math.pow(10, outputTokenInfo.decimals)
      );

      setStatusMessage("Executing swap via relayer...");
      toast.loading("Executing swap via relayer...", { id: toastId });

      // Call swap function via relayer
      const result = await swapWithRelayer(
        amountToSwap,
        minAmountOut,
        signed,
        connection,
        program,
        sellingTokenAddress,
        buyingTokenAddress,
        quoteResponse,
        setStatusMessage,
        hasher
      );

      console.log("Swap result:", result);
      setStatusMessage("");

      // Show success toast with clickable link
      const sellingTokenInfo = getTokenInfo(sellingTokenAddress);
      const buyingTokenInfo = getTokenInfo(buyingTokenAddress);
      const explorerUrl = `https://orb.helius.dev/tx/${result.signature}`;
      
      toast.success(
        `Successfully swapped ${sellingAmount} ${sellingTokenInfo.symbol} for ${buyingAmount} ${buyingTokenInfo.symbol}`,
        { 
          id: toastId,
          duration: 5000,
          action: result.signature ? {
            label: "View transaction",
            onClick: () => window.open(explorerUrl, "_blank"),
          } : undefined,
        }
      );

      // Refetch UTXOs after 2 seconds
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["utxos"] });
      }, 2000);

      return true;
    } catch (err) {
      console.error("Swap error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to execute swap";
      setError(errorMsg);
      setStatusMessage("");
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsSwapping(false);
    }
  };

  return {
    handleSwap,
    isSwapping,
    error,
    statusMessage,
    setError,
  };
}

