type BuildEnv = Record<string, string | undefined>;

// signInProblem says why a build can't go out, or null when it can. A
// production build must sign in with Clerk, or name its dev token on
// purpose, so it never falls back to the local stack's token unasked.
export function signInProblem(mode: string, env: BuildEnv): string | null {
  if (mode !== "production") return null;
  if (env.VITE_CLERK_PUBLISHABLE_KEY || env.VITE_RIDR_DEV_TOKEN) return null;
  return (
    "A production build needs VITE_CLERK_PUBLISHABLE_KEY, or " +
    "VITE_RIDR_DEV_TOKEN to build for a local stack on purpose."
  );
}
