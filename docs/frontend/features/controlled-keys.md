# Settings: Controlled keys

A Controlled key restricts an Attribute key to a fixed list of allowed
values, so a typo such as `site=nairobbi` is rejected. Scopes are built
only from Controlled keys, and forms across the app use them as
pickers. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/controlled-keys` | every Controlled key by key, with its sorted allowed values; declare, add values, remove values |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useControlledKeys` | `RegistryService/ListControlledKeys {}` | method key |
| `useAssets` (usage) | `RegistryService/ListAssets {}` | method key |

Count the Assets holding each value from `ListAssets`, so the user
knows which values can be removed. The Assets, Silences, Rules and Team
pages reuse `useControlledKeys` for their pickers.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useDeclareControlledKey` | `RegistryService/DeclareControlledKey {key, allowedValues}` | method key `ListControlledKeys` |
| `useAddAllowedValues` | `RegistryService/AddAllowedValues {key, values}` | method key `ListControlledKeys` |
| `useRemoveAllowedValues` | `RegistryService/RemoveAllowedValues {key, values}` | method key `ListControlledKeys` |

- **Declare** needs a key of letters, digits, `_` or `-`, and at least
  one value. It fails when an Asset already holds a value outside the
  list; show the message.
- **Add** ignores values already allowed.
- **Remove** fails while an Asset still holds a value being removed,
  and at least one value must remain. Values are case-sensitive.
- A Controlled key can't be un-controlled, and its values can't be
  renamed: add the new value, move Assets to it, then remove the old.

## Live updates

None. The list refetches on mount, focus and invalidation.

## Permissions

| Control | Needs |
|---|---|
| Route, list | `RegistryService/ListControlledKeys` |
| Declare | `RegistryService/DeclareControlledKey` (whole-Organisation admins) |
| Add values | `RegistryService/AddAllowedValues` (whole-Organisation admins) |
| Remove values | `RegistryService/RemoveAllowedValues` (whole-Organisation admins) |
| Usage counts | `RegistryService/ListAssets` |

Everyone else sees the keys read-only. A scoped user's usage counts
cover only Assets in their Scope.

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Empty | "No Controlled keys. Declare one, such as site, to build Scopes." |
| Value in use | the remove's message, with the usage count |
| Error | `ErrorState`; form errors beside the form |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Every Controlled key lists with its allowed values and how many
  Assets hold each.
- An admin can declare a key, add values and remove unused ones; a
  refused change shows the server's reason.
- Non-admins see the list without forms.
