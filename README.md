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
rather than linked (`.npmrc`). After rebuilding the SDK, `npm install`
alone keeps the old copy, and Vite keeps its prebundled one (errors such
as "does not provide an export named 'PreferenceService'"), so refresh
both:

```sh
npm --prefix ../Ridr/sdk/web run build
rm -rf node_modules/@ridr/web node_modules/.vite && npm install
```

then restart `npm run dev`.

```sh
# in ../Ridr
make up && make demo
npm --prefix sdk/web ci && npm --prefix sdk/web run build

# here
npm install
npm run dev          # http://localhost:5173, signed in with the dev token
```

`.env.example` lists the settings (`VITE_RIDR_API_URL`,
`VITE_RIDR_DEV_TOKEN`, `VITE_CLERK_PUBLISHABLE_KEY`); put overrides in
`.env.local`. Without a Clerk key the app signs in with the dev token
and never loads Clerk's code.

A production build (`npm run build`) refuses to run unless it sets
`VITE_CLERK_PUBLISHABLE_KEY`, or names `VITE_RIDR_DEV_TOKEN` on purpose
to build for a local stack, so a missing key never falls back to the
dev token.

| Command | Does |
|---|---|
| `npm run dev` | dev server (port from `PORT`, default 5173) |
| `npm run typecheck` | TypeScript 7 (`tsc`) |
| `npm run lint` | oxlint; warnings fail |
| `npm run build` | type-check, then a production build (needs the Clerk key or a named dev token) |
| `npm run test:e2e` | Playwright against the running local stack |
| `npm run test:e2e:worker` | builds for the local stack, then checks deep links on the build served by `wrangler dev`, as Cloudflare serves it |

Run `npx playwright install chromium` once. Tests start their own dev
server on `PORT` (default 5173) or reuse one already there. They cover
the dev-token Session only; Clerk sign-in is checked by hand (below).
Global setup has the dev admin make the stack's extra dev users
members (a viewer, an editor, and an editor scoped to `fleet=hsl`;
see `e2e/users.ts`); a test signs in as one with
`test.use({ user: "viewer" })` or `signInAs(page, "viewer")`, which
swaps the token on the page's calls to Ridr, so the app itself has no
way to pick a user. `e2e/roles.spec.ts` checks what each sees.

## Checking Clerk sign-in by hand

