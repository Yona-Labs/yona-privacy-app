import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import { Loader2, BananaIcon } from "lucide-react";
import {
  usePrivateBalance,
  useNearIntentsQuote, 
} from "@/lib/hooks";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { TokenInput, type TokenOption, TokenBridgeInput } from "@/components/TokenInput";
import { Button } from "@/components/Button";
import { useBridgeExecute } from "./useBridgeExecute";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { TokenInfo } from "@/lib/hooks/useTokens";
import { BridgeIcon } from "@/components/icons";
import { SUPPORTED_TOKENS } from "@/lib/constants/supportedTokens";
import { NearIntentsQuoteResponse, calculateNearIntentsExchangeRate } from "@/lib/sdk/utils/nearIntents";
import { WITHDRAW_FEE_RATE } from "@/lib/sdk/utils/constants";
import { type NetworkOption, type BridgeTokenOption } from "@/components/TokenBridgeSelectModal";

interface BridgeCalculations {
  buyingAmount: string;
  exchangeRate: string;
  transactionFee: number;
  withdrawFee: number;
  totalFee: number;
}

/**
 * Calculate derived bridge values from Omni quote
 */
function calculateBridgeValues(
  quote: NearIntentsQuoteResponse | null,
  sellingToken: { symbol: string },
  buyingToken: { symbol: string },
  sellingAmount: string
): BridgeCalculations {
  if (!quote) {
    return {
      buyingAmount: "",
      exchangeRate: "",
      transactionFee: 0,
      withdrawFee: 0,
      totalFee: 0,
    };
  }

  const buyingAmount = quote.quote.amountOutFormatted;
  const exchangeRate = calculateNearIntentsExchangeRate(
    quote,
    sellingToken.symbol,
    buyingToken.symbol
  );
  
  const inputValueUsd = parseFloat(quote.quote.amountInUsd);
  const outputValueUsd = parseFloat(quote.quote.amountOutUsd);
  const nearIntentsBridgeFee = inputValueUsd - outputValueUsd;

  // Calculate withdraw fee (0.25% of the amount)
  const sellingAmountNum = parseFloat(sellingAmount);
  const withdrawFeeAmount = sellingAmountNum * WITHDRAW_FEE_RATE;
  const withdrawFeeUsd = withdrawFeeAmount * (inputValueUsd / sellingAmountNum);

  const totalFee = nearIntentsBridgeFee + withdrawFeeUsd;

  return {
    buyingAmount,
    exchangeRate,
    transactionFee: nearIntentsBridgeFee,
    withdrawFee: withdrawFeeUsd,
    totalFee,
  };
}

// Bridge tokens - SOL and ZCASH only
const SOL_TOKEN = SUPPORTED_TOKENS.find(t => t.symbol === "SOL")!;
const ZCASH_TOKEN = SUPPORTED_TOKENS.find(t => t.symbol === "ZEC")!;  

// Define available networks for bridge
const BRIDGE_NETWORKS: NetworkOption[] = [
  { id: "zcash", name: "ZEC", comingSoon: false },
  { id: "ethereum", name: "Ethereum", comingSoon: true },
  { id: "base", name: "Base", comingSoon: true },
];

const BRIDGE_TOKENS: BridgeTokenOption[] = [
  {
    mint: "zcash-native",
    symbol: "ZEC",
    name: "ZCash",
    logo: "icons/zcash-logo.png",
  },
];

