# Getting started

From a clean machine to the starter app showing live data, then to real
sign-in with Clerk. Each step ends on something you can see; stop and
fix it there before going on.

You need Docker (with Compose v2) and Node.js at the version in
[`.nvmrc`](../../.nvmrc), which CI uses too (`nvm use` picks it). Go is
not needed: the backend runs in containers.

## 1. Start the backend

```sh
make up
```

This builds and starts TimescaleDB, NATS and Ridr under the compose
project `ridr-v1`. The API listens on `http://localhost:18095`; devices
publish over MQTT to `mqtt://localhost:11883`. The stack sends CORS
headers for any origin, so a dev server on any port may call it.

**Done when** the dev token gets an answer from `GetMe`:

```sh
curl -s -X POST http://localhost:18095/ridr.v1.AccessService/GetMe \
  -H "Authorization: Bearer dev-user-token" \
  -H "Content-Type: application/json" -d '{}'
```

It returns `"email":"dev@localhost"`, `"tenantName":"Dev tenant"`,
`"role":"ROLE_ADMIN"` and the full list of `permissions`. Without the
header the answer is `{"code":"unauthenticated","message":"unknown caller"}`.

The **dev token** (`dev-user-token`) signs in as `dev-user`, admin of the
dev Tenant ("Dev tenant", Organisation `org_dev`). It works only while
the backend runs without Clerk (step 5).

## 2. Load the demo data

```sh
make demo
```

This runs the demo setup, then starts the simulator. Setup goes
through the public API with the dev token and is safe to run again; it
creates, in the dev Tenant:

- MQTT bridges to real public feeds: HSL trams and buses in Helsinki,
  and Fintraffic's trains, ships and road weather stations. Each bridge
  is its own Adapter, named `HSL …` or `Fintraffic …`.
- Two Connectors the simulator feeds: "Demo health devices" (Hosted
  MQTT: medicine fridges and infusion pumps) and "Demo factory
  machines" (a Webhook connector: milling machines).
- Metrics, Controlled keys (`fleet`, `mode`), the Contact group "Demo
  operations", and Rules that notify it, such as "Demo medicine fridge
  above 8 °C".
- Assets for every vehicle, ship and station seen, such as "Ship
  Megastar", and for each simulated device, such as "Demo medicine
  fridge 2".

The simulator makes every simulated Rule fire, and resolve, once in
each 10-minute cycle. The fridge Alert fires about 2 minutes after
setup: the simulator first waits for its Devices to appear, then the
Rule waits for a minute above 8 °C.
The real feeds follow real timetables: at night few HSL vehicles and
trains run, while ships and road weather keep reporting.
[`cmd/ridr-demo/README.md`](../../cmd/ridr-demo/README.md) lists every
feed and Rule.

**Done when** setup prints `Demo ready.` and a Live query streams
Readings for a few seconds:

```sh
curl -N -H "Authorization: Bearer dev-user-token" \
  "http://localhost:18095/v1/live-query?text=measurements"
```

You see one `event: result`, then `event: reading` lines as Readings
arrive. Stop it with Ctrl-C.

The stack accepts up to 450 Readings per second for the Tenant
(`RIDR_TENANT_READINGS_PER_SECOND` in `compose.yaml`) and 250 per
Adapter. One Ridr process sustains about 500 Readings per second end to
end, held back by Rule evaluation, so the demo runs near the ceiling of
a single process. [`docs/rate-limits.md`](../rate-limits.md) explains
the settings.

## 3. Run the starter app

The starter depends on `@ridr/web` from this repo, which ships built
files only, so build it first:

```sh
npm --prefix sdk/web ci
npm --prefix sdk/web run build
cd web/starter
npm ci
npm run dev
```

Open `http://localhost:5173`. The app signs in with the dev token, so
there is no sign-in screen; the header shows "Dev tenant" and
`dev@localhost`.

**Done when**:

1. `/alerts` lists the open Alerts, or "No Alerts. Rules raise them when
   readings break." Choose **All** to see resolved ones too.
2. Opening an Alert shows its state, value, times, Deliveries, and
   **Live Readings** marked "Live", with a new simulated Reading every
   5 seconds and no reload.

To point the starter elsewhere, copy `.env.example` to `.env.local` and
set `VITE_RIDR_API_URL`, `VITE_RIDR_DEV_TOKEN` or
`VITE_CLERK_PUBLISHABLE_KEY`.

## 4. Make your first call

Every procedure is a hook over the generated `@ridr/web` client. This
is the starter's Alerts list, the whole of it:

<!-- sample: web/starter/src/features/alerts/api/get-alerts.ts -->
```ts
// useAlerts lists Alerts in states (every state when empty), newest
// first. The server returns only Alerts of Assets in the user's Scope.
export function useAlerts(states: AlertState[]) {
  return useQuery(
    AlertService.method.listAlerts,
    { states },
    { refetchInterval: alertsPollMs },
  );
}
```

The token, the API address and the cache come from the providers above
it; [Providers](architecture/providers.md) and
[Data flow](architecture/data-flow.md) explain them.

## 5. Sign in with Clerk

The dev token is enough to build every screen. Switch to Clerk when you
build the real sign-in flow. Ridr accepts **either** the dev token
**or** Clerk tokens: setting `CLERK_SECRET_KEY` turns the dev token
off. The demo setup and the simulator sign in with the dev token, so run
`make demo` before switching (step 2), and switch back to run it again.

In the Clerk dashboard of a development instance:

