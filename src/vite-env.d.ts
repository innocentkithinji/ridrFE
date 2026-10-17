/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RIDR_API_URL?: string;
  readonly VITE_RIDR_DEV_TOKEN?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
