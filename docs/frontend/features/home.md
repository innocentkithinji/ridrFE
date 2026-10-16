# Home

The first screen an Operations manager sees: where their Assets are,
which Alerts are open, and which Devices have gone quiet. Each of the
three panels gates and loads on its own, so a user missing one
Permission still gets the other two. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/` | live map, open Alerts, Device health |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useLiveQuery` (map) | Live query `locations \| range last 2m` | `QueryService/RunQuery` with that text |
| `useAlerts(openStates)` | `AlertService/ListAlerts {states: [FIRING, ACKNOWLEDGED]}` | method key + request |
| `useReportingDevices` | `QueryService/RunQuery` text `measurements \| range last 15m \| rollup count every all by device` | method key + request |
| `useUnclaimedDevices` | `RegistryService/ListUnclaimedDevices {}` | method key |
| `useAssets` | `RegistryService/ListAssets {}` | method key |
| `useAsset(assetId)` | `RegistryService/GetAsset {assetId}` | method key + request |
| `useDeviceHealth(deviceId)` | `RegistryService/GetDeviceHealth {deviceId}` | method key + request |
| `useMqttBridges` (data credit) | `ConnectorService/ListMqttBridges {}` | method key |

- **Map.** Plot each Device's newest Location; the opening `result` and
  every `location` event land in one cache entry, so keep the newest
  Reading per `deviceId`. Locations can't be rolled up and a query
  returning over 10,000 Readings is refused, so keep the range short:
  2 minutes of a busy fleet is plenty for "where is it now".
- **Device health.** No procedure lists every Device with its health,
  so the panel is assembled:
  1. **Live** Devices are the rows of `useReportingDevices` (one per
     Device with a Measurement in the last 15 minutes, the same line
     `GetDeviceHealth` draws between `LIVE` and `SILENT`).
  2. **Known** Devices are the open Assignments from `GetAsset` per
     Asset, plus `ListUnclaimedDevices` (which carries `health` and
     `lastSeen` itself).
  3. A known Device that isn't live is **silent**. The rollup counts
     Measurements only, so a Device sending only Locations or Events
     looks silent here; confirm with `GetDeviceHealth`, which counts
     every Reading and gives the exact `lastSeen` (call it on hover or
     in a detail). It answers `NEVER_SEEN` for a Device outside the
     user's Scope.

  `GetAsset` per Asset is one call each: for a large fleet, show the
  live count and Unclaimed devices first and load the rest on demand.
- **Data credit.** When a bridge that isn't retired connects to
  `mqtt.hsl.fi` or a `*.digitraffic.fi` host (`brokerUrl`), show the
  matching credit lines from
  [Getting started](../getting-started.md#6-credit-the-data); the
  licences require them wherever the data is shown.

## Mutations

None. Alert actions live on the [Alerts](alerts.md) page; offer a link
to each open Alert instead.

## Live updates

- **Map:** one Live query streaming `location` events
  ([Live data](../architecture/live-data.md)). Show the hook's status;
  on `reconnecting`, keep the pins and mark them stale.
- **Open Alerts:** polled every 15 s (`alertsPollMs`); nothing streams
  Alerts.
- **Device health:** refetch every 60 s; health changes on a 15-minute
  scale, so faster polling only adds load.

## Permissions

| Panel | Needs |
|---|---|
| Map | `QueryService/RunQuery` (the Live query itself needs none) |
| Open Alerts | `AlertService/ListAlerts` |
| Device health | `RegistryService/GetDeviceHealth`, `RegistryService/ListUnclaimedDevices`, `RegistryService/ListAssets`, `RegistryService/GetAsset` |
| Data credit | `ConnectorService/ListMqttBridges` |

Every role has all of them. A scoped user's map, Alerts and health hold
only Assets in their Scope; `ListUnclaimedDevices` is always empty for
them, because an Unclaimed device belongs to no Asset.

## States

| State | Map | Open Alerts | Device health |
|---|---|---|---|
| Loading | empty map with a spinner | `Loading` | `Loading` |
| Empty | "No positions in the last 15 minutes." Real feeds follow timetables, so a quiet night is normal | "No open Alerts." | "No Devices yet. Set up a data source." with a link to Data sources for admins |
| Error | `ErrorState` for a `failed` Live query; while Ridr can't be reached it reopens on its own | `ErrorState` | `ErrorState` |
| Scoped user | scope note: "You see Assets in your Scope only." | same note | same note |
| Permission denied | panel hidden | panel hidden | panel hidden |

## Done when

- The map moves vehicles in the demo stack without a reload, keeps the
  newest position per Device, and shows its live status.
- Open Alerts refresh every 15 s and each links to `/alerts/:alertId`.
- Device health shows live and silent Devices, and Unclaimed devices
  for whole-tenant users.
- The data credit shows whenever demo Adapters are present.
- A viewer, an editor, an admin and a scoped user each see the right
  panels, tested against the fake transport.
