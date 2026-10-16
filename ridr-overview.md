# Ridr: an overview for frontend developers

Ridr is a telemetry platform for equipment: "Datadog for IoT". Operations
teams (health, logistics, fleet, manufacturing) send sensor data from any
source into Ridr. Ridr then lets them see it in one place, watch it live
and get alerted when something goes wrong.

Example: a vaccine fridge sends its temperature every minute. A
refrigerated truck sends its temperature and GPS position. Ridr stores
everything, shows it on dashboards and maps, and texts the night shift
if a fridge goes above 8 °C.

Your job is the web app the **Operations manager** uses.

## The words we use

Use these words in UI labels, code and conversation. The full glossary is
[`CONTEXT.md`](../CONTEXT.md).

| Word | Meaning | Example |
|---|---|---|
| Tenant / **Organisation** | A customer. All data belongs to one. Show it as "Organisation". | Kenyatta Hospital |
| **Device** | The thing that reports data, known by the ID its source gives it. | `logger-17`, `gps-unit-4` |
| **Asset** | The real-world thing the user cares about. Screens, queries and alerts are about Assets. | "Fridge 3", "Truck KDA 123" |
| **Assignment** | A dated link: "this Device reported for this Asset from date A to date B". | `logger-17` → Fridge 3 from 1 Sep |
| **Unclaimed device** | A Device that sent data but nobody has assigned yet. Its data is kept. | |
| **Attribute** | A `key=value` label on an Asset. | `site=nairobi`, `type=fridge` |
| **Reading** | One time-stamped piece of data. Three kinds: | |
| ↳ Measurement | a number with a unit | 4.2 °C |
| ↳ Location | a GPS position | -1.29, 36.82 |
| ↳ Event | something that happened | "door opened" |
| **Tag** | A `key=value` label on a single Reading. | `route=46` |
| **Adapter** | Whatever delivers the data (an MQTT feed, a webhook, a gateway). | |
| **Rule** | A condition that raises Alerts: threshold, no-data or geofence. | "Fridge 3 temperature > 8 °C" |
| **Alert** | One Rule broken for one Asset. States: firing → acknowledged → resolved. | |
| **Silence** | A window where Alerts are not notified (for example maintenance). | |
| **Contact group** | The people a Rule notifies. | "Nairobi night shift" |
| **Dashboard** | A saved layout of widgets, each backed by a query. | |
| **Role** | viewer, editor or admin (fixed). | |
| **Scope** | Which Assets a user may see, by Attribute. | only `site=nairobi` |

## How Devices and Assets fit together

This is the most important idea in Ridr.

- Data is stored against the **Device**.
- Users think in **Assets**.
- An **Assignment** connects them, with dates.

```
logger-17  ──(1 Sep → now)──►  Fridge 3
door-04    ──(15 Sep → now)──►  Fridge 3
gps-unit-4 ──(1 Oct → now)──►  Truck KDA 123
probe-22   ──(1 Oct → now)──►  Truck KDA 123
```

What this means for the UI:

- **An Asset can have many Devices** (a temperature probe, a door sensor,
  a power monitor). A Device belongs to only one Asset at a time.
- **Swapping a probe keeps the history.** Close the old Assignment and
  open a new one; the Asset's chart continues across both Devices.
- **Moving a Device doesn't rewrite the past.** Old Readings stay with the
  old Asset.
- **A Device with no Assignment shows up as its own Asset**, named by
  its Device ID. These are listed as Unclaimed devices so someone can
  assign them.

## How data flows

```
Device ──► Adapter ──► Ridr ingestion ──┬──► stored for good (TimescaleDB)
                                        ├──► Rules ──► Alerts ──► email / SMS / WhatsApp / webhook
                                        └──► Live queries ──► your app (real time)
```

Every Reading is **stored and streamed at the same time**. You never
choose between history and real time: a live view opens with the history
you asked for and then keeps adding new Readings.

## How the app talks to Ridr

There are two channels, both behind a signed-in user (Clerk).

