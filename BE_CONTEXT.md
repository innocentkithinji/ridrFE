# Ridr

Ridr is a neutral, protocol-agnostic telemetry platform ("Datadog for IoT"). Operations teams in health, fleet management, logistics and manufacturing send equipment sensor data from any source through adapters, then query it in one place, analyse it in real time and get alerted on it. Ridr handles readings only: no logs, and (for now) no patient data.

## Language

### Getting data in

**Adapter**:
Anything that delivers data into Ridr on a tenant's behalf. Every piece of data in Ridr can be traced back to the adapter that delivered it.
_Avoid_: Integration, plugin, source driver

**Connector**:
An adapter that Ridr hosts and runs: a general-purpose endpoint that receives or pulls data over a common protocol (for example MQTT, WebSocket or a webhook).
_Avoid_: Hosted adapter, receiver

**MQTT bridge**:
A connector that subscribes to a broker the customer (or a public feed) runs and pulls data from it.
_Avoid_: Subscriber, MQTT importer

**Hosted MQTT**:
A connector where devices publish directly to Ridr's own MQTT broker.
_Avoid_: Ridr broker

**Webhook connector**:
A connector that gives a vendor cloud a Ridr URL to push its payloads to, turned into readings by a mapping.
_Avoid_: Callback, HTTP connector

**Agent**:
An adapter that the customer runs outside Ridr (for example on a site gateway) and that pushes data to Ridr. Usually built with the Ridr SDK.
_Avoid_: Edge client, collector, forwarder

**Ingest key**:
A credential that lets one adapter send data, and nothing else: it can never read data. Optionally narrowed to particular devices.
_Avoid_: API key, token, secret

**Manifest**:
What an agent declares when it registers: the metrics it will send and the unit for each. Measurements may override the unit. Manifests are versioned; each reading records the version it arrived under, so a firmware change is a new version, not an error.
_Avoid_: Schema, declaration, config

**Ingestion**:
Where incoming data is accepted, attributed to its adapter and turned into readings. Payloads are turned into queryable readings here, not at query time.
_Avoid_: Import, upload

**Raw payload**:
The data exactly as a connector received it, kept alongside the readings made from it so it can be reprocessed later.
_Avoid_: Original message, source data

**Mapping**:
A tenant-defined description, attached to a connector, of how to turn a raw payload into readings: which fields hold which metrics, in which units, and where the time is. Agents do not need one; they send readings already in shape.
_Avoid_: Parser, transform, schema

**Reprocessing**:
Rebuilding readings from stored raw payloads after a mapping is fixed. Rebuilt readings replace the old ones and never raise alerts.
_Avoid_: Replay, backfill, re-ingest

**Correction**:
Relabelling the metric or unit of measurements over a time window, for when a manifest or mapping named them wrongly. Values are never rewritten, and corrections never raise alerts.
_Avoid_: Fix, edit, patch

### What data is about

**Device**:
The thing that reports readings, identified by the ID its adapter gives it (for example a temperature logger or a GPS unit).
_Avoid_: Sensor, thing, node

**Asset**:
The real-world thing an operations manager cares about (for example "Fridge 3" or "Truck KDA 123"). Queries and alerts target assets.
_Avoid_: Entity, equipment, object

**Unclaimed device**:
A device Ridr created automatically on its first reading and that nobody has named, labelled or assigned yet. Its data is kept in full; Ridr never drops data from an unknown device.
_Avoid_: Pending device, unknown device, orphan

**Attribute**:
A tenant-chosen `key=value` label on an asset describing what it is (for example `site=nairobi`, `type=fridge`). Queries, rules and scopes select assets by attributes.
_Avoid_: Label, property, metadata, tag

**Controlled key**:
An attribute key that a tenant has restricted to a fixed list of allowed values. Scopes may only use controlled keys.
_Avoid_: Enum, managed attribute

**Device health**:
Whether a device is *live* (reporting), *silent* (was reporting, has stopped) or *never seen*. A status, not an alert: only rules raise alerts.
_Avoid_: Heartbeat, connectivity, uptime

**Assignment**:
A dated link saying a device reported for an asset from one time to another. When a probe is swapped, the asset's history continues across devices. A device with no assignment stands as its own asset.
_Avoid_: Binding, pairing, attachment

### The data

**Reading**:
A single time-stamped observation that Ridr has accepted. There are three kinds: measurement, location and event.
_Avoid_: Data point, sample, record, message

**Tag**:
A `key=value` label on a reading describing the circumstances it was taken in (for example `route=46`). Unlike an attribute, it can differ from one reading to the next for the same asset.
_Avoid_: Attribute, label, dimension

**Measurement**:
A reading that holds a numeric value of some metric, in the unit it was reported in (for example 4.2 °C).
_Avoid_: Value, metric reading

**Metric**:
A named quantity that measurements are about (for example temperature or speed). Every metric has a quantity kind. Ridr ships built-in metrics; tenants may add their own.
_Avoid_: Field, channel, signal

