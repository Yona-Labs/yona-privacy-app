import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProgram } from "@/lib/hooks";
import { withdrawWithRelayer } from "@/lib/sdk/transactions/withdraw";
import { Zkcash } from "@/lib/sdk";
import { Program } from "@coral-xyz/anchor";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { PublicKey } from "@solana/web3.js";
import { WITHDRAW_FEE_RATE } from "@/lib/sdk/utils/constants";
import { submitOmniDeposit } from "@/lib/sdk/utils/nearIntents";
import { formatNumber } from "@/lib/utils/formatNumber";

export function useBridgeExecute(hasher: LightWasm) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const program = useProgram() as Program<Zkcash>;

  const handleBridge = async (
    sellingAmount: string,
    buyingAmount: string,
    sellingTokenAddress: string,
    buyingTokenAddress: string,
    quoteResponse: any | null,
    sellingBalance: number,
    depositAddress?: string
  ): Promise<boolean> => {
    if (!publicKey) {
      setError("Wallet not connected");
      toast.error("Wallet not connected");
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

    if (parseFloat(sellingAmount) > sellingBalance) {
      const errorMsg = `Insufficient balance. Available: ${formatNumber(sellingBalance)}`;
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    if (!depositAddress) {
      setError("No deposit address available. Please check the quote.");
      toast.error("No deposit address available. Please check the quote.");
      return false;
    }

    setIsSwapping(true);
    setError(null);
    setStatusMessage("Preparing bridge transaction...");

    const toastId = toast.loading("Preparing bridge transaction...");

    try {
      // Get account signature for encryption
      setStatusMessage("Requesting signature...");
      toast.loading("Requesting signature...", { id: toastId });
      const signed = await getAccountSign();

      if (!signed) {
        throw new Error(
          "Failed to get signature. Please ensure your wallet is connected."
        );
      }

      // Convert amount to lamports (smallest unit)
      const inputTokenInfo = getTokenInfo(sellingTokenAddress);
      const amountInLamports = Math.floor(
        parseFloat(sellingAmount) * Math.pow(10, inputTokenInfo.decimals)
      );

      // Calculate fee that will be deducted
      const feeAmount = Math.floor(amountInLamports * WITHDRAW_FEE_RATE);
      const amountAfterFee = amountInLamports - feeAmount;

      console.log("Bridge details:");
      console.log("- Amount:", amountInLamports, "lamports");
      console.log("- Fee:", feeAmount, "lamports");
      console.log("- After fee:", amountAfterFee, "lamports");
      console.log("- Deposit address:", depositAddress);

      setStatusMessage("Withdrawing from private balance to bridge...");
      toast.loading("Withdrawing from private balance to bridge...", { id: toastId });

      // Get referral code from localStorage
      const referralCode = localStorage.getItem('referralCode') || undefined;

      // Use withdrawWithRelayer but send to Omni deposit address
      const result = await withdrawWithRelayer(
        new PublicKey(depositAddress), // Send to Omni deposit address
        amountInLamports,
        signed,
        connection,
        program,
        sellingTokenAddress,
        setStatusMessage,
        hasher,
        referralCode
      );

      console.log("Bridge result:", result);

      // Submit deposit transaction hash to 1Click API
      if (result.signature) {
        try {
          setStatusMessage("Notifying bridge service...");
          toast.loading("Notifying bridge service...", { id: toastId });
          await submitOmniDeposit({
            txHash: result.signature,
            depositAddress: depositAddress,
          });
          console.log("Deposit transaction hash submitted to 1Click API");
        } catch (submitError) {
          // Don't fail the entire operation if submission fails
          // The bridge will still work, just might be slower
          console.warn("Failed to submit deposit hash to 1Click:", submitError);
        }
      }

      setStatusMessage("");

      // Show success toast with clickable link
      const sellingTokenInfo = getTokenInfo(sellingTokenAddress);
      const buyingTokenInfo = getTokenInfo(buyingTokenAddress);
      const explorerUrl = `https://orb.helius.dev/tx/${result.signature}`;
      
      toast.success(
        `Successfully bridged ${sellingAmount} ${sellingTokenInfo.symbol} to ${buyingAmount} ${buyingTokenInfo.symbol}`,
        { 
          id: toastId,
          duration: 5000,
          action: result.signature ? {
            label: "View transaction",
            onClick: () => window.open(explorerUrl, "_blank"),
          } : undefined,
        }
      );

      // Refetch UTXOs after 500ms
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["utxos"] });
      }, 500);

      return true;
    } catch (err) {
      console.error("Bridge error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to execute bridge";
      setError(errorMsg);
      setStatusMessage("");
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsSwapping(false);
    }
  };

  return {
    handleBridge,
    isSwapping,
    error,
    statusMessage,
    setError,
  };
}


