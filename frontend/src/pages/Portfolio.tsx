import { PortfolioIcon } from "@/components/icons";
import { PageCard } from "@/components/layout/PageCard";
import { PortfolioPanel } from "@/components/wallet/portfolio-panel";
import { useHasher } from "@/lib/hooks";
import { Loader2 } from "lucide-react";

export default function Portfolio() {
  const { hasher, isLoading } = useHasher();

  return (
    <div className="w-full space-y-6">
      <PageCard>
        {/* Heading */}
        <div>
          <div className="flex items-center gap-2 px-[34px]">
            <PortfolioIcon className="w-5 h-5 text-primary-text" />
            <h2 className="text-xl font-bold text-primary-text">Private Portfolio</h2>
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
          {!isLoading && hasher && <PortfolioPanel hasher={hasher} />}
        </div>
      </PageCard>
    </div>
  );
}
