import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTokens } from "@/lib/hooks";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { TokenInput, type TokenOption } from "@/components/TokenInput";
import { Button } from "@/components/Button";
import { useShieldDeposit } from "./useShieldDeposit";

export const ShieldPanel = ({ hasher }: { hasher: LightWasm }) => {
  const { publicKey, connected, connecting } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>(
    "So11111111111111111111111111111111111111112"
  ); // Default to SOL
  // Only show tokens from wallet (not private tokens) for Shield page
  const tokensQuery = useTokens();
  const availableTokens = tokensQuery.data ?? [];
  const { handleDeposit, isDepositing, error, statusMessage } =
    useShieldDeposit(hasher);

  const selectedTokenInfo = availableTokens.find(
    (t) => t.mint === selectedToken
  );

  const tokenOptions: TokenOption[] = availableTokens.map((token) => ({
    mint: token.mint,
    symbol: token.symbol,
    name: token.symbol === "SOL" ? "Solana" : "SPL Token",
    balance: token.balance,
  }));

  const onDeposit = async () => {
    const success = await handleDeposit(amount, selectedToken);
    if (success) {
      setAmount("");
    }
  };

  return (
    <>
      {(!connected || !publicKey) && !connecting && (
        <div className="text-center text-secondary-text py-2 px-6">
          Connect your wallet to shield tokens
        </div>
      )}

      {connecting && (
        <div className="flex items-center justify-center gap-2 flex-col py-2 px-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-secondary-text">Connecting to wallet...</p>
        </div>
      )}

      {connected && publicKey && (
        <div className="space-y-4">
          <TokenInput
            label="Amount"
            placeholder="0.0"
            disabled={isDepositing}
            amount={amount}
            name={selectedTokenInfo?.symbol === "SOL" ? "Solana" : "SPL Token"}
            ticker={selectedTokenInfo?.symbol || "SOL"}
            onAmountChange={(value) => setAmount(value)}
            tokens={tokenOptions}
            selectedTokenMint={selectedToken}
            onTokenSelect={(mint) => setSelectedToken(mint)}
          />

          <Button
            onClick={onDeposit}
            disabled={isDepositing || !amount}
            className="w-full"
            isLoading={isDepositing}
            loadingInfo="Processing..."
          >
            Shield
          </Button>

          {error && (
            <div className="bg-error/20 border border-error rounded-lg p-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {statusMessage && !error && (
            <div className="bg-primary/20 border border-primary rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm text-primary">{statusMessage}</p>
              </div>
            </div>
          )}

          <div className="pt-4 px-3">
            <p className="text-xs text-secondary-text">
              <strong>Note:</strong> Your deposit will be made private using
              zero-knowledge proofs. You will need to sign the transaction with
              your wallet.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
