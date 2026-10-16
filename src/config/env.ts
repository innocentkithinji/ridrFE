// Settings read from VITE_ variables at build time; see .env.example.
export const env = {
  apiUrl: import.meta.env.VITE_RIDR_API_URL || "http://localhost:18095",
  // The default suits `make up`; a production build must set this or the
  // Clerk key, so it never signs in this way by accident (see sign-in.ts).
  devToken: import.meta.env.VITE_RIDR_DEV_TOKEN || "dev-user-token",
  // Empty means the dev token signs in, with no Clerk account needed.
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "",
};
