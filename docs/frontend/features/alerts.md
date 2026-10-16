# Alerts

The Alerts inbox: what Rules raised, who is on it, and whether the
Contact groups were reached. The starter implements this feature end
to end (`web/starter/src/features/alerts`), so its code is the
reference for every other page. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/alerts` | the inbox: open Alerts (firing and acknowledged) by default, or all |
| `/alerts/:alertId` | one Alert: state, value, times, Deliveries, its Asset's live Readings |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useAlerts(states)` | `AlertService/ListAlerts {states}` | method key + request |
| `useAlertAmongNewest(alertId)` | `AlertService/ListAlerts {limit: 1000}`, then `select` the one with that `id` | method key + request |
| `useDeliveries(alertId)` | `AlertService/ListDeliveries {alertId}` | method key + request |
| `useAssetName(assetId)` | `RegistryService/GetAsset {assetId}`, then `select` the Asset's name | method key + request |
| `useLiveQuery` | Live query `measurements \| where asset == "<current name>" \| range last 1h`, or `where device == "<asset>"` when `assetId` is empty | `QueryService/RunQuery` with that text |
| `useRule(ruleId)` (optional link) | `RuleService/GetRule {ruleId}` | method key + request |

There is no `GetAlert`, so the detail looks in the newest 1000:

<!-- sample: web/starter/src/features/alerts/api/get-alert.ts -->
```ts
export function useAlertAmongNewest(alertId: string) {
  return useQuery(
    AlertService.method.listAlerts,
    { limit: newestAlerts },
    {
      refetchInterval: alertsPollMs,
      select: (answer) => answer.alerts.find((a) => a.id === alertId),
    },
  );
}
```

`ListAlerts` also filters by `ruleId`, `assetId` (under every name the
Asset had), `asset` (a name, or a Device ID for a Device with no
Asset) and `silenceId`; the [Rules](rules.md), [Assets](assets.md) and
[Silences](silences.md) pages use those. Alerts of disabled and
deleted Rules stay listed. Deliveries come oldest first; `repeat` 0 is
the first notification, 1 the first repeat.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useAcknowledgeAlert` | `AlertService/AcknowledgeAlert {alertId}` | service key `AlertService` |
| `useResolveAlert` | `AlertService/ResolveAlert {alertId}` | service key `AlertService` |

An Alert's state shows in lists, the detail and its Deliveries, so
both invalidate the whole service (`useReloadAlerts`):

<!-- sample: web/starter/src/features/alerts/api/change-alert.ts -->
```ts
// useResolveAlert closes an open Alert by hand.
export function useResolveAlert() {
  return useMutation(AlertService.method.resolveAlert, {
    onSuccess: useReloadAlerts(),
  });
}
```

Acknowledging stops repeat notifications. Resolving by hand means the
Rule must see its condition hold for its full `for` duration again
before it fires a new Alert. Two users acting at once is harmless:
acknowledging an acknowledged Alert or resolving a resolved one
changes nothing; acknowledging a resolved one is `FailedPrecondition`
(show its message; the refetch shows the new state).

## Live updates

- **Alerts and Deliveries poll** every 15 s (`alertsPollMs`): Live
  queries carry Readings only.
- **The Asset's Readings** arrive through a Live query on the detail.
  An Alert's `asset` is the name the Asset had when it fired, so the
  detail looks the Asset up by `assetId` (`GetAsset`) and queries its
  current name; a renamed Asset's Readings keep showing.
- An Alert whose `assetId` is empty fired for a Device with no Asset;
  `asset` then holds the Device ID, and the detail queries
  `device == "<asset>"`, which still matches after the Device is
  assigned to an Asset.
- **Gap:** the heading, the list and `ListAlerts {asset}` still show
  and match the name at firing time; filter by `assetId` to follow a
  renamed Asset.

## Permissions

| Control | Needs |
|---|---|
| Route, list, detail | `AlertService/ListAlerts` |
| Deliveries | `AlertService/ListDeliveries` |
| Live Readings | `RegistryService/GetAsset` (the Live query itself needs none) |
| Acknowledge (firing only) | `AlertService/AcknowledgeAlert` (editor and up) |
| Resolve (firing or acknowledged) | `AlertService/ResolveAlert` (editor and up) |

<!-- sample: web/starter/src/features/alerts/components/alert-actions.tsx -->
```tsx
      {canAcknowledge && alert.state === AlertState.FIRING && (
        <button disabled={busy} onClick={() => acknowledge.mutate(target)}>
          Acknowledge
        </button>
      )}
```

A scoped user sees only Alerts of Assets in their Scope.

## States

| State | Shows |
|---|---|
| Loading | `Loading` for the list, the detail and the Deliveries separately |
| Empty | "No Alerts. Rules raise them when readings break." |
| Not found | "This Alert doesn't exist, or isn't yours to see." Also an Alert older than the newest 1000, or outside the Scope |
| Error | `ErrorState`; a failed action shows its message beside the buttons |
| Scoped user | the scope note above the list |
| Permission denied | `PermissionDenied` at either path; no link in the layout |
| Silenced | `silenceId` set: "Fired during a Silence; nobody was notified then" |

## Done when

- The inbox lists open Alerts newest first, toggles to all, and
  refreshes every 15 s.
- The detail shows state, value and unit, fired, acknowledged and
  resolved times and people, every Delivery with status, attempts and
  last error, and the Asset's live Readings.
- Acknowledge and Resolve appear only with their Permission and in the
  states where they apply, and every Alert view updates after either.
- The starter's tests pass: `alerts-list.test.tsx` and
  `alert-detail.test.tsx` cover a viewer, an editor, a scoped user and
  a user without the list Permission.
