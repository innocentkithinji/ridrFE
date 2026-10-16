# Backend requests

What the web app needs from Ridr that Ridr doesn't offer yet, and what
the app does until it does. File each as an issue on
[`innocentkithinji/ridr`](https://github.com/innocentkithinji/ridr) and
link it here.

| Need | Why | Until then | Issue |
|---|---|---|---|
| **Server-side Unit preference**: read, set and clear a user's Unit per Quantity kind | A Unit preference kept in the browser doesn't follow the user to another device | Kept per user in browser storage; applied only to Queries the app writes | [ridr#53](https://github.com/innocentkithinji/ridr/issues/53) |
| **An Adapter's kind** (Agent, Webhook, Hosted MQTT, MQTT bridge) on `ListAdapters` | Data sources must show what each Adapter is and offer the right actions | Only MQTT bridges are told apart (`ListMqttBridges`); Mapping and Raw payload sections show on every non-retired Adapter | not filed |
| **A Webhook connector's URL start** (Ridr's public webhook address) outside `CreateWebhookConnector` | A new Ingest key on a Webhook connector must show the new URL, but the URL's start is told only once, at creation, and differs from the API URL | The browser that created the connector remembers its URL start (no key) per Adapter in browser storage; elsewhere a new key shows without its URL | not filed |
| **A Device list with health** (every Device, its Adapter, last seen, live/silent/never seen) | Home's Device health panel and Asset pages need it in one call | Home assembles it from a rollup by Device, Assignments and Unclaimed devices | not filed |
| **`GetAlert`** by ID | An Alert older than the newest 1000 can't be opened | The Alert detail searches the newest 1000 with `ListAlerts`; older ones read as not found | not filed |
| **Extra dev users** (viewer, editor, scoped) on the local stack | End-to-end tests of Role and Scope behaviour need users other than the dev admin | Permission gating is proved with a dev-only route gated by a Permission nobody has | [ridr#52](https://github.com/innocentkithinji/ridr/issues/52) |
| **Contact address checks per Channel**: `CreateContactGroup` and `UpdateContactGroup` accept any email or phone address (only webhooks must be `https`) | A typo'd address saves and no notification reaches it | The form checks each address for its Channel before sending (email shape, `https` URL, E.164 phone number) | not filed |
| **Name the Rule in a refused Contact group delete**: the `FailedPrecondition` says only "a rule still notifies this contact group" | The user must know which Rule to change | The delete dialog links the Rules whose `contactGroupIds` hold the group, from `ListRules` | not filed |
