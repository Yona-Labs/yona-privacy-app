import { useWallet } from "@solana/wallet-adapter-react";
import { LightWasm } from "@lightprotocol/hasher.rs";
import { Loader2 } from "lucide-react";
import { Link } from "react-router";
import { useUtxos } from "@/lib/hooks";
import { SwapIcon, ShieldIcon } from "@/components/icons";
import { Button } from "@/components/Button";

interface PortfolioAsset {
  symbol: string;
  iconType: "sol" | "token";
  quantity: number;
  quantityDisplay: string;
  mint?: string;
  tokenSymbol?: string;
  description: string;
  tokenIndex?: number;
}

/**
 * Calculate portfolio assets from UTXOs only (private tokens)
 */
function calculatePortfolioAssets(
  utxoBalance: number,
  tokenBalances: Array<{
    mint: string;
    symbol: string;
    decimals: number;
    balance: string;
  }>
): PortfolioAsset[] {
  const assets: PortfolioAsset[] = [];

  // Add SOL from UTXOs (private tokens only)
  if (utxoBalance > 0) {
    assets.push({
      symbol: "SOL",
      iconType: "sol",
      quantity: utxoBalance,
      quantityDisplay: `${utxoBalance.toFixed(2)} `,
      description: "Solana (Private)",
    });
  }

  // Add SPL tokens from UTXOs (private tokens associated with TOKEN_PROGRAM_ID)
  tokenBalances.forEach((token, index) => {
    const tokenAmount = parseFloat(token.balance);
    if (tokenAmount > 0) {
      assets.push({
        symbol: token.symbol,
        iconType: "token",
        tokenSymbol: token.symbol,
        quantity: tokenAmount,
        quantityDisplay: `${token.balance} `,
        mint: token.mint,
        description: "SPL Token (Private)",
        tokenIndex: index + 1,
      });
    }
  });

  return assets;
}

// Auto-assign logos for known tokens
const getTokenLogo = (symbol: string): string | undefined => {
  const logoMap: Record<string, string> = {
    SOL: "icons/solana-logo.png",
    USDC: "icons/usdc-logo.png",
    ZEC: "icons/zcash-logo.png",
    HSOL: "icons/helius-sol-logo.png",
  };
  return logoMap[symbol];
};

export const PortfolioPanel = ({ hasher }: { hasher: LightWasm }) => {
  const { publicKey, connected, connecting } = useWallet();

  // Fetch data using hooks - only UTXOs for private tokens
  const utxosQuery = useUtxos(hasher);

  // Calculate portfolio assets (only private tokens from UTXOs)
  const portfolioAssets = calculatePortfolioAssets(
    utxosQuery.data?.balance ?? 0,
    utxosQuery.data?.tokenBalances ?? []
  );

  // Assets are already calculated with token balances
  const assetsWithPrices = portfolioAssets;

  const isLoading = utxosQuery.isLoading;

  return (
    <>
      {(!connected || !publicKey) && !isLoading && !connecting && (
        <div className="text-center text-secondary-text py-2 px-6">
          Connect your wallet to view balances
        </div>
      )}

      {connecting && (
        <div className="flex items-center justify-center gap-2 flex-col py-2 px-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-secondary-text">Connecting to wallet...</p>
        </div>
      )}

      {connected && publicKey && isLoading && (
        <div className="flex items-center justify-center gap-2 flex-col py-2 px-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-secondary-text">Loading balances...</p>
        </div>
      )}

      {connected &&
        publicKey &&
        !isLoading &&
        assetsWithPrices.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <p className="text-secondary-text text-sm">
              No shielded assets found
            </p>
            <Link to="/shield">
              <Button className="text-base h-12">
                <div className="flex flex-nowrap items-center gap-2">
                  <ShieldIcon className="w-5 h-5" />
                  Shield
                </div>
              </Button>
            </Link>
          </div>
        )}

      {connected &&
        publicKey &&
        !isLoading &&
        assetsWithPrices.length > 0 &&
        assetsWithPrices.map((asset, index) => (
          <div
            key={index}
            className="py-4 px-6 hover:bg-secondary-bg transition-colors flex items-center"
          >
            {/* Left Side - Asset Info */}
            <div className="flex items-center gap-3 flex-1">
              {/* Asset Icon */}
              {(() => {
                const displayLogo = getTokenLogo(asset.symbol);
                
                return displayLogo ? (
                  <img
                    src={displayLogo}
                    alt={asset.symbol}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-tertiary-text to-secondary-text flex items-center justify-center">
                    <span className="text-primary-text font-bold text-xs">
                      {asset.symbol.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                );
              })()}

              {/* Asset Name and Details */}
              <div>
                <div className="mb-1">
                  <span className="text-primary-text font-medium">
                    {asset.symbol}
                  </span>
                </div>

              </div>
            </div>

            {/* Middle - Mint Column */}
            <div className="flex items-center justify-center flex-1">
              <div className="text-sm text-secondary-text font-mono">
                {asset.iconType === "sol" && "Native Token"}
                {asset.iconType === "token" &&
                  asset.mint &&
                  `${asset.mint.slice(0, 4)}...${asset.mint.slice(-4)}`}
                {asset.iconType === "token" && !asset.mint && "N/A"}
              </div>
            </div>

            {/* Right Side - Balance and Action */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="text-right">
                <div className="text-primary-text font-medium">
                  {asset.quantityDisplay}
                </div>
              </div>

              {/* Swap Icon */}
              <Link
                to="/swap"
                className="p-2 hover:bg-primary-bg rounded transition-colors cursor-pointer"
              >
                <SwapIcon className="w-5 h-5 text-secondary-text" />
              </Link>
            </div>
          </div>
        ))}
    </>
  );
};
