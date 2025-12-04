/**
 * Processes and validates numeric input for token amounts
 * Pure function that returns the processed value (always a string)
 * @param newInputValue - The raw input value from the user
 * @param maxDecimals - Maximum number of decimal places allowed (default: 9)
 * @returns The processed value as a string (empty string if invalid)
 */
export const processAmountInput = (
  newInputValue: string,
  currentInputValue: string,
  maxDecimals: number = 9
): string => {
  const unifiedDotValue = newInputValue.replace(",", ".");

  // currently limiting decimals to 4 to avoid any error on PoC, real system amount of decimals is 6
  // const maxDecimals = 4;
  const isDecimalsLimitExceeded =
    unifiedDotValue.includes(".") &&
    unifiedDotValue.split(".").at(1)!.length > maxDecimals;

  const isAmountInvalid =
    (Number.isNaN(Number(unifiedDotValue)) && unifiedDotValue !== "") ||
    isDecimalsLimitExceeded;

  if (isAmountInvalid) {
    return currentInputValue;
  }

  // trimming leading zeros
  const processedValue =
    unifiedDotValue.length > 1 &&
    unifiedDotValue[0] === "0" &&
    unifiedDotValue[1] !== "."
      ? unifiedDotValue.slice(1)
      : unifiedDotValue;

  return processedValue;
};
