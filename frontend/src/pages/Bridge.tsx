import { BridgePanel } from "@/components/wallet/bridge-panel";
import { useHasher } from "@/lib/hooks";
import { Loader2 } from "lucide-react";
import { BridgeIcon } from "@/components/icons";

export default function Bridge() {
  const { hasher, isLoading } = useHasher();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 bg-linear-to-b from-[#151515] to-[#090909] rounded-3xl border border-[#8D1CF21F] overflow-hidden py-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 px-[34px]">
            <BridgeIcon className="h-5 w-5" />
            <h2 className="text-xl font-bold text-primary-text">Bridge</h2>
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
          {!isLoading && hasher && <BridgePanel hasher={hasher} />}
        </div>
      </div>
    </div>
  );
}
