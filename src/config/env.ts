// Settings read from VITE_ variables at build time; see .env.example.
export const env = {
  apiUrl: import.meta.env.VITE_RIDR_API_URL || "http://localhost:18095",
  // The local stack's dev token (`make up`). The only sign-in for now.
  devToken: import.meta.env.VITE_RIDR_DEV_TOKEN || "dev-user-token",
};
