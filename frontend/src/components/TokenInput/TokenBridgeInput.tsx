import { ChangeEventHandler, FC, useRef, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { TokenBridgeSelectModal, type NetworkOption, type BridgeTokenOption } from "../TokenBridgeSelectModal";
import { processAmountInput } from "./processAmountInput";

interface TokenBridgeInputProps {
  label: string;
  logo?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  amount: string;
  name: string;
  ticker: string;
  onAmountChange?: (value: string) => void;
  networks: NetworkOption[];
  tokens: BridgeTokenOption[];
  selectedNetwork?: string;
  selectedTokenMint?: string;
  onNetworkSelect?: (networkId: string) => void;
  onTokenSelect?: (mint: string) => void;
  balanceOverride?: string;
  transparentBackground?: boolean;
  maxDecimals?: number;
  hideTokenSelector?: boolean;
}

export const TokenBridgeInput: FC<TokenBridgeInputProps> = ({
  label,
  logo,
  placeholder = "0",
  disabled,
  autoFocus,
  onAmountChange,
  amount,
  name,
  ticker,
  networks,
  tokens,
  selectedNetwork,
  selectedTokenMint,
  onNetworkSelect,
  onTokenSelect,
  balanceOverride,
  transparentBackground = false,
  maxDecimals = 9,
  hideTokenSelector = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showTokenSelect = !hideTokenSelector && tokens && tokens.length > 0 && onTokenSelect;

  const handleAmountInput: ChangeEventHandler<HTMLInputElement> = (event) => {
    const processedValue = processAmountInput(
      event.target.value,
      amount,
      maxDecimals
    );

    // Call the original handler with the processed value
    onAmountChange?.(processedValue);
  };

  // Auto-assign logos for known tokens if no logo is provided
  const getTokenLogo = (ticker: string): string | undefined => {
    const logoMap: Record<string, string> = {
      SOL: "icons/solana-logo.png",
      USDC: "icons/usdc-logo.png",
      ZEC: "icons/zcash-logo.png",
      HSOL: "icons/helius-sol-logo.png",
    };
    return logoMap[ticker];
  };

  const displayLogo = logo || getTokenLogo(ticker);

  return (
    <>
      <div className="w-full flex flex-col justify-between items-start relative">
        <div className="leading-6 text-tertiary-text px-3 flex items-center justify-between w-full text-sm">
          <div>{label}</div>


        </div>

        <div
          className={twMerge(
            "flex flex-1 gap-3 p-4 rounded-xl mt-2 w-full",
            transparentBackground ? "bg-transparent" : "bg-secondary-bg"
          )}
        >
          <div className="flex-1 min-w-0">
            <input
              className="text-3xl leading-[45px] font-medium bg-transparent outline-none transition-all ease-linear w-full min-w-0"
              ref={inputRef}
              disabled={disabled}
              autoFocus={autoFocus}
              placeholder={placeholder}
              type="text"
              pattern="\d+([\.\,]\d+)?$"
              inputMode="decimal"
              value={amount ?? ""}
              onChange={handleAmountInput}
            />
          </div>

          <div
            className="flex gap-[7px] flex-col cursor-pointer"
            onClick={() => !hideTokenSelector && setIsModalOpen(true)}
          >
            <div className="flex gap-3 justify-end items-center">
              {displayLogo ? (
                <img
                  className="w-[34px] h-[34px] rounded-full shrink-0"
                  src={displayLogo}
                  alt={ticker}
                />
              ) : (
                <div className="w-[34px] h-[34px] rounded-full shrink-0 bg-linear-to-br from-tertiary-text to-secondary-text flex items-center justify-center">
                  <span className="text-primary-text font-bold text-xs">
                    {ticker.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div
                className="flex gap-3 justify-center items-center relative"
                onClick={() => !hideTokenSelector && setIsModalOpen(true)}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="font-semibold">{ticker}</div>
                </div>

                {showTokenSelect && (
                  <div className="flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronDown className="h-5 w-5 text-primary-text" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bridge Token Select Modal */}
      {showTokenSelect && (
        <TokenBridgeSelectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          networks={networks}
          tokens={tokens}
          selectedNetwork={selectedNetwork}
          selectedTokenMint={selectedTokenMint}
          onNetworkSelect={onNetworkSelect}
          onTokenSelect={(mint) => {
            if (onTokenSelect) {
              onTokenSelect(mint);
            }
          }}
        />
      )}
    </>
  );
};

