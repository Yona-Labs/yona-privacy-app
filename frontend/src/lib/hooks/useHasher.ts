import { useEffect, useState } from "react";
import { LightWasm } from "@lightprotocol/hasher.rs";

/**
 * Hook to load and get the Light WASM hasher instance
 * Returns the hasher instance and loading state
 */
export function useHasher(): { hasher: LightWasm | null; isLoading: boolean } {
  const [hasher, setHasher] = useState<LightWasm | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const { WasmFactory } = await import("@lightprotocol/hasher.rs");
        const lightWasm = await WasmFactory.getInstance();
        setHasher(lightWasm);
      } catch (err) {
        console.error("Failed to load wasm hasher:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { hasher, isLoading };
}
