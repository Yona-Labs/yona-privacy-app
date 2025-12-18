import { WITHDRAW_FEE_RATE, SWAP_FEE_RATE } from "@/lib/sdk/utils/constants";
import { getTokenInfo } from "@/lib/sdk/utils/tokenInfo";
import { formatNumber } from "./formatNumber";

/**
 * Calculate withdrawal fee based on amount and token decimals
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @param tokenMint - Token mint address
 * @returns Object with fee amount in human-readable format and raw fee in lamports/smallest units
 */
export function calculateWithdrawFee(
  amount: string,
  tokenMint: string
): { feeAmount: string; feeInSmallestUnits: number } {
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { feeAmount: "0", feeInSmallestUnits: 0 };
  }

  const tokenInfo = getTokenInfo(tokenMint);
  const amountInSmallestUnits = Math.floor(
    amountNum * Math.pow(10, tokenInfo.decimals)
  );
  const feeInSmallestUnits = Math.floor(
    amountInSmallestUnits * WITHDRAW_FEE_RATE
  );
  const feeAmountNum = feeInSmallestUnits / Math.pow(10, tokenInfo.decimals);
  const feeAmount = formatNumber(feeAmountNum, {
    maxDecimals: tokenInfo.decimals,
    minDecimals: 2,
    removeTrailingZeros: true,
  });

  return { feeAmount, feeInSmallestUnits };
}

/**
 * Calculate swap fee based on amount and token decimals
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @param tokenMint - Token mint address
 * @returns Object with fee amount in human-readable format and raw fee in lamports/smallest units
 */
export function calculateSwapFee(
  amount: string,
  tokenMint: string
): { feeAmount: string; feeInSmallestUnits: number } {
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { feeAmount: "0", feeInSmallestUnits: 0 };
  }

  const tokenInfo = getTokenInfo(tokenMint);
  const amountInSmallestUnits = Math.floor(
    amountNum * Math.pow(10, tokenInfo.decimals)
  );
  const feeInSmallestUnits = Math.floor(
    amountInSmallestUnits * SWAP_FEE_RATE
  );
  const feeAmountNum = feeInSmallestUnits / Math.pow(10, tokenInfo.decimals);
  const feeAmount = formatNumber(feeAmountNum, {
    maxDecimals: tokenInfo.decimals,
    minDecimals: 2,
    removeTrailingZeros: true,
  });

  return { feeAmount, feeInSmallestUnits };
}