1. **Connect RPC**: every normal call (`AlertService/ListAlerts`,
   `RegistryService/AssignDevice`, `QueryService/RunQuery`…). Use the
   generated client `@ridr/web` in [`sdk/web`](../sdk/web). Send a fresh
   Clerk token as `Authorization: Bearer` on every call.
2. **Server-Sent Events** at `GET /v1/live-query`: live data. It sends:
   - `result`: the answer to the query when it opens (for example the last 6 hours);
   - `reading`: each new Measurement;
   - `location`: each new Location;
   - `event`: each new Event;
   - `: ping` comments to keep the connection open.

   The browser's `EventSource` can't send a token, so use `fetch` and
   `eventsource-parser`. The starter's `useLiveQuery` hook does this.

Recommended stack (already set up in [`web/starter`](../web/starter)):
Vite + TypeScript, React Router, Clerk, TanStack Query via connect-query,
feature folders.

## Querying data

Users (and your screens) ask for data with a small query language:

```
measurements
| where asset == "Fridge 3" and metric == "temperature"
| range last 24h
| rollup avg, max every 15m
| unit Cel
```

```
locations
| where asset == "Truck KDA 123"
| range last 6h
```

- The source is `measurements`, `locations` or `events`; **one source per
  query**.
- Filter by `asset`, `device`, `metric`, `adapter`, `asset.<attribute>`
  (e.g. `asset.site == "nairobi"`) or `tag.<key>`.
- The same text works with `RunQuery` (one answer) and with the live
  stream (answer plus updates).
- Ridr stores each value in the unit it arrived in and converts when
  read, so each user can choose °C or °F.

Full reference: [`docs/frontend/reference/query-language.md`](frontend/reference/query-language.md).

## Example: a refrigerated truck screen

Goal: the truck's route on a map with a live temperature chart beside it.

1. Open two live queries for the Asset:
   - `locations | where asset == "Truck KDA 123" | range last 6h` → map;
   - `measurements | where asset == "Truck KDA 123" and metric == "temperature" | range last 6h` → chart.
2. Draw the `result` of each, then append each new `location` /
   `reading` event as it arrives.
3. To show "temperature at this point on the route", match each
   temperature to the nearest position by device time. Ridr does not
   join them for you.
4. Optional: colour the route red where the temperature was above the
   Rule's threshold.

There is no map widget yet. Pick a map library (MapLibre or Leaflet).

## Permissions

- Call `GetMe` once per session. It returns the user, their Organisation
  and the list of procedures they may call.
- Hide or disable anything the user may not do. Gate each route on the
  procedure it needs (for example Rules needs `RuleService/ListRules`).
- A user with a Scope only ever sees their Assets. The backend enforces
  this; your screens just show what comes back.
- When the user switches Organisation or signs out, throw away the cache
  and close live streams.

## Things that aren't there yet

Don't build screens for these. Full list:
[`docs/frontend/reference/limitations.md`](frontend/reference/limitations.md).

- No pagination cursors: most lists return everything; filter and page in
  the browser. Alerts return the newest N (at most 1000).
- Alerts don't stream live: poll every 15 s.
- No deleting Assets (unassign Devices instead). Roles are fixed.
- Queries filtering by Asset or Attribute are limited to 31 days.
- Locations can't be rolled up: keep map ranges short.
- No predictions or reports yet; no "coming soon" placeholders.

## Where to read next

| Read | When |
|---|---|
| [`docs/frontend/README.md`](frontend/README.md) | start here: pages, routes, provider tree |
| [`docs/frontend/getting-started.md`](frontend/getting-started.md) | running the backend, demo data and the starter locally |
| [`docs/frontend/architecture/live-data.md`](frontend/architecture/live-data.md) | anything that updates without a reload |
| [`docs/frontend/features/assets.md`](frontend/features/assets.md) | Assets, Assignments, Unclaimed devices |
| [`docs/frontend/features/home.md`](frontend/features/home.md) | the live map |
| [`docs/frontend/features/explore.md`](frontend/features/explore.md) | query box, chart / table / map |
| [`docs/frontend/features/rules.md`](frontend/features/rules.md), [`alerts.md`](frontend/features/alerts.md) | alerting |
| [`CONTEXT.md`](../CONTEXT.md) | the full glossary |
