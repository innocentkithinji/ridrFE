# Silences

A Silence holds back notifications for selected Assets during a time
window, such as planned maintenance or a defrost. Rules keep evaluating
and record the Alerts that fire; nobody is notified until the Silence
ends, and an Alert still firing then is notified at that moment. Words
in capitals are from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/silences` | pending and active Silences, a toggle for expired ones, the create form, and each Silence's held-back Alerts |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useSilences(includeExpired)` | `SilenceService/ListSilences {includeExpired}` | method key + request |
| `useHeldBackAlerts(silenceId)` | `AlertService/ListAlerts {silenceId}` | method key + request |
| `useControlledKeys` (form) | `RegistryService/ListControlledKeys {}` | method key |
| `useAssets` (form preview) | `RegistryService/ListAssets {}` | method key |

- Silences come latest to start first. `state` is worked out by the
  server as of the call: `PENDING`, `ACTIVE` or `EXPIRED`.
- The **selector** is Attribute `key=value` pairs; a Silence covers
  Assets holding every pair. Offer Controlled keys and their allowed
  values first, and preview the matching Assets from `ListAssets`.
  Devices with no Asset are never silenced.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useCreateSilence` | `SilenceService/CreateSilence {selector, startsAt?, endsAt, comment}` | service key `SilenceService` |
| `useEndSilence` | `SilenceService/EndSilence {silenceId}` | service key `SilenceService`, service key `AlertService` |

- `startsAt` unset starts now; `endsAt` must be later and in the
  future; `comment` is at most 500 characters. A bad request is
  `InvalidArgument` with a message to show beside the form.
- A Silence ends at `endsAt` with no further step. Ending one early is
  safe to repeat. Ending it may notify held-back Alerts at once, hence
  the `AlertService` invalidation.
- Silences can't be edited or deleted: end one and create another.

## Live updates

None stream. Refetch the list every 60 s while it shows a pending or
active Silence, so `state` moves on as windows open and close.

## Permissions

| Control | Needs |
|---|---|
| Route and list | `SilenceService/ListSilences` |
| Create | `SilenceService/CreateSilence` (editor and up) |
| End | `SilenceService/EndSilence` (editor and up) |
| Held-back Alerts | `AlertService/ListAlerts` |

A scoped user sees and creates only Silences within their Scope: the
selector must pin each Scope key to an allowed value, or the create is
`PermissionDenied` (show the message beside the form).

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Empty | "No Silences. Create one before planned maintenance." |
| Error | `ErrorState`; a failed create or end shows its message beside the control |
| Scoped user | the scope note; prefill the selector with the user's Scope |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Pending and active Silences show with selector, window, comment,
  creator and state; expired ones appear on demand.
- An editor can create a Silence from a selector built of Controlled
  keys, and end one early; viewers see neither control.
- Each Silence lists the Alerts it held back.
- A scoped editor's out-of-scope selector shows the server's message.
