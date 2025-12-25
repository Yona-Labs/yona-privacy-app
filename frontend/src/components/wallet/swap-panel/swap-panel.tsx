import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import { Loader2, BananaIcon } from "lucide-react";
import { useNavigate } from "react-router";
import {
  usePrivateBalance,
  useJupiterQuote,
  useJupiterPrice,
} from "@/lib/hooks";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { TokenInput, type TokenOption } from "@/components/TokenInput";
import { Button } from "@/components/Button";
import { useSwapExecute } from "./useSwapExecute";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { TokenInfo } from "@/lib/hooks/useTokens";
import { SwapIcon } from "@/components/icons";
import { SUPPORTED_TOKENS } from "@/lib/constants/supportedTokens";
import { JupiterQuoteResponse } from "@/lib/sdk/utils/jupiter";

interface SwapCalculations {
  buyingAmount: string;
  exchangeRate: string;
  transactionFee: number;
}

/**
 * Calculate derived swap values from quote and prices
 */
function calculateSwapValues(
  quote: JupiterQuoteResponse | null,
  sellingAmount: string,
  sellingToken: { address: string; symbol: string },
  buyingToken: { address: string; symbol: string },
  sellingTokenUsdPrice: number | null | undefined,
  buyingTokenUsdPrice: number | null | undefined
): SwapCalculations {
  if (!quote || !sellingAmount || parseFloat(sellingAmount) <= 0) {
    return {
      buyingAmount: "",
      exchangeRate: "",
      transactionFee: 0,
    };
  }

  const outputTokenInfo = getTokenInfo(buyingToken.address);
  const inputTokenInfo = getTokenInfo(sellingToken.address);

  const inDivisor = 10 ** inputTokenInfo.decimals;
  const inAmount = parseFloat(quote.inAmount) / inDivisor;

  const outDivisor = 10 ** outputTokenInfo.decimals;
  const outAmount = parseFloat(quote.outAmount) / outDivisor;
  const formattedOutAmount = outAmount.toFixed(outputTokenInfo.decimals);

  // Calculate exchange rate: 1 sellingToken = X buyingToken
  const rate = outAmount / parseFloat(sellingAmount);

  // Get USD price for display
  const outputPerOneUsdPrice = buyingTokenUsdPrice
    ? (outAmount / inAmount) * buyingTokenUsdPrice
    : null;

  const exchangeRate = outputPerOneUsdPrice
    ? `1 ${sellingToken.symbol} = ${rate.toFixed(9)} ${
        buyingToken.symbol
      } ($${outputPerOneUsdPrice.toFixed(2)})`
    : `1 ${sellingToken.symbol} = ${rate.toFixed(9)} ${buyingToken.symbol}`;

  const inputValueUsd =
    sellingTokenUsdPrice && sellingAmount
      ? parseFloat(sellingAmount) * sellingTokenUsdPrice
      : 0;
  const outputValueUsd =
    buyingTokenUsdPrice && outAmount ? outAmount * buyingTokenUsdPrice : 0;
  const fee = inputValueUsd - outputValueUsd;

  return {
    buyingAmount: formattedOutAmount,
    exchangeRate,
    transactionFee: fee,
  };
}