Playwright can't sign in to Clerk, so check this before releasing a
change to sign-in or the session. You need a Clerk development instance
set up as in the backend's
[Getting started, step 5](../Ridr/docs/frontend/getting-started.md#5-sign-in-with-clerk):
Organizations on, the `email` claim added, the dev Tenant linked to
your Clerk organisation, and Ridr restarted with `CLERK_SECRET_KEY` and
`CLERK_AUTHORIZED_PARTIES=http://localhost:5173`. Run `make demo`
first: the demo signs in with the dev token, which Clerk turns off.

1. Put `VITE_CLERK_PUBLISHABLE_KEY=pk_test_…` in `.env.local` and run
   `npm run dev`.
2. Open http://localhost:5173 in a private window. **Clerk's sign-in
   shows**, and nothing else: no sidebar, and the network tab shows no
   call to Ridr.
3. Sign in as a user with no active Organisation (or with more than
   one, none chosen). **"Choose an Organisation" shows**, still with no
   call to Ridr.
4. Pick the Organisation linked to the dev Tenant. The shell shows,
   with your email and "Dev tenant" in the user menu and Clerk's
   Organisation switcher beside it. In the network tab, `GetMe` carries
   `Authorization: Bearer …`.
5. Open a page that loads data, then switch to another Organisation
   with the switcher. **The screen empties and `GetMe` is called
   again**; nothing from the first Organisation shows, and any open
   Live query's request is cancelled.
6. If that Organisation isn't linked to a Tenant, **"This Organisation
   isn't set up in Ridr yet." shows** with the switcher and "Sign out";
   switching back to the dev Tenant's Organisation restores the app.
7. Sign out from the user menu. **Clerk's sign-in shows again**, and
   signing back in calls `GetMe` afresh.
8. Remove the key from `.env.local` and restart `npm run dev`: the app
   signs in with the dev token, and the network tab shows no request
   for Clerk's code.

## CI and deploying

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull
request and push to `main`: it checks out this repo and
`innocentkithinji/ridr` side by side
([ADR 0002](docs/adr/0002-sdk-from-sibling-checkout.md)), builds
`@ridr/web`, type-checks, lints and builds the app, starts the stack
with `make up && make demo`, and runs Playwright twice: against the dev
server, and against the production build served by `wrangler dev`. On
`main` it then builds with the settings below and runs
`wrangler deploy`.

The app deploys as a Worker with static assets and no Worker script
([`wrangler.jsonc`](wrangler.jsonc)). Any URL that is not a file gets
`index.html` (`not_found_handling = "single-page-application"`), so
deep links such as `/assets/<id>` load. `npx wrangler deploy --dry-run`
after a build checks the packaging without credentials.

Set these under the GitHub repo's **Settings → Secrets and variables →
Actions**:

| Name | Kind | Used by | What |
|---|---|---|---|
| `RIDR_REPO_TOKEN` | secret | both jobs | Fine-grained token with read-only **Contents** on `innocentkithinji/ridr`, which is private |
| `CLOUDFLARE_API_TOKEN` | secret | deploy | Cloudflare API token from the **Edit Cloudflare Workers** template, scoped to one account |
| `CLOUDFLARE_ACCOUNT_ID` | secret | deploy | The Cloudflare account the Worker `ridr-web` deploys to |
| `VITE_CLERK_PUBLISHABLE_KEY` | secret | deploy | Clerk publishable key (`pk_live_…`) the deployed app signs in with |
| `VITE_RIDR_API_URL` | variable | deploy | The Ridr API's public URL; its CORS origins must include the deployed site |

The deploy job fails before building if either `VITE_` setting is
missing. The checks job needs none of them but `RIDR_REPO_TOKEN`: it
builds for the stack it starts, with the dev token.

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
    provider.tsx        AppProvider (Clerk, loaded lazily, or the dev token), RidrProvider (transport, cache, GetMe)
    clerk-session.tsx   the Session from Clerk: sign-in, Organisation picker, switcher
    dev-session.tsx     the Session from the dev token
    me-provider.tsx     holds screens back until GetMe answers
    routes/             one thin file per route: reads params, renders a feature
  components/
    charts/             TimeSeriesChart and the series it draws; the palette
    map/                TrackMap: MapLibre and OpenFreeMap, loaded lazily; Tracks of Locations, an area
    query-editor/       QueryEditor: CodeMirror 6, query-language highlighting, QueryProblem markers
    layout/             AppShell (sidebar, user menu, theme toggle), NavItem types
    states.tsx          Loading, Empty, PermissionDenied, NotFound, ErrorState, QueryView
    live-status.tsx     <LiveStatusBadge>: a Live query's status, as every live view shows it
    device-health.tsx   <HealthBadge>: a Device's health (live, silent, never seen)
    answer-table.tsx    AnswerTable: any Query's answer as a table (Explore, Dashboard Widgets)
    require-permission.tsx  <RequirePermission>: a route's Permission gate
    secret-dialog.tsx   <SecretDialog>: a secret Ridr shows once (Ingest key, webhook URL…), copied, never cached
    confirm-dialog.tsx  <ConfirmDialog>: asks before a change that can't be taken back
    agent-guide/        <AgentGuide>: the public guide, and the filled-in one after an Ingest key is issued
    session-controls.tsx    Organisation switcher and sign-out
    ui/                 shadcn/ui components (add with `npx shadcn add <name>`)
  features/<feature>/
    api/                one hook per procedure: get-<things>.ts, <verb>-<thing>.ts
    components/         the feature's screens and parts
  lib/                  Session, transport, query cache, useMe/useCan/permissionOf, errors, theme
  lib/api/              hooks more than one feature uses, one file per Ridr service (registry.ts, catalog.ts…)
  config/env.ts         VITE_ settings
  config/sign-in.ts     why a production build may not go out (read by vite.config.ts)
e2e/                    Playwright tests, one file per feature
wrangler.jsonc          Cloudflare: the build in dist/ as static assets, SPA fallback
.github/workflows/      CI and deploy
```

## Adding a feature

1. **Hooks** in `src/features/<feature>/api/`: one `useQuery` or
   `useMutation` per procedure over the generated `@ridr/web` method, with
   the cache keys and invalidations its feature page names. Only `api/`
   files call Ridr. A hook a second feature needs moves to
   `src/lib/api/<service>.ts` (one file per Ridr service), never imported
   across features: `npm run lint` fails on a feature importing another.
   A live view (Readings that keep arriving) uses
   `useLiveQuery(text)` from `@/lib/use-live-query` instead: it fills the
   same cache entry `RunQuery` would and reports a `status`; pass its
   `query` to `QueryView`. Draw Measurements over time with
   `<TimeSeriesChart series={measurementSeries(data.readings)} label="…" />`
   from `@/components/charts`. Draw Locations with
   `<TrackMap tracks={locationTracks(data.readings)} label="…" />` from
   `@/components/map/track-map`: it appends new positions without
   redrawing, `show="latest"` draws only where each Device is now, and
   `area` draws a polygon. The dev server's `/dev/live-query` charts
   any Query live.
   Where users write Query text (Explore, Dashboard Widgets), use
   `<QueryEditor>` from `@/components/query-editor/query-editor`: it
   highlights the query language and underlines the `QueryProblem`
   that `queryProblemOf(error)` from `@/lib/errors` reads.
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
