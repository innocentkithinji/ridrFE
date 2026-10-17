import type { Transport } from "@connectrpc/connect";
import { TransportProvider } from "@connectrpc/connect-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { DevSession } from "@/app/dev-session";
import { MeProvider } from "@/app/me-provider";
import { Loading } from "@/components/states";
import { env } from "@/config/env";
import { createQueryClient } from "@/lib/query-client";
import { useSession } from "@/lib/session";
import { createRidrTransport } from "@/lib/transport";

// Clerk's code loads only when the app signs in with Clerk.
const ClerkSession = lazy(() =>
  import("@/app/clerk-session").then((m) => ({ default: m.ClerkSession })),
);

// AppProvider is the signed-in provider tree: the session (Clerk when a
// publishable key is set, the dev token otherwise), then transport,
// query cache and GetMe.
export function AppProvider({ children }: { children: ReactNode }) {
  if (env.clerkPublishableKey) {
    return (
      <Suspense fallback={<Loading what="sign-in" />}>
        <ClerkSession publishableKey={env.clerkPublishableKey}>
          <RidrProvider>{children}</RidrProvider>
        </ClerkSession>
      </Suspense>
    );
  }
  return (
    <DevSession>
      <RidrProvider>{children}</RidrProvider>
    </DevSession>
  );
}

type RidrProviderProps = {
  children: ReactNode;
  // Replaces the API transport; only a test seam would pass one.
  transport?: Transport;
};

// RidrProvider gives a signed-in session its transport, its own query
// cache and its GetMe.
export function RidrProvider(props: RidrProviderProps) {
  const session = useSession();
  const transport = useMemo(
    () => props.transport ?? createRidrTransport(env.apiUrl, session.getToken),
    [props.transport, session.getToken],
  );
  // A new key (another Organisation or user) remounts everything below:
  // Live queries close, the cache starts empty and GetMe reloads.
  return (
    <TransportProvider transport={transport}>
      <SessionCache key={session.key}>
        <MeProvider>{props.children}</MeProvider>
      </SessionCache>
    </TransportProvider>
  );
}

// SessionCache holds one session's query cache. It is never reused: the
// next session starts with a new, empty one, and this one is dropped.
function SessionCache({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
