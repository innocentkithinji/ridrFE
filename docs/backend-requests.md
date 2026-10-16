# Backend requests

What the web app needs from Ridr that Ridr doesn't offer yet, and what
the app does until it does. File each as an issue on
[`innocentkithinji/ridr`](https://github.com/innocentkithinji/ridr) and
link it here.

| Need | Why | Until then | Issue |
|---|---|---|---|
| **A `unit` stage per Quantity kind** (such as `unit [degF], mph`): a Query takes one `unit` | A Query over all of an Asset's Metrics can show only one of the user's Unit preferences | Queries over any Metric (Asset detail) take the user's preference only when they have exactly one; otherwise values show as reported. Server-side Unit preferences ([ridr#53](https://github.com/innocentkithinji/ridr/issues/53)) are done and in use | not filed |
| **An Adapter's kind** (Agent, Webhook, Hosted MQTT, MQTT bridge) on `ListAdapters` | Data sources must show what each Adapter is and offer the right actions | Only MQTT bridges are told apart (`ListMqttBridges`); Mapping and Raw payload sections show on every non-retired Adapter | not filed |
| **A Webhook connector's URL start** (Ridr's public webhook address) outside `CreateWebhookConnector` | A new Ingest key on a Webhook connector must show the new URL, but the URL's start is told only once, at creation, and differs from the API URL | The browser that created the connector remembers its URL start (no key) per Adapter in browser storage; elsewhere a new key shows without its URL | not filed |
| **A Device list with health** (every Device, its Adapter, last seen, live/silent/never seen) | Home's Device health panel and Asset pages need it in one call | Home assembles it from a rollup by Device, Assignments and Unclaimed devices | not filed |
| **`GetAlert`** by ID | An Alert older than the newest 1000 can't be opened | The Alert detail searches the newest 1000 with `ListAlerts`; older ones read as not found | not filed |
| **Extra dev users** (viewer, editor, scoped) on the local stack | End-to-end tests of Role and Scope behaviour need users other than the dev admin | Permission gating is proved with a dev-only route gated by a Permission nobody has | [ridr#52](https://github.com/innocentkithinji/ridr/issues/52) |
| **Contact address checks per Channel**: `CreateContactGroup` and `UpdateContactGroup` accept any email or phone address (only webhooks must be `https`) | A typo'd address saves and no notification reaches it | The form checks each address for its Channel before sending (email shape, `https` URL, E.164 phone number) | not filed |
| **Name the Rule in a refused Contact group delete**: the `FailedPrecondition` says only "a rule still notifies this contact group" | The user must know which Rule to change | The delete dialog links the Rules whose `contactGroupIds` hold the group, from `ListRules` | not filed |
| **A Location's Asset**: Readings name their Device, and no procedure maps Devices to Assets in one call | A map should label each Track with its Asset's name | Tracks are per Device, labelled with the Device ID; a Query `where asset == …` shows that Asset's Devices | not filed |
