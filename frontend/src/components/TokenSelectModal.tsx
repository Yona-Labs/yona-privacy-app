import { FC, useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { TokenOption } from "./TokenInput";

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenOption[];
  selectedTokenMint?: string;
  onTokenSelect: (mint: string) => void;
}

export const TokenSelectModal: FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  tokens,
  selectedTokenMint,
  onTokenSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter tokens based on search query
  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.mint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTokenSelect = (mint: string) => {
    onTokenSelect(mint);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 bg-secondary-bg border border-primary-border rounded-2xl shadow-xl h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5">
          <h2 className="text-xl font-bold text-primary-text">Select Token</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-primary-bg rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5 text-primary-text" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-text" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, symbol, or address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary-bg border border-primary-border rounded-2xl text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredTokens.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-secondary-text">No tokens found</p>
            </div>
          )}
          {filteredTokens.length > 0 && (
            <div className="">
              {filteredTokens.map((token) => {
                // Auto-assign logos for known tokens if no logo is provided
                const getTokenLogo = (symbol: string): string | undefined => {
                  const logoMap: Record<string, string> = {
                    SOL: "icons/solana-logo.png",
                    USDC: "icons/usdc-logo.png",
                    ZEC: "icons/zcash-logo.png",
                    HSOL: "icons/helius-sol-logo.png",

                  };
                  return logoMap[symbol];
                };
                
                const displayLogo = token.logo || getTokenLogo(token.symbol);
                
                return (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => handleTokenSelect(token.mint)}
                    className={twMerge(
                      "w-full py-3 px-6 flex items-center gap-3 transition-colors last:rounded-bl-2xl cursor-pointer",
                      selectedTokenMint === token.mint && "bg-secondary-bg"
                    )}
                  >
                    {displayLogo ? (
                      <img
                        className="w-10 h-10 rounded-full shrink-0"
                        src={displayLogo}
                        alt={token.symbol}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full shrink-0 bg-linear-to-br from-tertiary-text to-secondary-text flex items-center justify-center">
                        <span className="text-primary-text font-bold text-sm">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-primary-text">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-secondary-text">
                        {token.name}
                      </div>
                    </div>
                    {token.balance && (
                      <div className="text-sm text-secondary-text">
                        {token.balance}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