export const SwapPanel = ({ hasher }: { hasher: LightWasm }) => {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const navigate = useNavigate();
  const [sellingAmount, setSellingAmount] = useState("");
  const [sellingAmountInput, setSellingAmountInput] = useState("");
  const [sellingToken, setSellingToken] = useState(SUPPORTED_TOKENS[0]);
  const [buyingToken, setBuyingToken] = useState(SUPPORTED_TOKENS[1]);
  const [slippageBps] = useState(30);

  // Debounce selling amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setSellingAmount(sellingAmountInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [sellingAmountInput]);

  const handleSellingAmountChange = useCallback((value: string) => {
    setSellingAmountInput(value);
  }, []);

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

  // Get balances for currently selected tokens
  const sellingBalanceQuery = balanceQueries[
    SUPPORTED_TOKENS.findIndex((t) => t.address === sellingToken.address)
  ];
  const sellingBalance = sellingBalanceQuery?.data ?? 0;
  const isSellingBalanceLoading = sellingBalanceQuery?.isLoading ?? true;
  
  const buyingBalance =
    balanceQueries[
      SUPPORTED_TOKENS.findIndex((t) => t.address === buyingToken.address)
    ]?.data ?? 0;

  const handleMaxClick = useCallback(() => {
    const maxAmount = sellingBalance.toString();
    setSellingAmountInput(maxAmount);
    setSellingAmount(maxAmount);
  }, [sellingBalance]);

  // Get Jupiter quote
  const quoteQuery = useJupiterQuote(
    sellingToken.address,
    buyingToken.address,
    sellingAmount,
    slippageBps
  );

  // Get USD prices for both tokens
  const sellingTokenPriceQuery = useJupiterPrice(sellingToken.address);
  const buyingTokenPriceQuery = useJupiterPrice(buyingToken.address);

  const { handleSwap, isSwapping, error, statusMessage } =
    useSwapExecute(hasher);

  // Calculate derived values directly in render
  const { buyingAmount, exchangeRate, transactionFee } = calculateSwapValues(
    quoteQuery.data ?? null,
    sellingAmount,
    sellingToken,
    buyingToken,
    sellingTokenPriceQuery.data,
    buyingTokenPriceQuery.data
  );

  // Convert SUPPORTED_TOKENS to TokenOption format with private balances
  const tokenOptions: TokenOption[] = SUPPORTED_TOKENS.map((token, index) => ({
    mint: token.address,
    symbol: token.symbol,
    name: token.name,
    balance: (balanceQueries[index]?.data ?? 0).toFixed(6),
  }));

  const handleSwapTokens = () => {
    const temp = sellingToken;
    setSellingToken(buyingToken);
    setBuyingToken(temp);
    // Clear amounts when swapping tokens - new quote will be calculated
    setSellingAmount("");
    setSellingAmountInput("");
  };

  const onExecuteSwap = async () => {
    console.log("quoteQuery.data:", quoteQuery.data);
    console.log("sellingAmount:", sellingAmount);
    console.log("buyingAmount:", buyingAmount);
    console.log("sellingToken.address:", sellingToken.address);
    console.log("buyingToken.address:", buyingToken.address);
    console.log("sellingBalance:", sellingBalance);
    const success = await handleSwap(
      sellingAmount,
      buyingAmount,
      sellingToken.address,
      buyingToken.address,
      quoteQuery.data ?? null,
      sellingBalance
    );

    if (success) {
      setSellingAmount("");
      setSellingAmountInput("");
      // Invalidate queries to refresh all balances
      balanceQueries.forEach((query) => query.refetch());
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Selling Section */}
        <div>
          <TokenInput
            label="Selling"
            placeholder="0.0"
            disabled={isSwapping}
            amount={sellingAmountInput}
            name={sellingToken.name}
            ticker={sellingToken.symbol}
            onAmountChange={handleSellingAmountChange}
            tokens={tokenOptions}
            selectedTokenMint={sellingToken.address}
            onTokenSelect={(mint) => {
              const token = SUPPORTED_TOKENS.find((t) => t.address === mint);
              if (token) {
                if (token.address === buyingToken.address) {
                  // If same as buying token, swap them
                  handleSwapTokens();
                } else {
                  setSellingToken(token);
                }
              }
            }}
            balanceOverride={
              connected && publicKey
                ? `${sellingBalance.toFixed(4)} ${sellingToken.symbol}`
                : `0.0000 ${sellingToken.symbol}`
            }
            onMaxClick={connected && publicKey && !isSellingBalanceLoading ? handleMaxClick : undefined}
          />
        </div>

        {/* Swap Icon */}
        <div className="flex justify-between items-center my-2 px-3 gap-2">
          <div className="w-full border-b border-primary-border" />

          <button
            onClick={handleSwapTokens}
            disabled={isSwapping}
            className=" rounded-full p-2 hover:bg-primary-border/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10 cursor-pointer"
          >
            <SwapIcon className="h-6 w-6 rotate-90" />
          </button>

          <div className="w-full border-b border-primary-border" />
        </div>

        {/* Buying Section */}
        <div className="relative">
          <TokenInput
            label="Buying"
            placeholder="0.0"
            disabled={true}
            amount={buyingAmount}
            name={buyingToken.name}
            ticker={buyingToken.symbol}
            tokens={tokenOptions}
            selectedTokenMint={buyingToken.address}
            onTokenSelect={(mint) => {
              const token = SUPPORTED_TOKENS.find((t) => t.address === mint);
              if (token) {
                if (token.address === sellingToken.address) {
                  // If same as selling token, swap them
                  handleSwapTokens();
                } else {
                  setBuyingToken(token);
                }
              }
            }}
            balanceOverride={
              connected && publicKey
                ? `${buyingBalance.toFixed(4)} ${buyingToken.symbol}`
                : `0.0000 ${buyingToken.symbol}`
            }
            transparentBackground={true}
          />
          {quoteQuery.isFetching && (
            <div className="flex items-center gap-2 px-3 mt-2 absolute bottom-0 left-0 right-0">
              <Loader2 className="h-4 w-4 animate-spin text-secondary-text" />
              <span className="text-xs text-secondary-text">
                Calculating quote...
              </span>
            </div>
          )}
        </div>

        {connected && publicKey ? (
          parseFloat(sellingAmount) > sellingBalance && !quoteQuery.isFetching ? (
            <Button
              onClick={() => navigate("/shield")}
              className="w-full bg-primary-button-bg"
            >
              Insufficient balance. Shield first ↗
            </Button>
          ) : (
            <Button
              onClick={onExecuteSwap}
              disabled={
                isSwapping ||
                !sellingAmount ||
                !buyingAmount ||
                sellingToken.address === buyingToken.address ||
                quoteQuery.isFetching ||
                !quoteQuery.data
              }
              className="w-full"
              isLoading={isSwapping}
              loadingInfo="Executing Swap..."
            >
              Execute
            </Button>
          )
        ) : (
          <Button
            onClick={() => setVisible(true)}
            className="w-full"
            isLoading={connecting}
            loadingInfo="Connecting..."
          >
            Connect Wallet
          </Button>
        )}

        {/* Exchange Rate and Slippage */}
        {exchangeRate && (
          <div className="bg-secondary-bg rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-text">
                {exchangeRate}
              </span>
              <div className="flex items-center gap-2">
                {/* // todo: implement slippage settings */}
                {/* <Settings className="h-4 w-4 text-secondary-text" /> */}
                <BananaIcon className="h-4 w-4 text-secondary-text" />
                <span className="text-sm text-secondary-text">
                  {slippageBps / 100}%
                </span>
              </div>
            </div>
            {/* {transactionFee && (
                <div className="space-y-2 pt-2 border-t border-primary-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary-text">
                      Transaction Fees
                    </span>
                    <span className="text-secondary-text">
                      ≈ ${transactionFee}
                    </span>
                  </div>
                </div>
              )} */}
          </div>
        )}

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
      </div>
    </>
  );
};