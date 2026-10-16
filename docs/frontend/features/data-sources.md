# Settings: Data sources

Everything that gets data into Ridr. Every source is an **Adapter**;
**Connectors** are Adapters Ridr hosts (Webhook connectors, Hosted
MQTT connectors and MQTT bridges), which receive payloads, keep them
as Raw payloads and turn them into Readings through a **Mapping**.
Agents publish their own Manifests with an Ingest key. Words in
capitals are from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/data-sources` | every Adapter, oldest first, retired ones marked; MQTT bridges with their connection status; Raw payload retention |
| `/settings/data-sources/new` | choose: Adapter (for an Agent), Webhook connector, Hosted MQTT connector or MQTT bridge |
| `/settings/data-sources/:adapterId` | one Adapter: Ingest keys, Manifests, its bridge settings, Mapping editor with preview, Raw payloads, Reprocessing, Corrections |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useAdapters` | `AdapterService/ListAdapters {}` | method key |
| `useIngestKeys(adapterId)` | `AdapterService/ListIngestKeys {adapterId}` | method key + request |
| `useManifests(adapterId)` | `AdapterService/ListManifests {adapterId}` | method key + request |
| `useMqttBridges` | `ConnectorService/ListMqttBridges {}` | method key |
| `useMqttBridge(adapterId)` | `ConnectorService/GetMqttBridge {adapterId}` | method key + request |
| `useMapping(adapterId)` | `ConnectorService/GetMapping {adapterId}` | method key + request |
| `useRawPayloads(adapterId, onlyProblems)` | `ConnectorService/ListRawPayloads {adapterId, onlyProblems, limit}` | method key + request |
| `useRawPayloadRetention` | `ConnectorService/GetRawPayloadRetention {}` | method key |
| `useMetrics`, `useUnits` (Mapping, Corrections) | `CatalogService/ListMetrics {}`, `CatalogService/ListUnits {}` | method keys |

- **Which kind is an Adapter?** `Adapter` has no kind field. An
  Adapter is an MQTT bridge when `ListMqttBridges` holds its `id`
  (`bridge.adapter.id`). Webhook connectors, Hosted MQTT connectors
  and Agents' Adapters look the same: show the Mapping and Raw
  payloads sections on every Adapter that isn't retired, and treat
  `GetMapping`'s `NotFound` as "no Mapping yet".
- **Manifests** are versions, oldest first; each lists Metrics and
  their Units. Readings record the version they arrived under.
- **Raw payloads** come newest first; `limit` 0 means 100, at most
  1000. `body` is bytes: decode with `TextDecoder` and pretty-print the
  JSON. `topic` is set for MQTT payloads, `problem` says why a payload
  was not read or its Readings not accepted, and `mappingVersion` which
  Mapping read it.
