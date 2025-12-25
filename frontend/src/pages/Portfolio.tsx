import { PortfolioIcon } from "@/components/icons";
import { PageCard } from "@/components/layout/PageCard";
import { PortfolioPanel } from "@/components/wallet/portfolio-panel";
import { useHasher } from "@/lib/hooks";
import { Loader2, Share2, RefreshCw } from "lucide-react";
import { ReferralModal } from "@/components/ReferralModal";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { localstorageKey } from "@/lib/sdk/utils/getMyUtxos";
import { toast } from "sonner";

export default function Portfolio() {
  const { hasher, isLoading } = useHasher();
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const [isReloading, setIsReloading] = useState(false);

  const handleReloadUtxos = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsReloading(true);
    try {
      // Clear localStorage keys for UTXOs and notes
      const storageKey = localstorageKey(publicKey);
      localStorage.removeItem("fetchUtxoOffset" + storageKey);
      localStorage.removeItem("encryptedOutputs" + storageKey);
      
      // Invalidate and refetch UTXOs query
      await queryClient.invalidateQueries({ queryKey: ["utxos"] });
      
      toast.success("UTXOs reloaded successfully");
    } catch (error) {
      console.error("Error reloading UTXOs:", error);
      toast.error("Failed to reload UTXOs");
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <PageCard>
        {/* Heading */}
        <div>
          <div className="flex items-center justify-between px-[34px]">
            <div className="flex items-center gap-2">
              <PortfolioIcon className="w-5 h-5 text-primary-text" />
              <h2 className="text-xl font-bold text-primary-text">Private Portfolio</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReloadUtxos}
                disabled={isReloading || !publicKey}
                className="flex items-center gap-2 px-4 py-2 bg-primary-button-bg/10 hover:bg-secondary-bg rounded-xl text-primary-text transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-semibold">Reload UTXOs</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReferralModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-button-bg hover:bg-secondary-bg rounded-xl text-primary-text transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Referral</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 flex-col py-2 px-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-secondary-text">Loading hasher...</p>
            </div>
          )}
          {/* Content */}
          {!isLoading && hasher && <PortfolioPanel hasher={hasher} isReloading={isReloading} />}
        </div>
      </PageCard>

      {/* Referral Modal */}
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </div>
  );
}
