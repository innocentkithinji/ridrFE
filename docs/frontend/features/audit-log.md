# Settings: Audit log

Who changed what, and when. Configuration changes, Corrections and
Reprocessing are recorded as they happen and never edited or removed.
Words in capitals are from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/audit-log` | entries newest first, with filters for who, what, target and time |

Keep the filters in the URL query so a view can be shared.

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useAuditEntries(filters)` | `AuditService/ListAuditEntries {actorId, action, targetId, from, to, limit}` | method key + request |
| `useMembers` (names) | `AccessService/ListMembers {}` | method key |

- An entry has `recordedAt`, `actorId` (the identity provider's user
  ID), `action` as `<thing>.<verb>`, `targetId` (an Adapter, Ingest
  key, user, email, Metric name, Rule...) and `details`. Show
  `actorId` as the member's email from `ListMembers`; a removed member
  shows as the raw ID.
- `limit` 0 means 100, at most 1000. To read further back, set `to`
  to the oldest `recordedAt` shown and fetch again ("Older").
- The action filter offers the actions Ridr records, listed as
  constants in [`internal/audit/audit.go`](../../../internal/audit/audit.go)
  (`rule.updated`, `member.role_changed`, `mqtt_bridge.deleted`...).
  Free text works too: the filter is an exact match.
- Changes to Assets and Assignments, and Alert acknowledgements and
  resolutions, are not audited; Alerts carry who acted themselves.

## Mutations

None: the log is read-only.

## Live updates

None. "Refresh" refetches; the list also refetches on focus.

## Permissions

| Control | Needs |
|---|---|
| Route, entries | `AuditService/ListAuditEntries` (whole-Organisation admins) |
| Emails for actors | `AccessService/ListMembers` |

Scoped admins don't get the Audit log: hide the link.

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Empty | "No changes recorded." (or "No changes match these filters.") |
| Error | `ErrorState` |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Entries list newest first with time, actor email, action, target and
  details.
- Filters by actor, action, target and time window work, live in the
  URL, and "Older" reaches past the first 1000 entries.
- Only whole-Organisation admins see the route.