**Quantity kind**:
What sort of thing a metric measures (speed, temperature, pressure, count…). It decides which units a metric may be reported in and converted between.
_Avoid_: Dimension, type

**Unit**:
The unit a measurement was reported in. Ridr keeps the original unit and converts only when someone reads the data, so each operations manager can see values in the unit they prefer. A measurement with no known unit is *unitless*: queryable but never converted.
_Avoid_: Scale, format

**Device time**:
When the device says a reading was taken. Queries place readings by device time.
_Avoid_: Event time, timestamp

**Clock skew**:
A device reporting readings dated in the future or before it was first seen. Ridr places those readings at their received time, keeps the reported time, and records a clock-skew event for the device. Such readings never raise alerts.
_Avoid_: Bad timestamp, time drift

**Received time**:
When Ridr accepted a reading.
_Avoid_: Ingest time, server time

**Rollup**:
A long-term summary of measurements over a fixed bucket (one minute or one hour) keeping min, max, average, count, first and last. Locations roll up to the last position per bucket; events are never rolled up.
_Avoid_: Aggregate, downsample, summary

**Late reading**:
A reading whose device time is too far behind its received time to be considered live (for example buffered data uploaded after an outage). It is stored and queryable but never raises an alert. How far behind counts as late is set per rule (5 minutes by default).
_Avoid_: Stale data, backfill

**Location**:
A reading that holds a geographic position.
_Avoid_: GPS point, coordinate

**Event**:
A reading that records that something discrete happened (for example "door opened").
_Avoid_: Log, state change

### Acting on data

**Rule**:
A tenant-defined condition over live readings that raises alerts. v1 kinds: threshold, no-data and geofence. A *disabled* rule is kept but stops evaluating until enabled again; disabling resolves its open alerts (by the person who disabled it), and an enabled rule starts afresh. Deleting a rule keeps its alerts as history. Unlike a silence, a disabled rule records nothing.
_Avoid_: Monitor, trigger, policy, paused

**Alert**:
A reactive notice that live data broke a rule, for one asset. Raised in real time, from fresh readings only. A rule has at most one open alert per asset.
_Avoid_: Alarm, incident, notification

**Alert states**:
*Firing* (raised, nobody has responded), *acknowledged* (a person has taken it on), *resolved* (the condition cleared or someone closed it). A firing alert is notified again while it stays unacknowledged, at an interval and up to a number of repeats that the tenant sets on each rule.
_Avoid_: Open/closed, active/inactive

**Silence**:
A time window during which alerts for selected assets are not notified. Rules keep evaluating and record what would have fired.
_Avoid_: Mute, snooze, maintenance mode, disable

**Contact group**:
A named set of people that rules notify (for example "Nairobi night shift"), so rules survive staff changes.
_Avoid_: Recipients, distribution list, team

**Channel**:
A way of delivering a notification: email, webhook, SMS or WhatsApp. The vendor implementation behind a channel (an SMTP server, an SMS vendor) is called a provider; never call the channel itself a provider.
_Avoid_: Provider (for the channel), transport, medium

**Delivery**:
One notification of an alert to one contact through its channel, and how it went: *pending*, *delivered*, *retrying* (an attempt failed, another is scheduled) or *failed* (Ridr gave up). Repeats of an alert are new deliveries.
_Avoid_: Message, send, dispatch

**Prediction**:
A forward-looking estimate of a future value or a future alert (for example "above 8 °C in 40 minutes"). Kept as its own series beside the actual readings. Planned, not yet in scope.
_Avoid_: Forecast, estimation

**Report**:
A saved query plus a schedule plus a template, producing a document such as a monthly cold-chain compliance PDF. Planned for right after v1.
_Avoid_: Export, summary

### Seeing data

**Query**:
A request for readings written in Ridr's query language (or its JSON form). Always confined to the asking user's tenant and scope.
_Avoid_: Search, report, request

**Live query**:
A query whose results keep streaming as new readings arrive.
_Avoid_: Subscription, stream, tail

**Dashboard**:
A saved, versioned layout of widgets, each backed by a query. Ridr stores and validates dashboards; the frontend draws them.
_Avoid_: Board, view, screen

### Who

**Tenant**:
A customer organisation. All data, adapters and alerts belong to exactly one tenant. Users see it named an Organisation, the word the sign-in screens use.
_Avoid_: Account, customer, workspace

**Cell**:
A complete, separate deployment of Ridr serving one or a few tenants that need physical separation. Same code, own databases.
_Avoid_: Dedicated instance, private cloud, shard

**Operations manager**:
The primary user: the person who watches dashboards, defines alerts and acts on them.
_Avoid_: End user, operator

**Role**:
What a user may do within a tenant (for example admin, editor, viewer).
_Avoid_: Permission level, group

**Permission**:
One action a user may take, such as creating a rule. Ridr fixes which permissions each role grants; a scope then limits which assets they apply to.
_Avoid_: Right, capability, privilege

**Scope**:
Which assets a user may see, expressed as a condition on asset attributes (for example only `site=nairobi`). A user with no scope sees the whole tenant.
_Avoid_: Visibility, filter, partition
