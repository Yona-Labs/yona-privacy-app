import { FC, useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface NetworkOption {
  id: string;
  name: string;
  comingSoon?: boolean;
}

export interface BridgeTokenOption {
  mint: string;
  symbol: string;
  name: string;
  logo?: string;
  balance?: string;
}

interface TokenBridgeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  networks?: NetworkOption[];
  tokens?: BridgeTokenOption[];
  selectedNetwork?: string;
  selectedTokenMint?: string;
  onNetworkSelect?: (networkId: string) => void;
  onTokenSelect?: (mint: string) => void;
}

export const TokenBridgeSelectModal: FC<TokenBridgeSelectModalProps> = ({
  isOpen,
  onClose,
  networks = [],
  tokens = [],
  selectedNetwork,
  selectedTokenMint,
  onNetworkSelect,
  onTokenSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentNetwork, setCurrentNetwork] = useState<string | undefined>(selectedNetwork);
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
      setCurrentNetwork(selectedNetwork);
    }
  }, [isOpen, selectedNetwork]);

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

  const handleNetworkSelect = (networkId: string) => {
    setCurrentNetwork(networkId);
    if (onNetworkSelect) {
      onNetworkSelect(networkId);
    }
  };

  const handleTokenSelect = (mint: string) => {
    if (onTokenSelect) {
      onTokenSelect(mint);
    }
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
        className="relative w-full max-w-[460px] mx-4 bg-secondary-bg border border-primary-border rounded-2xl shadow-xl h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-4 py-2.5">
          <h2 className="text-xl font-bold text-primary-text">
            Select a network
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-primary-bg rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5 text-primary-text" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Network Selection */}
          {networks.length > 0 && (
            <div className="flex gap-2 px-4 flex-wrap">
              {networks.map((network) => (
                <button
                  key={network.id}
                  type="button"
                  onClick={() => !network.comingSoon && handleNetworkSelect(network.id)}
                  disabled={network.comingSoon}
                  className={twMerge(
                    "min-w-[101px] h-[34px] px-3 font-medium leading-[18px] rounded-xl flex justify-center items-center gap-1.5 select-none transition-all",
                    network.comingSoon
                      ? "text-white/30 bg-disabled cursor-not-allowed"
                      : "cursor-pointer hover:text-white hover:bg-[#8800FF33] hover:border hover:border-[#8800FF]",
                    !network.comingSoon && currentNetwork === network.id
                      ? "border border-[#8800FF] bg-[#8800FF33] text-white"
                      : !network.comingSoon && "text-white/50 bg-disabled"
                  )}
                >
                  <span>{network.name}</span>
                  {network.comingSoon && (
                    <span className="text-[10px] text-white/30">Soon</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-text" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tokens"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary-bg border border-primary-border rounded-2xl text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
            {filteredTokens.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-secondary-text">No tokens found</p>
              </div>
            )}
            {filteredTokens.length > 0 && (
              <div className="flex flex-col gap-3">
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
                        "px-3 py-2.5 h-[53px] flex items-center gap-3 rounded-xl transition-colors cursor-pointer",
                        "hover:bg-primary-bg",
                        selectedTokenMint === token.mint && "bg-primary-bg"
                      )}
                    >
                      {displayLogo ? (
                        <img
                          className="w-[34px] h-[34px] min-w-[34px] min-h-[34px] rounded-full"
                          src={displayLogo}
                          alt={token.symbol}
                        />
                      ) : (
                        <div className="w-[34px] h-[34px] min-w-[34px] min-h-[34px] rounded-full bg-linear-to-br from-tertiary-text to-secondary-text flex items-center justify-center">
                          <span className="text-primary-text font-bold text-sm">
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-1 items-center flex-1">
                        <div className="text-white font-semibold text-base">
                          {token.symbol}
                        </div>
                      <div className="text-sm text-white/48">
                        {token.name}
                      </div>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
