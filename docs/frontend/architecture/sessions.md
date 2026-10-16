# Sign-in and sessions

A **session** is one signed-in user acting in one Organisation. The
rest of the app sees only this, never Clerk or the dev token:

<!-- sample: web/starter/src/lib/session.tsx -->
```tsx
export type Session = {
  // Changes when the user or their active Organisation changes.
  key: string;
  // A fresh token for every call; never store it.
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  // A control to change Organisation, or null when there is one only.
  organisationSwitcher: ReactNode;
};
```

Two gates provide it. Locally, with no Clerk key, `DevSession` signs in
with the stack's dev token. With Clerk, `ClerkSession` walks the user
through sign-in and choosing an Organisation before anything else
renders:

<!-- sample: web/starter/src/app/clerk-session.tsx -->
```tsx
function ActiveOrganisation({ children }: { children: ReactNode }) {
  // Pending sessions still need an Organisation: show the picker for them.
  const auth = useAuth({ treatPendingAsSignedOut: false });
  const { userId, orgId, getToken, signOut } = auth;
  const session = useMemo<Session>(
    () => ({
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
      <main className="centered">
        <SignIn routing="hash" />
      </main>
    );
  }
  if (!orgId) {
    return <OrganisationPicker />;
  }
  return <SessionProvider value={session}>{children}</SessionProvider>;
}
```

`AppProvider` makes this Clerk-or-dev choice once; Clerk's code loads
only when it is chosen. Screens switch Organisation and sign out
through the session alone (`src/components/session-controls.tsx`).

The session `key` is `user/organisation`. Switching Organisation (with
the session's `organisationSwitcher`, Clerk's `OrganizationSwitcher`,
in the header) or signing out changes it,
and the [provider tree](providers.md) rebuilds everything below the
gate: open Live queries abort, the cache is dropped, and `GetMe`
reloads for the new Organisation.

## What Ridr checks on every call

Ridr reads the session token and works out who is calling:

- **Who:** the token's user (`sub`). An unknown or expired token is
  `Unauthenticated`.
- **Where:** the token's active Organisation, which names the Tenant.
  No active Organisation, or an Organisation the user isn't a member
  of, is `PermissionDenied`.
- **First sign-in:** a user who isn't a member yet but was invited to
  that Organisation becomes one, with the Role and Scope of the
  invitation. Ridr matches the invitation by the token's `email`
  claim, which the Clerk instance must add (see
  [Getting started](../getting-started.md#5-sign-in-with-clerk)).
- **Which origin:** with `CLERK_AUTHORIZED_PARTIES` set, a token minted
  for any other origin is `Unauthenticated`.
- **Role and Scope** come from Ridr's membership, never from the token,
  and `GetMe` reports them ([Permissions](permissions.md)).

## Contract

| State | Show | Calls allowed |
|---|---|---|
| Session loading | loading state | none |
| Signed out | sign-in | none |
| Signed in, no active Organisation | Organisation picker | none |
| Signed in with an Organisation, `GetMe` pending | loading state | `GetMe` only |
| `GetMe` refused: the Organisation has no Tenant (`PermissionDenied`, message `organisation is not set up in Ridr`) | "This Organisation isn't set up in Ridr yet.", with the Organisation switcher and sign-out | none |
| `GetMe` refused otherwise (`PermissionDenied`: not a member, or just removed) | `ErrorState`: "You don't have access to this.", with the Organisation switcher and sign-out | none |
| Ready | the app | any, gated by Permissions |

- **Fresh token for every call**: `getToken()` per request and per
  Live query open. Never cache, store or log a token, and never put one in
  a URL.
- **No active Organisation → the picker.** The app never calls Ridr
  without one.
- **Organisation switch** closes Live queries, clears the cache and
  reloads `GetMe`, by changing the session `key`.
- **Sign-out** does the same, then shows sign-in.
- **A refused `GetMe` is never a dead end.** A user who isn't a member
  of the active Organisation, or was just removed, can switch
  Organisation or sign out from the error.
- **When the server closes a Live query**, reload `GetMe`, then reopen
  the Live query, or show the screen's permission-denied state if the
  reopen is refused ([Live data](live-data.md)).
- **The dev token** is for local stacks only. Ridr accepts it only while
  it runs without `CLERK_SECRET_KEY`, and it is always admin of the dev
  Tenant. A production build fails unless it sets
  `VITE_CLERK_PUBLISHABLE_KEY`, or names `VITE_RIDR_DEV_TOKEN` on
  purpose, so a missing key never falls back to the dev token.

**Tests:** `src/app/provider.test.tsx` covers an Organisation switch and
sign-out (Live queries closed, cache dropped); `src/app/me-provider.test.tsx`
covers the way out of a refused `GetMe`.
