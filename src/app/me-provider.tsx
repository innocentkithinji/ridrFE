import { useQuery } from "@connectrpc/connect-query";
import { AccessService } from "@ridr/web";
import type { ReactNode } from "react";
import { SessionControls } from "@/components/session-controls";
import { ErrorState, Loading } from "@/components/states";
import { isOrganisationNotSetUp } from "@/lib/errors";
import { MeContextProvider } from "@/lib/me";

// MeProvider loads who the user is, and what they may do, before any
// screen renders, so no screen shows without knowing its Permissions.
export function MeProvider({ children }: { children: ReactNode }) {
  const me = useQuery(AccessService.method.getMe);
  if (me.isPending) {
    return <Loading what="your account" />;
  }
  if (me.isError) {
    // Not a member, just removed, or no Tenant: let the user leave.
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        {isOrganisationNotSetUp(me.error) ? (
          <section role="alert" className="text-center">
            <h2 className="text-lg font-semibold">Not set up yet</h2>
            <p>This Organisation isn't set up in Ridr yet.</p>
          </section>
        ) : (
          <ErrorState error={me.error} />
        )}
        <SessionControls />
      </main>
    );
  }
  return <MeContextProvider value={me.data}>{children}</MeContextProvider>;
}
