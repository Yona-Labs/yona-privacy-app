/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_SOLANA_RPC_HOST?: string;
  readonly VITE_RELAYER_URL?: string;
  readonly VITE_INDEXER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

