# Assets and Unclaimed devices

Assets are the real things an Operations manager cares about ("Fridge
3"); Devices report for them through dated Assignments. A Device that
sent its first Reading but belongs to no Asset is an Unclaimed device,
waiting for someone to assign it. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/assets` | Assets by name, with their Attributes; create form |
| `/assets/:assetId` | one Asset: Attributes, Assignment history, each assigned Device's health and latest Reading, live Readings, its Alerts |
| `/devices/unclaimed` | Unclaimed devices, oldest first, with health; assign each to an Asset |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useAssets` | `RegistryService/ListAssets {}` | method key |
| `useAsset(assetId)` | `RegistryService/GetAsset {assetId}` | method key + request |
| `useDeviceHealth(deviceId)` | `RegistryService/GetDeviceHealth {deviceId}` | method key + request |
| `useLatestReading(deviceId)` | `QueryService/GetLatestReading {deviceId}` | method key + request |
| `useLiveQuery` | Live query `measurements \| where asset == "<name>" \| range last 1h` | `QueryService/RunQuery` with that text |
| `useAlerts({assetId})` | `AlertService/ListAlerts {assetId}` | method key + request |
| `useUnclaimedDevices` | `RegistryService/ListUnclaimedDevices {}` | method key |
| `useControlledKeys` (forms) | `RegistryService/ListControlledKeys {}` | method key |

- `GetAsset` returns the Asset and every Assignment it has had, oldest
  first; an open one has no `endsAt`. The Devices to show as current
  are the open Assignments.
- `GetLatestReading` is the newest Measurement of a Device by device
  time (Locations and Events are left out); it is `NotFound` for a
  Device with no Measurement.
- An Unclaimed device carries `adapterId`, `firstSeen`, `lastSeen` and
  `health`. Show the Adapter's name from `AdapterService/ListAdapters`
  when the user has it, and its latest Reading to help recognise it.
- Readings count for the Asset from the Assignment's `startsAt`;
  earlier ones stay under the Device ID. A `startsAt` in the past claims
  the Readings since then.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useCreateAsset` | `RegistryService/CreateAsset {name, attributes}` | method key `ListAssets` |
| `useUpdateAsset` | `RegistryService/UpdateAsset {assetId, name, attributes}` | method keys `ListAssets`, `GetAsset`; service keys `AlertService`, `QueryService` (names and Attributes show in both) |
| `useAssignDevice` | `RegistryService/AssignDevice {deviceId, assetId, startsAt?}` | service key `RegistryService`; service key `QueryService` |
| `useUnassignDevice` | `RegistryService/UnassignDevice {deviceId, endsAt?}` | service key `RegistryService`; service key `QueryService` |

- **Names** are unique in the Organisation: a taken one is
  `AlreadyExists`, shown beside the name field.
- **Attributes** replace the old set on update. Keys are letters,
  digits, `_` or `-`; values are not empty. A Controlled key accepts
  only its allowed values (`InvalidArgument`), so offer them as a
  picker. Mappings may also set Attributes from payloads.
- **Assigning** ends the Device's current Assignment at `startsAt`
  (unset means now) and claims it, so it leaves the Unclaimed list.
  Overlapping an existing Assignment of that Device is
  `FailedPrecondition`.
- **Unassigning** ends the current Assignment at `endsAt` (unset means
  now); `NotFound` when the Device has none. It is the only way to take
  a Device off an Asset: Assets can't be deleted.
- A quick "claim" on the Unclaimed devices page is "create Asset, then
  assign": two mutations, the second using the new Asset's `id`.

## Live updates

The Asset detail streams its Readings through one Live query. Device
health and latest Readings refetch every 60 s while the detail is open.
The Unclaimed list refetches every 60 s, since Devices appear on their
first Reading. Nothing else streams.

## Permissions

| Control | Needs |
|---|---|
| `/assets` and detail | `RegistryService/ListAssets`, `RegistryService/GetAsset` |
| Device health, latest Reading | `RegistryService/GetDeviceHealth`, `QueryService/GetLatestReading` |
| `/devices/unclaimed` | `RegistryService/ListUnclaimedDevices` |
| Create, edit | `RegistryService/CreateAsset`, `RegistryService/UpdateAsset` (editor and up) |
| Assign, unassign | `RegistryService/AssignDevice`, `RegistryService/UnassignDevice` (editor and up) |

A scoped user sees only Assets in their Scope; any other reads as not
found, and a Device outside it reads as never seen. They can't create
or change an Asset so it leaves their Scope (`PermissionDenied`), and
their Unclaimed list is always empty, since no Scope admits a Device
with no Asset: hide that route for them.

## States

| State | Shows |
|---|---|
| Loading | `Loading` per panel |
| Empty Assets | "No Assets yet." with "Create" for editors, and a link to Unclaimed devices |
| Empty Unclaimed | "Every Device is assigned." |
| Asset with no Devices | "No Devices report for this Asset." with "Assign" for editors |
| No Measurements | latest Reading `NotFound`: "No Measurements yet." |
| Not found | "This Asset doesn't exist, or isn't yours to see." |
| Error | `ErrorState`; form errors beside the field |
| Scoped user | the scope note; the Unclaimed route hidden |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Assets list with Attributes; the detail shows Assignment history,
  each current Device's health and latest Reading, live Readings and
  its Alerts.
- An editor can create and edit Assets with Controlled-key pickers, and
  assign or unassign Devices with a chosen time.
- Unclaimed devices list with health, and assigning one removes it from
  the list.
- A scoped editor can't save an Asset outside their Scope and sees the
  server's message.
