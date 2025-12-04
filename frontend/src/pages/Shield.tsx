import { ShieldIcon } from "@/components/icons";
import { PageCard } from "@/components/layout/PageCard";
import { ShieldPanel } from "@/components/wallet/shield-panel";
import { useHasher } from "@/lib/hooks";
import { Loader2 } from "lucide-react";

export default function Shield() {
  const { hasher, isLoading } = useHasher();

  return (
    <div className="w-full space-y-6">
      <PageCard>
        {/* Heading */}
        <div>
          <div className="flex items-center gap-2 px-[34px]">
            <ShieldIcon className="w-5 h-5 text-primary-text" />
            <h2 className="text-xl font-bold text-primary-text">Shield</h2>
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
          {!isLoading && hasher && <ShieldPanel hasher={hasher} />}
        </div>
      </PageCard>
    </div>
  );
}
