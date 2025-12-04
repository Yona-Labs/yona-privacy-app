import { ArrowLeft } from "lucide-react";
import { SwapPanel } from "@/components/wallet/swap-panel";
import { useHasher } from "@/lib/hooks";
import { Loader2 } from "lucide-react";
import { SwapIcon } from "@/components/icons";
import { PageCard } from "@/components/layout/PageCard";

export default function Swap() {
  const { hasher, isLoading } = useHasher();

  return (
    <div className="w-full space-y-6">
      <PageCard>
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 px-[34px]">
            <SwapIcon className="h-5 w-5" />
            <h2 className="text-xl font-bold text-primary-text">Swap</h2>
          </div>
        </div>

        <div className="px-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 flex-col py-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-secondary-text">Loading hasher...</p>
            </div>
          )}
          {/* Content */}
          {!isLoading && hasher && <SwapPanel hasher={hasher} />}
        </div>
      </PageCard>
    </div>
  );
}
