import type { Transport } from "@connectrpc/connect";
import { TransportProvider } from "@connectrpc/connect-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { DevSession } from "@/app/dev-session";
import { MeProvider } from "@/app/me-provider";
import { env } from "@/config/env";
import { createQueryClient } from "@/lib/query-client";
import { useSession } from "@/lib/session";
import { createRidrTransport } from "@/lib/transport";

// AppProvider is the signed-in provider tree: the session (the dev token
// for now; Clerk joins here), then transport, query cache and GetMe.
export function AppProvider({ children }: { children: ReactNode }) {
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
