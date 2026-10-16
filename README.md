# Ridr web app

The web app Operations managers use on top of [Ridr](../Ridr): a static
React single-page app that calls the Ridr API directly
([ADR 0001](docs/adr/0001-spa-talks-to-ridr-directly.md)).

Read first, all in the backend checkout beside this one:

- [`../Ridr/CONTEXT.md`](../Ridr/CONTEXT.md): the product glossary. UI
  labels, code and docs use its words. [`GLOSSARY.md`](GLOSSARY.md) holds
  the few terms that exist only in this app.
- [`../Ridr/docs/frontend/`](../Ridr/docs/frontend/README.md): the
  behaviour contract. Each feature page lists its routes, data, cache
  keys, invalidations, Permissions, states and "Done when".
- [`docs/adr/`](docs/adr): decisions taken here.
- [`docs/backend-requests.md`](docs/backend-requests.md): what the app
  still needs from Ridr.

## Running it

Check out [`innocentkithinji/ridr`](https://github.com/innocentkithinji/ridr)
as `../Ridr`, beside this repo. `@ridr/web` is installed from its
`sdk/web` ([ADR 0002](docs/adr/0002-sdk-from-sibling-checkout.md)), copied
rather than linked (`.npmrc`), so after rebuilding the SDK run
`npm install` again.

```sh
# in ../Ridr
make up && make demo
npm --prefix sdk/web ci && npm --prefix sdk/web run build

# here
npm install
npm run dev          # http://localhost:5173, signed in with the dev token
```

`.env.example` lists the settings (`VITE_RIDR_API_URL`,
`VITE_RIDR_DEV_TOKEN`); put overrides in `.env.local`.

| Command | Does |
|---|---|
| `npm run dev` | dev server (port from `PORT`, default 5173) |
| `npm run typecheck` | TypeScript 7 (`tsc`) |
| `npm run lint` | oxlint; warnings fail |
| `npm run build` | type-check, then a production build |
| `npm run test:e2e` | Playwright against the running local stack |

Run `npx playwright install chromium` once. Tests start their own dev
server on `PORT` (default 5173) or reuse one already there.

## Layout

Feature folders, as in the backend's
[project structure](../Ridr/docs/frontend/architecture/project-structure.md).
Imports point one way: `app` → `features` → `components` → `lib` →
`config`. A feature never imports another feature.

```text
src/
  main.tsx              mounts <App />
  app/
    index.tsx           App: theme, then the router
    router.tsx          URLs → route screens; the session wraps signed-in routes
    nav.ts              the sidebar: groups Monitor, Fleet, Alerting, Settings
    provider.tsx        AppProvider (session), RidrProvider (transport, cache, GetMe)
    dev-session.tsx     the Session from the dev token
    me-provider.tsx     holds screens back until GetMe answers
    routes/             one thin file per route: reads params, renders a feature
  components/
    layout/             AppShell (sidebar, user menu, theme toggle), NavItem types
    states.tsx          Loading, Empty, PermissionDenied, NotFound, ErrorState, QueryView
    require-permission.tsx  <RequirePermission>: a route's Permission gate
    session-controls.tsx    Organisation switcher and sign-out
    ui/                 shadcn/ui components (add with `npx shadcn add <name>`)
  features/<feature>/
    api/                one hook per procedure: get-<things>.ts, <verb>-<thing>.ts
    components/         the feature's screens and parts
  lib/                  Session, transport, query cache, useMe/useCan/permissionOf, errors, theme
  config/env.ts         VITE_ settings
e2e/                    Playwright tests, one file per feature
```

## Adding a feature

1. **Hooks** in `src/features/<feature>/api/`: one `useQuery` or
   `useMutation` per procedure over the generated `@ridr/web` method, with
   the cache keys and invalidations its feature page names. Only `api/`
   files call Ridr.
   A live view (Readings that keep arriving) uses
   `useLiveQuery(text)` from `@/lib/use-live-query` instead: it fills the
   same cache entry `RunQuery` would and reports a `status`; pass its
   `query` to `QueryView`. Draw Measurements over time with
   `<TimeSeriesChart series={measurementSeries(data.readings)} label="…" />`
   from `@/components/charts`. The dev server's `/dev/live-query` charts
   any Query live.
2. **Screens** in `src/features/<feature>/components/`. Show
   `Loading`, `ErrorState`, `Empty` or `QueryView` from
   `@/components/states`; hide actions the user may not take with
   `useCan(Service.method.x)` or `<Can method={...}>`, never disable them.
3. **Route**: a thin file in `src/app/routes/<feature>.tsx`, added to
   `shellRoutes` in `src/app/router.tsx` and wrapped in
   `<RequirePermission permission={permissionOf(Service.method.listX)} what="Things">`,
   using the Permission the backend's route map names.
4. **Nav link**: add a `NavItem` to its group in `src/app/nav.ts` with
   the **same** Permission. The shell shows it only when `GetMe` lists it.
5. **Tests**: `e2e/<feature>.spec.ts`. Drive the app as a user would and
   assert on what is visible; the feature page's "Done when" list is the
   test list. Give anything you create a unique name (suffix a
   timestamp) so tests re-run cleanly against the demo data.
