/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RIDR_API_URL?: string;
  readonly VITE_RIDR_DEV_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