export const BridgePanel = ({ hasher }: { hasher: LightWasm }) => {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [sellingAmount, setSellingAmount] = useState("");
  const [sellingAmountInput, setSellingAmountInput] = useState("");
  const [sellingToken, setSellingToken] = useState(SOL_TOKEN);
  const [buyingToken, setBuyingToken] = useState(ZCASH_TOKEN);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("zec");
  const [destinationNetwork, setDestinationNetwork] = useState<string>("zcash");
  const [refundNetwork, setRefundNetwork] = useState<string>("zcash");
  const [slippageBps] = useState(100);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [refundAddress, setRefundAddress] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSellingAmount(sellingAmountInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [sellingAmountInput]);

  const handleSellingAmountChange = useCallback((value: string) => {
    setSellingAmountInput(value);
  }, []);

  
  // Convert SUPPORTED_TOKENS to TokenOption format for usePrivateBalance
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
  const sellingBalance = balanceQueries[
    SUPPORTED_TOKENS.findIndex(t => t.address === sellingToken.address)
  ]?.data ?? 0;


  // Convert SUPPORTED_TOKENS to TokenOption format with private balances for "From" selector
  const tokenOptions: TokenOption[] = SUPPORTED_TOKENS.map((token, index) => ({
    mint: token.address,
    symbol: token.symbol,
    name: token.name,
    balance: (balanceQueries[index]?.data ?? 0).toFixed(6),
  }));

  // Convert BRIDGE_TOKENS to BridgeTokenOption format for "To" selector
  const bridgeTokenOptions: BridgeTokenOption[] = BRIDGE_TOKENS.map((token) => {
    const index = SUPPORTED_TOKENS.findIndex(t => t.address === token.mint);
    return {
      ...token,
      balance: index >= 0 ? (balanceQueries[index]?.data ?? 0).toFixed(6) : undefined,
    };
  });

  const { handleBridge, isSwapping, error, statusMessage } =
    useBridgeExecute(hasher);

  // Get Omni quote for the bridge transaction
  // Use dry: false to get actual deposit address
  const quoteQuery = useNearIntentsQuote(
    sellingAmount,
    destinationAddress,
    refundAddress,
    destinationAddress && refundAddress ? false : true // Get actual deposit address (not dry run)
  );
  
  // Calculate derived values from quote
  const { buyingAmount, exchangeRate, transactionFee, withdrawFee, totalFee } = calculateBridgeValues(
    quoteQuery.data ?? null,
    sellingToken,
    buyingToken,
    sellingAmount
  );

  const onExecuteBridge = async () => {
    if (!quoteQuery.data?.quote.depositAddress) {
      console.error("No deposit address available");
      return;
    }

    console.log("Bridge execution:");
    console.log("- Amount:", sellingAmount, sellingToken.symbol);
    console.log("- Deposit Address:", quoteQuery.data.quote.depositAddress);
    console.log("- Destination:", destinationAddress);
    console.log("- Will receive:", buyingAmount, buyingToken.symbol);
    
    const success = await handleBridge(
      sellingAmount,
      buyingAmount,
      sellingToken.address,
      buyingToken.address,
      null, // Bridge doesn't use Jupiter quote
      sellingBalance,
      quoteQuery.data.quote.depositAddress // Pass deposit address
    );

    if (success) {
      setSellingAmount("");
      setSellingAmountInput("");
      // Invalidate queries to refresh all balances
      balanceQueries.forEach(query => query.refetch());
    }
  };

  return (
    <>
      <div className="space-y-4">
          {/* Selling Section */}
          <div>
            <TokenInput
              label="From"
              placeholder="0.0"
              disabled={isSwapping}
              amount={sellingAmountInput}
              name={sellingToken.name}
              ticker={sellingToken.symbol}
              onAmountChange={handleSellingAmountChange}
              tokens={tokenOptions.filter((t) => t.symbol == "SOL")}
              selectedTokenMint={sellingToken.address}
              onTokenSelect={(mint) => {
                const token = SUPPORTED_TOKENS.find((t) => t.address === mint);
                if (token) {
                  setSellingToken(token);
                }
              }}
              balanceOverride={
                connected && publicKey
                  ? `${sellingBalance.toFixed(4)} ${sellingToken.symbol} Max`
                  : `0.0000 ${sellingToken.symbol}`
              }
            />
          </div>

          {/* Swap Icon */}
          <div className="flex justify-between items-center my-2 px-3 gap-2">
            <div className="w-full border-b border-primary-border" />

            <button
              disabled={true}
              className=" rounded-full p-2 hover:bg-primary-border/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10 cursor-pointer"
            >
              <BridgeIcon className="h-6 w-6 rotate-90" />
            </button>

            <div className="w-full border-b border-primary-border" />
          </div>

          {/* Buying Section */}
          <div className="relative">
            <TokenBridgeInput
              label="To"
              placeholder="0.0"
              disabled={true}
              amount={buyingAmount}
              name={buyingToken.name}
              ticker={buyingToken.symbol}
              networks={BRIDGE_NETWORKS}
              tokens={bridgeTokenOptions}
              selectedNetwork={selectedNetwork}
              selectedTokenMint={buyingToken.address}
              onNetworkSelect={(networkId) => setSelectedNetwork(networkId)}
              onTokenSelect={(mint) => {
                const token = SUPPORTED_TOKENS.find((t) => t.address === mint);
                if (token) {
                  setBuyingToken(token);
                }
              }}
              transparentBackground={true}
            />
            {/* {quoteQuery.isFetching && (
              <div className="flex items-center gap-2 px-3 mt-2 absolute bottom-0 left-0 right-0">
                <Loader2 className="h-4 w-4 animate-spin text-secondary-text" />
                <span className="text-xs text-secondary-text">
                  Calculating quote...
                </span>
              </div>
            )} */}
          </div>

          {/* Destination Address Input */}
          <div>
            <label
              htmlFor="destination-address"
              className="block text-sm text-tertiary-text mb-2 px-3"
            >
              Destination Address
            </label>
            <input
              id="destination-address"
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              disabled={isSwapping}
              placeholder="Enter Destination Address"
              className="w-full px-4 py-3 bg-secondary-bg rounded-xl text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Refund Address Input */}
          <div>
            <label
              htmlFor="refund-address"
              className="block text-sm text-tertiary-text mb-2 px-3"
            >
              Refund Address
            </label>
            <input
              id="refund-address"
              type="text"
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              disabled={isSwapping}
              placeholder="Enter Refund Address"
              className="w-full px-4 py-3 bg-secondary-bg rounded-xl text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

        

          {connected && publicKey ? (
            <Button
              onClick={onExecuteBridge}
              disabled={
                isSwapping ||
                !sellingAmount ||
                !buyingAmount ||
                sellingToken.address === buyingToken.address ||
                quoteQuery.isFetching ||
                !quoteQuery.data ||
                !destinationAddress ||
                !refundAddress
              }
              className="w-full"
              isLoading={quoteQuery.isFetching?true:isSwapping}
              loadingInfo={quoteQuery.isFetching?"Calculating quote...":"Executing Swap..."}
            >
              Execute
            </Button>
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
          {exchangeRate && refundAddress && destinationAddress && (
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
              {transactionFee && (
                <div className="space-y-2 pt-2 border-t border-primary-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary-text">
                      Transaction Fees
                    </span>
                    <span className="text-secondary-text">
                      ≈ $
                      {transactionFee < 0
                        ? transactionFee.toPrecision(2)
                        : transactionFee.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
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
