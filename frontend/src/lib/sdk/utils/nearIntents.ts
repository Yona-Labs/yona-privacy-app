/**
 * 1Click API client for cross-chain swaps via NEAR Intents
 * Solana to Zcash bridge integration
 * Documentation: https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api
 * 
 * Note: Using mock data for offline development
 */

const NEAR_INTENTS_API_BASE = "https://1click.chaindefuser.com";

export interface NearIntentsToken { 
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: string;
  priceUpdatedAt: string;
  contractAddress?: string;
}

export interface NearIntentsQuoteRequest {
  dry: boolean;
  depositMode?: "SIMPLE" | "MEMO";
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance?: number;
  originAsset: string;
  depositType?: "ORIGIN_CHAIN" | "DESTINATION_CHAIN";
  destinationAsset: string;
  amount: string;
  refundTo?: string;
  refundType?: "ORIGIN_CHAIN" | "DESTINATION_CHAIN";
  recipient?: string;
  recipientType?: "ORIGIN_CHAIN" | "DESTINATION_CHAIN";
  deadline?: string;
  referral?: string;
}

export interface NearIntentsQuote {
  depositAddress: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  minAmountIn?: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut?: string;
  deadline: string;
  timeWhenInactive: string;
  timeEstimate: number;
}

export interface NearIntentsQuoteResponse {
  timestamp: string;
  signature: string;
  quoteRequest: NearIntentsQuoteRequest;
  quote: NearIntentsQuote;
}

export interface NearIntentsStatusResponse {
  quoteResponse: NearIntentsQuoteResponse; 
  status: "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "PROCESSING" | "SUCCESS" | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED";
  updatedAt: string;
  swapDetails?: {
    intentHashes?: string[];
    nearTxHashes?: string[];
    amountIn?: string;
    amountInFormatted?: string;
    amountInUsd?: string;
    amountOut?: string;
    amountOutFormatted?: string;
    amountOutUsd?: string;
    slippage?: number;
    originChainTxHashes?: Array<{
      hash: string;
      explorerUrl: string;
    }>;
    destinationChainTxHashes?: Array<{
      hash: string;
      explorerUrl: string;
    }>;
    refundedAmount?: string;
    refundedAmountFormatted?: string;
    refundedAmountUsd?: string;
    depositedAmount?: string;
    depositedAmountFormatted?: string;
    depositedAmountUsd?: string;
  };
}

export interface NearIntentsDepositSubmitRequest {
  txHash: string;
  depositAddress: string;
  nearSenderAccount?: string;
  memo?: string;
}

/**
 * Mock tokens data for offline development
 */
const INTENTS_TOKENS: NearIntentsToken[] = [
  {
    assetId: "nep141:sol.omft.near",
    decimals: 9,
    blockchain: "sol",
    symbol: "SOL",
    price: "140.31",
    priceUpdatedAt: new Date().toISOString(),
    contractAddress: "So11111111111111111111111111111111111111112",
  },
  {
    assetId: "nep141:zec.omft.near",
    decimals: 8,
    blockchain: "zec",
    symbol: "ZEC",
    price: "337.91",
    priceUpdatedAt: new Date().toISOString(),
  },
];

/**
 * Get all supported tokens from NEAR Intents API
 */
export async function getNearIntentsTokens(): Promise<NearIntentsToken[]> {

  return INTENTS_TOKENS;
  
  
  // const response = await fetch(`${OMNI_API_BASE}/v0/tokens`);
  
  // if (!response.ok) {
  //   throw new Error(`Failed to fetch tokens: ${response.statusText}`);
  // }
  
  // return response.json();
}

/**
 * Get a specific token by symbol and blockchain
 */
export async function getNearIntentsToken(
  symbol: string,
  blockchain: string
): Promise<NearIntentsToken | null> {
  const tokens = await getNearIntentsTokens();
  return tokens.find(
    (token) => token.symbol === symbol && token.blockchain === blockchain
  ) || null;
}

/**
 * Get SOL token from 1Click
 */
export async function getNearIntentsSolToken(): Promise<NearIntentsToken | null> {
  return getNearIntentsToken("SOL", "sol");  
}

/**
 * Get ZEC token from 1Click
 */
export async function getNearIntentsZecToken(): Promise<NearIntentsToken | null> {
  return getNearIntentsToken("ZEC", "zec");
}

/**
 * Request a quote for cross-chain swap from 1Click API
 */
export async function getNearIntentsQuote(
  request: NearIntentsQuoteRequest
): Promise<NearIntentsQuoteResponse> {
  
  const response = await fetch(`${NEAR_INTENTS_API_BASE}/v0/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to get quote: ${response.statusText}`
    );
  }
  
  return response.json();
}

/**
 * Check the status of a bridge transaction
 */
export async function getOmniStatus(
  depositAddress: string
): Promise<NearIntentsStatusResponse> {

  
  const response = await fetch(
    `${NEAR_INTENTS_API_BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Submit deposit transaction hash to 1Click API
 * This speeds up swap processing by allowing the system to preemptively verify the deposit
 */
export async function submitOmniDeposit(
  request: NearIntentsDepositSubmitRequest
): Promise<void> {
  const response = await fetch(`${NEAR_INTENTS_API_BASE}/v0/deposit/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to submit deposit: ${response.statusText}`
    );
  }
  
  // API returns empty response on success
}

/**
 * Calculate exchange rate from quote response
 */
export function calculateNearIntentsExchangeRate(
  quote: NearIntentsQuoteResponse,
  originSymbol: string,
  destinationSymbol: string
): string {
  const amountIn = parseFloat(quote.quote.amountInFormatted);
  const amountOut = parseFloat(quote.quote.amountOutFormatted);
  
  if (amountIn <= 0) {
    return "";
  }
  
  const rate = amountOut / amountIn;
  const amountOutUsd = parseFloat(quote.quote.amountOutUsd);
  
  return `1 ${originSymbol} = ${rate.toFixed(8)} ${destinationSymbol} ($${amountOutUsd.toFixed(2)})`;
}

