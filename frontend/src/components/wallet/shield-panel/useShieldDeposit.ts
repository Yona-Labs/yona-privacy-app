import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EncryptionService } from "@/lib/sdk/utils/encryption";
import { useProgram } from "@/lib/hooks";
import { deposit } from "@/lib/sdk/transactions";
import { Zkcash } from "@/lib/sdk";
import { Program } from "@coral-xyz/anchor";
import { getAccountSign } from "@/lib/sdk/utils/getAccountSign";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";

export function useShieldDeposit(hasher: LightWasm) {
  const { publicKey, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const encryptionService = new EncryptionService();
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const program = useProgram() as Program<Zkcash>;

  const handleDeposit = async (
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

    const amountInSol = parseFloat(amount);
    if (isNaN(amountInSol) || amountInSol <= 0) {
      setError("Please enter a valid amount");
      toast.error("Please enter a valid amount");
      return false;
    }

    setIsDepositing(true);
    setError(null);
    setStatusMessage("Preparing deposit...");

    const toastId = toast.loading("Preparing deposit...");

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

      // Call deposit function
      setStatusMessage("Executing deposit...");
      toast.loading("Executing deposit...", { id: toastId });
      
      const signature = await deposit(
        amountInSol,
        signed,
        connection,
        program,
        selectedToken,
        signAllTransactions,
        setStatusMessage,
        hasher
      );

      setStatusMessage("");

      // Show success toast with clickable link
      const tokenInfo = getTokenInfo(selectedToken);
      const explorerUrl = `https://orb.helius.dev/tx/${signature}`;
      
      toast.success(
        `Successfully deposited ${amount} ${tokenInfo.symbol} to private balance`,
        { 
          id: toastId,
          duration: 5000,
          action: signature ? {
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
      console.error("Deposit error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to deposit";
      setError(errorMsg);
      setStatusMessage("");
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsDepositing(false);
    }
  };

  return {
    handleDeposit,
    isDepositing,
    error,
    statusMessage,
    setError,
  };
}