- **Bridge status:** `CONNECTING`, `CONNECTED` or `DISCONNECTED` with
  `lastError` and `changedAt`. A bridge keeps retrying on its own.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useRegisterAdapter` | `AdapterService/RegisterAdapter {name, deviceIds}` | method key `ListAdapters` |
| `useRetireAdapter` | `AdapterService/RetireAdapter {adapterId}` | service keys `AdapterService`, `ConnectorService` |
| `useCreateIngestKey` | `AdapterService/CreateIngestKey {adapterId, deviceIds}` | method key `ListIngestKeys` |
| `useRevokeIngestKey` | `AdapterService/RevokeIngestKey {ingestKeyId}` | method key `ListIngestKeys` |
| `useCreateWebhookConnector` | `ConnectorService/CreateWebhookConnector {name}` | method key `ListAdapters` |
| `useCreateHostedMqttConnector` | `ConnectorService/CreateHostedMqttConnector {name}` | method key `ListAdapters` |
| `useCreateMqttBridge` | `ConnectorService/CreateMqttBridge {name, brokerUrl, username, password, topicFilter}` | method keys `ListAdapters`, `ListMqttBridges` |
| `useUpdateMqttBridge` | `ConnectorService/UpdateMqttBridge {adapterId, brokerUrl, username, password?, topicFilter}` | method keys `ListMqttBridges`, `GetMqttBridge` |
| `useDeleteMqttBridge` | `ConnectorService/DeleteMqttBridge {adapterId}` | service keys `AdapterService`, `ConnectorService` |
| `usePreviewMapping` | `ConnectorService/PreviewMapping {mapping, samplePayload, sampleTopic}` | nothing (a read, run as a mutation on demand) |
| `useSetMapping` | `ConnectorService/SetMapping {adapterId, mapping}` | method key `GetMapping` |
| `useSetRawPayloadRetention` | `ConnectorService/SetRawPayloadRetention {days}` | method key `GetRawPayloadRetention` |
| `useReprocessRawPayloads` | `ConnectorService/ReprocessRawPayloads {adapterId, from, to}` | method key `ListRawPayloads`; service key `QueryService` |
| `useCorrectMeasurements` | `AdapterService/CorrectMeasurements {metric, from, to, unit, adapterId, deviceIds, toMetric, toUnit?}` | service key `QueryService` |

**Secrets shown once.** Each of these returns a secret that Ridr keeps
only as a hash; show it in a copy-once dialog, keep it in component
state only, and never cache it:

| Response | Secret |
|---|---|
| `RegisterAdapter`, `CreateIngestKey` | `ingestKey.plaintext`, sent as `Authorization: Bearer <plaintext>` |
| `CreateWebhookConnector` | `url`, which ends `/v1/webhooks/<key>`; for a new key, replace the key at its end (keep the URL's start, without the key, to build it) |
| `CreateHostedMqttConnector` | `brokerUrl`, `username` (the Adapter ID), `topic` (`adapters/<id>`, or below it) and the password `ingestKey.plaintext` |

**Adapters and keys.**
- Retiring revokes every key; its Readings stay queryable. It can't be
  undone.
- Several keys may be valid at once, so rotate by creating a new key,
  then revoking the old. A key narrowed to `deviceIds` can't connect
  over Hosted MQTT.
- `CreateHostedMqttConnector` is `FailedPrecondition` when this Ridr
  runs no Hosted MQTT: show the message.

**MQTT bridges.**
- `brokerUrl` schemes: `mqtt`/`tcp`, `mqtts`/`ssl`/`tls`, `ws`, `wss`.
  Only `ws`/`wss` have a path (such as `/mqtt`); none has a query or
  credentials. Encrypted brokers need a public CA certificate, and
  private addresses are refused unless the operator allows them. Each
  refusal is `InvalidArgument` with a message for the field.
- One MQTT 3.1.1 topic filter per bridge. The password is never shown
  again: `hasPassword` says whether one is set. On update, leave
  `password` unset to keep it and send `""` to remove it.
- Delete stops the subscription, forgets the settings and retires the
  bridge's Adapter; Readings stay.

**Mappings.** Each field is a path of keys and array positions joined
by dots (`uplink_message.decoded_payload.temp`, `rx_metadata.0.rssi`).
- Device ID: `deviceIdField`, or `deviceIdFields` joined with `/`
  (`VP.oper` + `VP.veh` = `40/423`), never both. `deviceTimeField`
  (RFC 3339 or Unix seconds) is required.
- `metrics` (field, Metric, Unit), `location`, `events`, `tags` and
  `attributes` (set on the Device's Asset).
- A metric's optional `unknownValues` are values the device sends for
  "no measurement" (AIS heading `511`); a field holding one makes no
  Reading, as if absent.
- **Topic levels:** any field may be `$topic.N`, level N of the MQTT
  topic from 0, split at `/` (`$topic.1` of
  `vessels-v2/230123000/location` is `230123000`). Show the levels of
  a recent Raw payload's `topic` as pickable chips.
- **Preview before saving:** run `PreviewMapping` with a sample, by
  default the newest Raw payload's body and topic. Show the
  `readings` it would make, the `attributes` it would set, and its
  `problem` if it can't read the sample. It saves nothing.
- Saving makes a new version. A Unit that doesn't fit its Metric's
  Quantity kind is `InvalidArgument`. Saving doesn't touch past
  Readings: offer Reprocessing next.

**Raw payloads and Reprocessing.**
- Retention is days, 1 to 3650, for the whole Organisation.
- Reprocessing rebuilds Readings from the payloads received in
  `[from, to)` with the current Mapping, replacing the old ones. It
  never raises Alerts. It runs within the request, so a long window
  takes long: disable the button and show progress until it answers
  with `reprocessed`, `readings` and `problems`. Only payloads still
  within retention can be reprocessed.

**Corrections** relabel the Metric or Unit of Measurements over a
device-time window, for when a Manifest or Mapping named them wrongly.
`metric`, `from`, `to` are required; narrow by `unit`, `adapterId`,
`deviceIds`. Leave `toUnit` unset to keep Units, or `""` to make them
unitless. Values never change and corrected Measurements never raise
Alerts. Show the answer's `corrected` count, and confirm before
sending: it can't be undone, only corrected back.

## Live updates

None stream. While the list or a bridge shows `CONNECTING` or
`DISCONNECTED`, refetch `ListMqttBridges` every 10 s. Refetch Raw
payloads on demand ("Refresh") rather than polling.

## Permissions

| Control | Needs |
|---|---|
| Route, Adapter list | `AdapterService/ListAdapters` |
| Manifests | `AdapterService/ListManifests` |
| Bridges and status | `ConnectorService/ListMqttBridges`, `ConnectorService/GetMqttBridge` |
| Current Mapping, retention | `ConnectorService/GetMapping`, `ConnectorService/GetRawPayloadRetention` |
| Ingest keys | `AdapterService/ListIngestKeys`, `AdapterService/CreateIngestKey`, `AdapterService/RevokeIngestKey` |
| Register, retire | `AdapterService/RegisterAdapter`, `AdapterService/RetireAdapter` |
| Create connectors | `ConnectorService/CreateWebhookConnector`, `ConnectorService/CreateHostedMqttConnector`, `ConnectorService/CreateMqttBridge` |
| Change, delete a bridge | `ConnectorService/UpdateMqttBridge`, `ConnectorService/DeleteMqttBridge` |
| Edit, preview a Mapping | `ConnectorService/SetMapping`, `ConnectorService/PreviewMapping` |
| Raw payloads | `ConnectorService/ListRawPayloads` |
| Retention | `ConnectorService/SetRawPayloadRetention` |
| Reprocess | `ConnectorService/ReprocessRawPayloads` |
| Correct | `AdapterService/CorrectMeasurements` |

The read Permissions in the first four rows belong to every role. All
the rest belong to whole-Organisation admins only, so viewers, editors
and scoped admins get a read-only screen without keys, payloads or
forms.

## States

| State | Shows |
|---|---|
| Loading | `Loading` per section |
| Empty | "No data sources yet." with "Add a data source" for admins |
| Retired | a "Retired" badge; keys, Mapping and bridge settings read-only |
| No Mapping | `GetMapping` `NotFound`: "No Mapping yet; payloads are kept but make no Readings." |
| Payload problems | a filter "Problems only" (`onlyProblems`) and each `problem` beside its payload |
| Bridge disconnected | its `lastError` and "retrying" |
| Secret issued | the copy-once dialog |
| Reprocessing | the button busy until the answer, then its counts |
| Error | `ErrorState`; form errors beside the field |
| Read-only user | sections without their Permission hidden; no forms |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Every Adapter lists with its kind where knowable, retired state, keys
  and Manifests; bridges show live connection status.
- An admin can create each Connector kind and an Agent's Adapter, and
  every secret is shown exactly once.
- An admin can build a Mapping with topic levels, preview it against a
  real Raw payload, save it and reprocess a window.
- Raw payloads list with decoded bodies, topics and problems; retention
  can be read and changed.
- A Correction relabels a window and reports how many Measurements
  changed.
- Viewers, editors and scoped admins see a read-only screen.
- When a demo bridge is listed, the data credit from [Home](home.md)
  shows here too.
