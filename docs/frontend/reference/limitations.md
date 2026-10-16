# Limitations

What Ridr doesn't do yet, and how the app should behave until it does.
Build no screen for a capability listed as not built. Each feature page
repeats the limitations that touch it; this page is the whole list.

## Not built

| Capability | Until it exists |
|---|---|
| **Tenant onboarding** ([#48](https://github.com/innocentkithinji/ridr/issues/48)) | No API creates a Tenant. A Clerk Organisation unknown to Ridr gets `PermissionDenied` on every call, `GetMe` included; its message is `organisation is not set up in Ridr`, which tells it apart from a user who isn't a member. Show "This Organisation isn't set up in Ridr yet." with the Organisation switcher and sign-out, not a generic error ([Sessions](../architecture/sessions.md#contract)). Tenants come from the dev seed only. The Clerk session token needs an `email` claim for invitations to work ([Getting started](../getting-started.md)) |
| **Cursor pagination** ([#49](https://github.com/innocentkithinji/ridr/issues/49)) | See [Lists](#lists) below |
| **Per-Tenant rate limits** ([#50](https://github.com/innocentkithinji/ridr/issues/50)) | See [Rate limits](#rate-limits) below |
| **Predictions and reports** | Not built. No placeholder screens, menu items or "coming soon" links |
| **Custom Roles** | Roles are fixed: viewer, editor, admin |
| **Deleting Assets** | Unassigning Devices is the only removal |
| **Un-controlling a Controlled key**, renaming a value | Add the new value, move Assets, remove the old. Values are case-sensitive |
| **`GetAlert`** | The Alert detail searches the newest 1000 with `ListAlerts`; an older Alert reads as not found |
| **A Live query of Alerts** or any record other than Readings | Alert and Delivery lists poll every 15 s; other lists refetch on focus and after mutations |
| **A list of every Device with its health** | Home assembles it from a rollup by Device, Assignments and Unclaimed devices ([Home](../features/home.md#data)) |
| **An Adapter's kind** | Only MQTT bridges can be told apart (`ListMqttBridges`); Webhook and Hosted MQTT connectors look like any Adapter ([Data sources](../features/data-sources.md#data)) |
| **Audit of Assets and Assignments** | Their changes don't appear in the Audit log |
| **MQTT bridge TLS options** | No client certificates or custom CAs: encrypted brokers need a public CA certificate |
| **A hosted staging environment** | Run the backend locally ([Getting started](../getting-started.md)) |

## Lists

No list procedure takes a cursor. Two kinds:

| Kind | Procedures | The UI |
|---|---|---|
| Everything at once | `ListAssets`, `ListRules`, `ListAdapters`, `ListDashboards`, `ListDashboardVersions`, `ListContactGroups`, `ListMembers`, `ListInvitations`, `ListSilences`, `ListUnclaimedDevices`, `ListControlledKeys`, `ListMetrics`, `ListUnits`, `ListMqttBridges`, `ListIngestKeys`, `ListManifests`, `ListDeliveries` | filter, sort and page in the browser; virtualise long tables |
| Capped by `limit` | `ListAlerts`, `ListAuditEntries`, `ListRawPayloads` (0 means 100, at most 1000) | show "newest N"; the Audit log reaches further with its `to` filter, the others can't |

Query answers are capped at 10,000 rows ([query language](query-language.md#cost-limits)).

## Rate limits

- Each Adapter and each Tenant may send 250 Readings per second, with
  bursts up to 2500, by default. One Ridr process sustains about 500
  Readings per second end to end; Rule evaluation is the limit.
- Limits are process-wide settings, the same for every Tenant, applied
  by each server copy on its own. Raise them with
  `RIDR_ADAPTER_READINGS_PER_SECOND`, `RIDR_ADAPTER_BURST`,
  `RIDR_TENANT_READINGS_PER_SECOND` and `RIDR_TENANT_BURST`
  ([`docs/rate-limits.md`](../../rate-limits.md)); the local stack sets
  the Tenant rate to 450.
- What the UI sees: a connector's over-limit payload becomes a Raw
  payload with a problem, and a busy fleet's Live query carries many
  Readings per second. Narrow live views by Asset, Metric or Attribute
  rather than streaming everything.

## Queries and live data

- A query filtering or grouping by `asset`, `asset.<key>` or
  `tag.<key>`, or asking for a percentile, reads raw Readings and is
  limited to 31 days. Every query of a user with a Scope does, so
  scoped users can't chart longer than 31 days.
- Locations and Events can't be rolled up; a map shows raw Locations,
  so keep its range short.
- A Live query never recomputes rollup `rows`: rollup views refetch.
- A Live query has no resume (`Last-Event-ID`): a reopened one sends
  a fresh `result`, which replaces the cache entry.
- A Live query that fails to open because the query is bad or too
  costly stops with the server's message, but the starter doesn't read
  its `QueryProblem` position. Check user-written queries with
  `RunQuery` first.
- `GetLatestReading` returns the newest Measurement only, not Locations
  or Events.

## Rules and Alerts

- Geofences don't cross the antimeridian (longitude ±180°).
- A no-data Rule watches only Assets that sent a fresh related Reading
  since the Rule was created or changed: a Device that never reported
  isn't silent to it.
- A Reading evaluated at the moment a Rule is disabled can still open
  an Alert just after; resolve it by hand.

## Data sources

- **Hosted MQTT:** a publish to a topic outside the connector's
  `adapters/<id>` tree is dropped without telling the Device, so show
  the topic prominently. A revoked Ingest key's MQTT connection may
  stay open for up to an hour. Keys narrowed to Devices can't connect.
- **Webhook URLs** hold the Ingest key and are shown only once; a new
  key means a new URL.
- **Mappings:** a payload that is a top-level JSON array isn't split
  into one payload per item; Preview shows the problem. Two admins
  saving the same Mapping at once may make one save fail; save again.
- **Reprocessing** runs within the request, so a long window takes as
  long to answer, and only payloads within Raw payload retention can be
  reprocessed.
