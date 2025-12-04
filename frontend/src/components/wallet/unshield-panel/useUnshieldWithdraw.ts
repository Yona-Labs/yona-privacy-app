import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EncryptionService } from "@/lib/sdk/utils/encryption";
import { useProgram } from "@/lib/hooks";
import { withdrawWithRelayer } from "@/lib/sdk/transactions";
import { Zkcash } from "@/lib/sdk";
import { Program } from "@coral-xyz/anchor";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";

export function useUnshieldWithdraw(hasher: LightWasm) {
  const { publicKey, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const encryptionService = new EncryptionService();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const program = useProgram() as Program<Zkcash>;

  const handleWithdraw = async (
    recipientAddress: string,
    amount: string,
    selectedToken: string
  ): Promise<boolean> => {
    if (!publicKey || !signAllTransactions) {
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

    // Validate recipient address
    let recipientPublicKey: PublicKey;
    try {
      recipientPublicKey = new PublicKey(recipientAddress);
    } catch (err) {
      setError("Invalid recipient address");
      toast.error("Invalid recipient address");
      return false;
    }

    const amountInSol = parseFloat(amount);
    if (isNaN(amountInSol) || amountInSol <= 0) {
      setError("Please enter a valid amount");
      toast.error("Please enter a valid amount");
      return false;
    }

    setIsWithdrawing(true);
    setError(null);
    setStatusMessage("Preparing withdrawal...");

    const toastId = toast.loading("Preparing withdrawal...");

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
      const tokenInfo = getTokenInfo(selectedToken);
      const amountInLamports = Math.floor(
        amountInSol * Math.pow(10, tokenInfo.decimals)
      );

      // Call withdraw function (using relayer for now)
      setStatusMessage("Executing withdrawal...");
      toast.loading("Executing withdrawal...", { id: toastId });

      const result = await withdrawWithRelayer(
        recipientPublicKey,
        amountInLamports,
        signed,
        connection,
        program,
        selectedToken,
        setStatusMessage,
        hasher
      );

      setStatusMessage("");

      // Show success toast with clickable link
      const explorerUrl = `https://orb.helius.dev/tx/${result.signature}`;
      
      toast.success(
        `Successfully withdrew ${amount} ${tokenInfo.symbol} to ${recipientAddress.substring(0, 8)}...`,
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
      console.error("Withdrawal error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to withdraw";
      setError(errorMsg);
      setStatusMessage("");
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsWithdrawing(false);
    }
  };

  return {
    handleWithdraw,
    isWithdrawing,
    error,
    statusMessage,
    setError,
  };
}

