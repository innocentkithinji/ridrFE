# Rules

A Rule watches live Readings of the Assets its selector picks and
raises an Alert, one Asset at a time, when its condition holds: a
threshold, no data, or a geofence. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/rules` | every Rule by name, disabled ones included, with kind and state |
| `/rules/new` | the create form |
| `/rules/:ruleId` | one Rule: its settings, edit form, enable/disable, delete, and its Alerts |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useRules` | `RuleService/ListRules {}` | method key |
| `useRule(ruleId)` | `RuleService/GetRule {ruleId}` | method key + request |
| `useAlerts({ruleId})` | `AlertService/ListAlerts {ruleId}` | method key + request |
| `useContactGroups` (form) | `ContactGroupService/ListContactGroups {}` | method key |
| `useMetrics`, `useUnits` (form) | `CatalogService/ListMetrics {}`, `CatalogService/ListUnits {}` | method keys |
| `useControlledKeys` (form) | `RegistryService/ListControlledKeys {}` | method key |

The form covers every field of `Rule`:

| Field | Rule |
|---|---|
| `name` | what people recognise |
| `selector` | Attribute `key=value` pairs; an Asset matching all is watched. Empty watches every Asset and Devices with no Asset |
| `condition` | exactly one of `threshold` (`metric`, `operator`, `value`, `unit`), `noData` (`metric`, empty = any Reading; `silentFor` at least 1 minute) or `geofence` (`zone` of 3 to 1000 points; `trigger` `LEAVES` or `ENTERS`) |
| `forDuration` | how long the condition must hold first; 0 fires on the first breaking Reading |
| `freshness` | how late a Reading may be and still count; default 5 minutes |
| `contactGroupIds` | who is notified |
| `renotifyInterval`, `maxRepeats` | repeat notifications while unacknowledged: both 0, or at least 1 minute and up to 100 |

A threshold's `unit` converts Readings of the same Quantity kind before
comparing; Readings in other units are ignored, so offer units that fit
the chosen Metric (`ListUnits` by `quantityKind`). Draw a geofence on
a map; it doesn't cross the antimeridian.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useCreateRule` | `RuleService/CreateRule {rule}` | method key `ListRules`; method key `ListContactGroups` |
| `useUpdateRule` | `RuleService/UpdateRule {rule}` (with its `id`) | service key `RuleService`; method key `ListContactGroups` |
| `useDisableRule` | `RuleService/DisableRule {ruleId}` | service keys `RuleService`, `AlertService` |
| `useEnableRule` | `RuleService/EnableRule {ruleId}` | service key `RuleService` |
| `useDeleteRule` | `RuleService/DeleteRule {ruleId}` | method key `ListRules`; `removeQueries` on `GetRule` for it; method key `ListContactGroups`; then navigate to `/rules` |

- **Create and update** take the whole Rule: update replaces name,
  selector, timing, Contact groups and condition. `disabled` is ignored
  there. A bad Rule or an unknown Contact group is `InvalidArgument`
  with a message for the form.
- **Disable** stops evaluation and resolves the Rule's open Alerts
  (hence `AlertService`); **enable** starts it afresh. Both are safe to
  repeat.
- **Delete** keeps the Rule's Alerts, still listed with `ruleName`.
- A scoped user's Contact group list shows only groups their Rules
  notify, which is why Rule changes refresh it.

## Live updates

None stream. A new or changed Rule evaluates new Readings at once; its
Alerts appear on the detail through the Alerts poll (every 15 s).

## Permissions

| Control | Needs |
|---|---|
| Route, list, detail | `RuleService/ListRules`, `RuleService/GetRule` |
| Create | `RuleService/CreateRule` (editor and up) |
| Edit | `RuleService/UpdateRule` (editor and up) |
| Enable, disable | `RuleService/EnableRule`, `RuleService/DisableRule` (editor and up) |
| Delete | `RuleService/DeleteRule` (editor and up) |
| Rule's Alerts | `AlertService/ListAlerts` |

A scoped user sees only Rules whose selector lies inside their Scope
(others read as not found), and can save only such Rules: the selector
must pin each Scope key to an allowed value, or the save is
`PermissionDenied`. An empty selector is never inside a Scope.

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Empty | "No Rules yet. Rules raise Alerts when Readings break them." with "Create" for editors |
| Disabled | a "Disabled since …" badge (`disabledAt`) and "Enable" for editors |
| No Contact groups | in the form: "Nobody will be notified" warning and a link to Contact groups |
| Not found | "This Rule doesn't exist, or isn't yours to see." |
| Error | `ErrorState`; form errors beside the form |
| Scoped user | the scope note; prefill the selector with the user's Scope |
| Permission denied | `PermissionDenied`; no link |

## Done when

- The list shows every Rule with its kind, selector and enabled state.
- An editor can create and edit each condition kind, pick Contact
  groups, set repeats, enable, disable and delete; viewers see the
  settings read-only.
- The detail lists the Rule's Alerts and links to each.
- A scoped editor's out-of-scope selector shows the server's message.
