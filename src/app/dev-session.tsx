import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { SessionProvider, type Session } from "@/lib/session";

// DevSession signs in with the local stack's dev token, so no identity
// provider account is needed. The dev user is admin of one Organisation
// ("Dev tenant", org_dev), so there is no Organisation to switch to.
export function DevSession({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(true);
  const session = useMemo<Session>(
    () => ({
      key: "dev-user/org_dev",
      getToken: async () => env.devToken,
      signOut: async () => setSignedIn(false),
      organisationSwitcher: null,
    }),
    [],
  );
  if (!signedIn) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p>Signed out.</p>
        <Button onClick={() => setSignedIn(true)}>Sign in with the dev token</Button>
      </main>
    );
  }
  return <SessionProvider value={session}>{children}</SessionProvider>;
}
