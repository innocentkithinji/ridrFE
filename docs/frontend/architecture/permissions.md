# Permissions

The app shows a user only what they may do. It doesn't work that out
itself: `GetMe` lists the user's **Permissions**, one per procedure
they may call, computed from the same rules the server enforces. A
procedure missing from the list is a call the server would refuse, so
hiding it in the UI and refusing it on the server always agree.

Which Role grants which Permission is in the generated
[permissions table](../reference/permissions.md).

## Asking "may this user...?"

A Permission is named after the procedure, such as
`ridr.v1.AlertService/AcknowledgeAlert`. The starter derives the name
from the generated method, so a typo is a type error:

<!-- sample: web/starter/src/lib/me.tsx -->
```tsx
export function permissionOf(method: DescMethod): string {
  return `${method.parent.typeName}/${method.name}`;
}

// useCan tells whether the user may call method. The server works the
// answer out, so a missing Permission is a call it would refuse.
export function useCan(method: DescMethod): boolean {
  return useMe().permissions.includes(permissionOf(method));
}
```

Actions are hidden, not disabled, when the Permission is missing, and
offered only in the states where they apply:

<!-- sample: web/starter/src/features/alerts/components/alert-actions.tsx -->
```tsx
      {canAcknowledge && alert.state === AlertState.FIRING && (
        <button disabled={busy} onClick={() => acknowledge.mutate(target)}>
          Acknowledge
        </button>
      )}
      {canResolve && alert.state !== AlertState.RESOLVED && (
        <button disabled={busy} onClick={() => resolve.mutate(target)}>
          Resolve
        </button>
      )}
```

For a block of markup, `<Can method={...}>` wraps the same check.

A screen gates itself on its list Permission and shows the
permission-denied state without it:

<!-- sample: web/starter/src/features/alerts/components/alerts-list.tsx -->
```tsx
export function AlertsList() {
  if (!useCan(AlertService.method.listAlerts)) {
    return <PermissionDenied what="Alerts" />;
  }
  return <AlertsInbox />;
}
```

## Scopes

A user with a **Scope** sees only the Assets it admits; the server
filters every answer, so a list simply holds less. Tell the user why,
so missing items don't look like a bug:

<!-- sample: web/starter/src/lib/me.tsx -->
```tsx
export function useIsScoped(): boolean {
  const scope = useMe().scope;
  return (scope?.conditions.length ?? 0) > 0;
}
```

Some Permissions reach past any Scope (tenant-wide settings, managing
Adapters and Ingest keys, the Audit log); a scoped user doesn't get them, even as an admin. The
table's "With a Scope" column shows which. An Asset, Rule or Alert
outside a user's Scope reads as **not found**, never as refused.

## Contract

`GetMe` (`AccessService/GetMe`, every member may call it) returns:

| Field | Use |
|---|---|
| `email` | show who is signed in |
| `tenantName` | show where; the Tenant's display name, shown as the Organisation name |
| `role` | `ROLE_VIEWER`, `ROLE_EDITOR` or `ROLE_ADMIN`; display only, never for gating |
| `scope` | `conditions` on Asset attributes; empty means the whole Tenant |
| `permissions` | fully qualified procedure names, sorted; the only input to gating |
| `userId`, `tenantId` | identifiers; rarely shown |

- **Gate on `permissions`, never on `role`.** Roles may change what
  they grant; the list is always right.
- **Routes:** each route is gated by the Permission named in the
  [route map](../README.md#route-map). Without it, hide the link and
  show the permission-denied state at the URL.
- **Actions:** hide every control whose procedure is missing from
  `permissions`.
- **Live queries** are not a procedure and need no Permission: every
  member may open one, and the server applies the Scope.
- **Changes mid-session.** `GetMe` is cached like any query. If an
  admin changes a user's Role or Scope, open Live queries close within
  about 30 seconds, and the app reloads `GetMe` before reopening. Until
  then a hidden action stays hidden, and a visible one may be refused
  with `PermissionDenied` ([Errors](errors.md)).
- **Tests:** `src/features/alerts/components/alerts-list.test.tsx`
  covers a viewer seeing no actions, an editor acting, a scoped user's
  note and a user without the list Permission.