1. **Turn on Organizations.** Each Ridr Organisation is a Clerk
   organisation; the active one picks the Tenant every call acts in.
   Create one and copy its ID (`org_…`).
2. **Add the `email` claim** (Sessions, Customize session token):

   ```json
   {"email": "{{user.primary_email_address}}"}
   ```

   Ridr matches a user's first sign-in to their invitation by this
   email. Without it, that sign-in is refused.
3. Copy the **secret key** (`sk_test_…`) and the **publishable key**
   (`pk_test_…`).

Link the dev Tenant to your Clerk organisation and name its first
admin. `compose.yaml` fixes these two values, so put them in a
`compose.override.yaml` beside it, which Compose reads on its own (keep
it out of commits):

```yaml
services:
  ridr:
    environment:
      RIDR_DEV_ORGANISATION_ID: org_your_organisation_id
      RIDR_DEV_ADMIN_EMAIL: you@example.com
```

Start the backend with the secret key and the starter's origin as the
only **authorized party** (Ridr then refuses session tokens minted for
any other origin; empty accepts all):

```sh
CLERK_SECRET_KEY=sk_test_… \
CLERK_AUTHORIZED_PARTIES=http://localhost:5173 \
make up
```

Give the starter the publishable key in `web/starter/.env.local`:

```sh
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
```

and restart `npm run dev`. On restart Ridr re-links the dev Tenant to
your organisation and invites the admin email, so the demo data stays.

**Done when** the starter shows Clerk's sign-in; signing in as the admin
email shows "Choose an Organisation" until you pick yours, then the
Alerts list with Clerk's Organisation switcher in the header.

Ridr's rules for Clerk sessions:

- **An active Organisation is required.** A token without one is
  refused with `PermissionDenied`; the app shows the Organisation picker
  instead of calling.
- **The `email` claim is required** for a first sign-in to accept an
  invitation.
- **Authorized parties** (`CLERK_AUTHORIZED_PARTIES`, comma-separated
  origins) should list every origin the app is served from.
- `CLERK_INVITATION_REDIRECT_URL` (optional) is where invitation emails
  land.

[Sign-in and sessions](architecture/sessions.md) covers the app side.

## 6. Credit the data

The demo's real data is open data under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Whenever the
demo Adapters are present (MQTT bridges to `mqtt.hsl.fi` or
`*.digitraffic.fi`), the app shows a data-sources credit with these
lines:

> HSL vehicle positions © Digitransit 2026, CC BY 4.0, received live.

> Source: Fintraffic / digitraffic.fi, CC BY 4.0.

Simulated Adapters and Assets are named "Demo …"; their data is made up
and needs no credit.

## Stopping and starting again

```sh
docker compose --profile demo stop sim   # stop the simulator only
docker compose --profile demo down       # stop everything, keep the data
```

Pass `--profile demo` so the simulator, which belongs to that profile,
stops with the rest. `make up` brings the data back. To start from
empty, remove the volumes too: `docker compose --profile demo down -v`.

## When ports are taken

The stack uses host ports 15432, 14222, 11883 and 18095 and the compose
project name `ridr-v1`. To run a second copy beside another, use your
own project name and an override file that replaces the ports:

```yaml
# ports.yaml
services:
  timescaledb:
    ports: !override
      - "25432:5432"
  nats:
    ports: !override
      - "24222:4222"
      - "21883:1883"
  ridr:
    environment:
      RIDR_MQTT_PUBLIC_URL: mqtt://localhost:21883
    ports: !override
      - "28095:8080"
```

```sh
docker compose -p my-ridr -f compose.yaml -f ports.yaml up --build -d
docker compose -p my-ridr -f compose.yaml -f ports.yaml run --rm demo
docker compose -p my-ridr -f compose.yaml -f ports.yaml \
  --profile demo up -d --no-deps sim
```

and start the starter with `VITE_RIDR_API_URL=http://localhost:28095`
and, if 5173 is taken, `npm run dev -- --port 5246`.

A private MQTT broker used in development (on your laptop or LAN) must
be allowed through Ridr's outbound guard with `RIDR_OUTBOUND_ALLOWED`
(comma-separated IPs or CIDRs); see [`docs/security.md`](../security.md).

## Manual check

Run on 2026-10-14 at 23:44 UTC (02:44 in Helsinki) from an empty stack,
under the project name `ridr-docs46` with the ports above:

1. `up --build -d` started the three containers healthy; `GetMe` with
   the dev token returned `dev@localhost`, "Dev tenant", `ROLE_ADMIN`;
   without it, `unauthenticated`.
2. The demo setup created 22 MQTT bridges, both simulator Connectors,
   the Contact group and 5 Rules, named "Ship Megastar", and printed
   `Demo ready.` with both credits. The simulator started.
3. In 15 seconds a Live query on `measurements` sent 1 `result` and 33
   `reading` events; one on `locations` sent 2 `location` events (ship
   speeds in `[kn_i]`; at that hour no demo train ran).
4. The starter at the dev server showed "Dev tenant". "Demo medicine
   fridge above 8 °C" fired for "Demo medicine fridge 2" about 90
   seconds after setup and resolved 20 seconds later, so **Open** was
   empty and **All** listed it as Resolved. Its detail showed a
   Delivered delivery to the Contact group and Live Readings
   (`temperature` 4.6–4.8 Cel and `door_state` 0) arriving every 5
   seconds without a reload.
5. `--profile demo down -v` removed the containers and volumes.

Clerk (step 5) was not part of this check: it needs a Clerk account.
