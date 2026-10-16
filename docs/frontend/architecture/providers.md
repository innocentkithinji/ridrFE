# Providers

The root of the app is a stack of providers, each handing the next what
it needs. The order matters: a session must exist before a transport
can fetch tokens, a transport before the cache can fetch, and `GetMe`
before any screen can decide what to show. The diagram is in the
[start page](../README.md#provider-tree).

## How the starter wires it

`AppProvider` picks the session: Clerk when a publishable key is set,
the dev token otherwise. Everything after that is the same for both.
Clerk's code is loaded only when it is picked:

<!-- sample: web/starter/src/app/provider.tsx -->
```tsx
// Clerk's code loads only when the app signs in with Clerk.
const ClerkSession = lazy(() =>
  import("@/app/clerk-session").then((m) => ({ default: m.ClerkSession })),
);
```

<!-- sample: web/starter/src/app/provider.tsx -->
```tsx
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
```

`RidrProvider` gives the session its transport, its own query cache and
its `GetMe`. The `key` on `SessionCache` is the whole Organisation-switch
story: a new key makes React unmount the old subtree and mount a fresh
one.

<!-- sample: web/starter/src/app/provider.tsx -->
```tsx
export function RidrProvider(props: RidrProviderProps) {
  const session = useSession();
  const transport = useMemo(
    () => props.transport ?? createRidrTransport(env.apiUrl, session.getToken),
    [props.transport, session.getToken],
  );
  // A new key (another Organisation or user) remounts everything below:
  // live queries close, the cache starts empty and GetMe reloads.
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
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

`MeProvider` holds back every screen until `GetMe` answers, so no screen
renders without knowing the user's Permissions. If `GetMe` is refused,
the user can still switch Organisation or sign out:

<!-- sample: web/starter/src/app/me-provider.tsx -->
```tsx
export function MeProvider({ children }: { children: ReactNode }) {
  const me = useQuery(AccessService.method.getMe);
  if (me.isPending) {
    return <Loading what="your account" />;
  }
  if (me.isError) {
    // Not a member, or just removed: let the user leave this Organisation.
    return (
      <main className="centered">
        <RefusedMe error={me.error} />
        <SessionControls />
      </main>
    );
  }
  return <MeContextProvider value={me.data}>{children}</MeContextProvider>;
}
```

The router sits inside all of this (`src/app/index.tsx`), so every
route can use `useMe()` and the cache.

## Contract

| Layer | File | Gives below | Must hold |
|---|---|---|---|
| Session gate | `src/app/clerk-session.tsx`, `src/app/dev-session.tsx` | a `Session` | renders children only when signed in with an active Organisation |
| `SessionProvider` | `src/lib/session.tsx` | `useSession()`: `key`, `getToken`, `signOut`, `organisationSwitcher` | `key` changes exactly when the user or the active Organisation changes |
| `TransportProvider` | `src/lib/transport.ts` | the Connect transport | asks `getToken` on every call; stores no token |
| `SessionCache` | `src/app/provider.tsx` | a `QueryClient` | keyed by `session.key`; a new key means a new, empty client |
| `MeProvider` | `src/app/me-provider.tsx` | `useMe()`, `useCan()` (from `src/lib/me.tsx`) | shows loading, or the refusal with switch and sign-out, until `GetMe` answers |
| Router | `src/app/router.tsx` | routes | inside `MeProvider` |

- Nothing above `SessionCache` holds Organisation data. Anything that
  does (a store, a context, a module variable) must live below it, or
  it leaks into the next Organisation.
- Tests replace the transport through `RidrProvider`'s `transport`
  prop (see `src/testing/ridr.tsx`); no other layer needs a seam.
- `src/app/provider.test.tsx` proves an Organisation switch shows
  nothing from the previous Organisation, and that sign-out closes
  Live queries and drops the cache.
