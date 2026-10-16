# Project structure

The app follows Bulletproof React's feature folders: shared plumbing in
a few top-level folders, and each product area in its own feature
folder that owns its API hooks and components. `@/` is an alias for
`src/` (`vite.config.ts`, `tsconfig.json`), so imports read the same
from any depth.

```text
src/
  main.tsx                 mounts <App />
  app/
    index.tsx              App: the provider tree with the router inside
    provider.tsx           AppProvider, RidrProvider, SessionCache
    clerk-session.tsx      the session gates: Clerk, or the dev token
    dev-session.tsx
    me-provider.tsx        MeProvider: holds screens back until GetMe answers
    router.tsx             URL → route screen
    routes/                one thin file per route: reads params, renders a feature
  components/              shared: layout, session controls, states (QueryView)
  config/                  VITE_ settings, the production sign-in check
  features/
    alerts/
      api/                 one file per hook group: get-alerts.ts, change-alert.ts...
      components/          the feature's screens and parts, tests beside them
  lib/                     the Session type, transport, useMe and Permissions, live queries, errors
  testing/                 a fake Ridr transport and fake Live query answers
  utils/                   formatting
```

A route file only translates the URL into a feature component:

<!-- sample: web/starter/src/app/routes/alert.tsx -->
```tsx
export function AlertRoute() {
  const { alertId = "" } = useParams();
  return <AlertDetail alertId={alertId} />;
}
```

The router lists the routes inside the layout:

<!-- sample: web/starter/src/app/router.tsx -->
```tsx
          element: <Layout />,
          children: [
            { index: true, element: <Navigate to="/alerts" replace /> },
            { path: "alerts", element: <AlertsRoute /> },
            { path: "alerts/:alertId", element: <AlertRoute /> },
            { path: "*", element: <NotFoundRoute /> },
          ],
```

## Adding a feature

1. Make `src/features/<feature>/api/` with one hook per procedure call
   (`get-<things>.ts` for queries, `<verb>-<thing>.ts` for mutations),
   each a `useQuery` or `useMutation` over the generated method, with
   its invalidation ([Data flow](data-flow.md)).
2. Make `src/features/<feature>/components/` with the screens. Each
   screen gates itself with `useCan` ([Permissions](permissions.md))
   and shows the shared states from `@/components/states`.
3. Add a thin route file in `src/app/routes/` and its path in
   `src/app/router.tsx`; add the link in `src/components/layout.tsx`,
   shown only with the route's Permission.
4. Test the screens against the fake transport in `src/testing/ridr.tsx`
   (and `src/testing/sse.ts` for live views), for each Role that sees
   something different.

## Contract

- **Imports point one way:** `app` → `features` → `components` →
  `lib` → `config`, `utils`. A folder imports only folders to its
  right, so `lib` holds no UI and never imports `components`. A
  feature never imports another feature; what two features share
  moves to `lib` or `components`. `testing` may import anything.
- **Only `api/` files call Ridr.** Components use the hooks; they never
  touch the transport or build cache keys.
- **Only the session gates in `src/app` know about sign-in.** Features
  see a `Session` and `useMe()`, never Clerk or the dev token.
- **Generated types come from `@ridr/web`**; never hand-write a type the
  protos already define.
- **Names use the glossary:** a folder for Alerts is `alerts`, for
  Contact groups `contact-groups`, never a synonym the
  [glossary](../../../CONTEXT.md) lists under "Avoid".
- **Tests** sit beside the file they test (`*.test.tsx`) and run with
  `npm test` (Vitest, jsdom). `npm run build` typechecks and builds;
  a production build needs `VITE_CLERK_PUBLISHABLE_KEY`, or
  `VITE_RIDR_DEV_TOKEN` to build for a local stack on purpose.
  `make test-starter`, part of `make ci`, runs both against the current
  `@ridr/web`.
