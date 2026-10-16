import {
  ClerkProvider,
  OrganizationList,
  OrganizationSwitcher,
  SignIn,
  useAuth,
} from "@clerk/react";
import { useMemo, type ReactNode } from "react";
import { Loading } from "@/components/states";
import { SessionProvider, type Session } from "@/lib/session";

type ClerkSessionProps = {
  publishableKey: string;
  children: ReactNode;
};

// ClerkSession signs in with Clerk. Each Ridr Organisation is a Clerk
// organisation, and the active one picks the Tenant every call acts in.
// Only AppProvider imports it, lazily, so Clerk's code loads only when a
// publishable key is set.
export function ClerkSession({ publishableKey, children }: ClerkSessionProps) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ActiveOrganisation>{children}</ActiveOrganisation>
    </ClerkProvider>
  );
}

// ActiveOrganisation shows sign-in, then the Organisation picker, until
// the user is signed in with an active Organisation. Nothing below it
// renders, and so nothing calls Ridr, before then.
function ActiveOrganisation({ children }: { children: ReactNode }) {
  // Pending sessions still need an Organisation: show the picker for them.
  const auth = useAuth({ treatPendingAsSignedOut: false });
  const { userId, orgId, getToken, signOut } = auth;
  const session = useMemo<Session>(
    () => ({
      // A new user or Organisation rebuilds everything below the session.
      key: `${userId}/${orgId}`,
      getToken: () => getToken(),
      signOut: () => signOut(),
      organisationSwitcher: <OrganizationSwitcher hidePersonal />,
    }),
    [userId, orgId, getToken, signOut],
  );
  if (!auth.isLoaded) {
    return <Loading what="your session" />;
  }
  if (!auth.isSignedIn) {
    return (
      <Centered>
        <SignIn routing="hash" />
      </Centered>
    );
  }
  if (!orgId) {
    return <OrganisationPicker />;
  }
  return <SessionProvider value={session}>{children}</SessionProvider>;
}

// OrganisationPicker asks a signed-in user with no active Organisation to
// choose one, rather than letting every call fail.
function OrganisationPicker() {
  return (
    <Centered>
      <h1 className="text-lg font-semibold">Choose an Organisation</h1>
      <OrganizationList hidePersonal afterSelectOrganizationUrl="/" />
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      {children}
    </main>
  );
}
