/**
 * Adaptive number formatting that shows appropriate decimal places based on the value
 * @param value - Number or string to format
 * @param options - Optional formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string,
  options?: {
    maxDecimals?: number;
    minDecimals?: number;
    removeTrailingZeros?: boolean;
  }
): string {
  const {
    maxDecimals = 9,
    minDecimals = 2,
    removeTrailingZeros = true,
  } = options || {};

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    return "0";
  }

  // Determine decimal places based on magnitude
  let decimals: number;
  const absNum = Math.abs(num);

  if (absNum === 0) {
    decimals = minDecimals;
  } else if (absNum >= 1000) {
    decimals = 2; // Large numbers: 1,234.56
  } else if (absNum >= 1) {
    decimals = 4; // Medium numbers: 12.3456
  } else if (absNum >= 0.01) {
    decimals = 6; // Small numbers: 0.012345
  } else if (absNum >= 0.0001) {
    decimals = 8; // Very small numbers: 0.00012345
  } else {
    decimals = maxDecimals; // Tiny numbers: 0.000000123
  }

  // Apply min/max constraints
  decimals = Math.min(Math.max(decimals, minDecimals), maxDecimals);

  let formatted = num.toFixed(decimals);

  if (removeTrailingZeros) {
    // Remove trailing zeros after decimal point
    formatted = formatted.replace(/\.?0+$/, "");
    
    // If we removed all decimals but minDecimals requires some, add them back
    const currentDecimals = formatted.includes(".") 
      ? formatted.split(".")[1].length 
      : 0;
    
    if (currentDecimals < minDecimals) {
      if (!formatted.includes(".")) {
        formatted += ".";
      }
      formatted += "0".repeat(minDecimals - currentDecimals);
    }
  }

  return formatted;
}

/**
 * Format a token amount with adaptive decimals
 * @param amount - Amount to format
 * @param symbol - Optional token symbol to append
 * @returns Formatted amount string with optional symbol
 */
export function formatTokenAmount(
  amount: number | string,
  symbol?: string
): string {
  const formatted = formatNumber(amount, {
    maxDecimals: 9,
    minDecimals: 2,
    removeTrailingZeros: true,
  });

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format balance display with "Max" button support
 * @param balance - Balance amount
 * @param symbol - Token symbol
 * @param showMax - Whether to show "Max" text
 * @returns Formatted balance string
 */
export function formatBalanceDisplay(
  balance: number | string,
  symbol: string,
  showMax: boolean = false
): string {
  const formatted = formatTokenAmount(balance, symbol);
  return showMax ? `${formatted} Max` : formatted;
}

