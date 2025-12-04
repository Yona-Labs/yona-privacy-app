import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { usePrivateBalance } from "@/lib/hooks";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { TokenInput, type TokenOption } from "@/components/TokenInput";
import { Button } from "@/components/Button";
import { useUnshieldWithdraw } from "./useUnshieldWithdraw";
import { SUPPORTED_TOKENS } from "@/lib/constants/supportedTokens";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { TokenInfo } from "@/lib/hooks/useTokens";

export const UnshieldPanel = ({ hasher }: { hasher: LightWasm }) => {
  const { publicKey, connected, connecting } = useWallet();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>(
    "So11111111111111111111111111111111111111112"
  ); // Default to SOL
  
  // Convert SUPPORTED_TOKENS to TokenInfo format for usePrivateBalance
  const tokenInfos: TokenInfo[] = SUPPORTED_TOKENS.map((token) => {
    const tokenInfo = getTokenInfo(token.address);
    return {
      mint: token.address,
      symbol: token.symbol,
      decimals: tokenInfo.decimals,
      balance: "0",
    };
  });
  
  // Get private balances for all supported tokens
  const balanceQueries = SUPPORTED_TOKENS.map((token) =>
    usePrivateBalance(hasher, token.address, tokenInfos)
  );

  // Get balance for currently selected token
  const privateBalance = balanceQueries[
    SUPPORTED_TOKENS.findIndex(t => t.address === selectedToken)
  ]?.data ?? 0;

  const { handleWithdraw, isWithdrawing, error, statusMessage } =
    useUnshieldWithdraw(hasher);

  const selectedTokenInfo = SUPPORTED_TOKENS.find(
    (t) => t.address === selectedToken
  );

  // Convert to TokenOption format with private balances
  const tokenOptions: TokenOption[] = SUPPORTED_TOKENS.map((token, index) => ({
    mint: token.address,
    symbol: token.symbol,
    name: token.name,
    balance: (balanceQueries[index]?.data ?? 0).toFixed(6),
  }));

  const onWithdraw = async () => {
    const success = await handleWithdraw(
      recipientAddress,
      amount,
      selectedToken
    );

    if (success) {
      setAmount("");
      setRecipientAddress("");
      // Refresh all balances
      balanceQueries.forEach(query => query.refetch());
    }
  };

  return (
    <>
      {(!connected || !publicKey) && !connecting && (
        <div className="text-center text-secondary-text py-2 px-6">
          Connect your wallet to unshield tokens
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
          {/* Recipient Address Input */}
          <div>
            <label
              htmlFor="recipient-address"
              className="block text-sm text-tertiary-text mb-2 px-3"
            >
              Recipient Address
            </label>
            <input
              id="recipient-address"
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={isWithdrawing}
              placeholder="Enter Recipient Address"
              className="w-full px-4 py-3 bg-secondary-bg rounded-xl text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Amount Input with Private Balance */}
          <TokenInput
            label="Amount"
            placeholder="0.0"
            disabled={isWithdrawing}
            amount={amount}
            name={selectedTokenInfo?.name || "Token"}
            ticker={selectedTokenInfo?.symbol || "SOL"}
            onAmountChange={(value) => setAmount(value)}
            tokens={tokenOptions}
            selectedTokenMint={selectedToken}
            onTokenSelect={(mint) => setSelectedToken(mint)}
            balanceOverride={`${privateBalance.toFixed(4)} ${
              selectedTokenInfo?.symbol || "SOL"
            }`}
          />

          <Button
            onClick={onWithdraw}
            disabled={isWithdrawing || !amount || !recipientAddress}
            className="w-full"
            isLoading={isWithdrawing}
            loadingInfo="Processing..."
          >
            Unshield
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
              <strong>Note:</strong> Your withdrawal will maintain privacy using
              zero-knowledge proofs. You will need to sign the transaction with
              your wallet.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
