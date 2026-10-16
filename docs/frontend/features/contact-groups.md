# Settings: Contact groups

A Contact group is a named set of people that Rules notify, so Rules
survive staff changes. Each Contact is one address on one Channel:
email, webhook, SMS or WhatsApp. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/contact-groups` | every Contact group by name with its Contacts; create, edit, delete, rotate a webhook secret |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useContactGroups` | `ContactGroupService/ListContactGroups {}` | method key |
| `useRules` (usage) | `RuleService/ListRules {}` | method key |

- Show which Rules notify each group (Rules whose `contactGroupIds`
  hold its `id`), so the user knows why a delete is refused.
- Signing secrets are never listed.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useCreateContactGroup` | `ContactGroupService/CreateContactGroup {name, contacts}` | method key `ListContactGroups` |
| `useUpdateContactGroup` | `ContactGroupService/UpdateContactGroup {contactGroupId, name, contacts}` | method key `ListContactGroups` |
| `useRotateWebhookSecret` | `ContactGroupService/RotateWebhookSecret {address}` | nothing (secrets aren't cached) |
| `useDeleteContactGroup` | `ContactGroupService/DeleteContactGroup {contactGroupId}` | method key `ListContactGroups` |

- **Webhook secrets are shown once.** Create and update return a
  `signingSecret` on each webhook Contact whose URL is new to the
  Organisation; rotate returns the replacement. Show it in a
  copy-once dialog ("You won't see this again"), keep it only in
  component state, and never write it into the query cache. Receivers
  verify notifications the Standard Webhooks way. A secret belongs to
  the URL, across every group that uses it.
- **Addresses:** email addresses, phone numbers for SMS and WhatsApp,
  `https` URLs for webhooks. A bad one is `InvalidArgument`; a taken
  name is `AlreadyExists`.
- **Delete** is `FailedPrecondition` while any Rule, disabled ones
  included, notifies the group; the message names it. Link to that
  Rule so the user can change it first.

## Live updates

None. The list refetches on mount, focus and invalidation.

## Permissions

| Control | Needs |
|---|---|
| Route and list | `ContactGroupService/ListContactGroups` |
| Create | `ContactGroupService/CreateContactGroup` (editor and up, whole Organisation) |
| Edit | `ContactGroupService/UpdateContactGroup` (editor and up, whole Organisation) |
| Rotate secret | `ContactGroupService/RotateWebhookSecret` (editor and up, whole Organisation) |
| Delete | `ContactGroupService/DeleteContactGroup` (editor and up, whole Organisation) |
| Usage column | `RuleService/ListRules` |

A scoped user sees only the groups their Rules notify and may change
none, so the screen is read-only for them.

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Empty | "No Contact groups. Rules need one to notify anybody." with "Create" for editors |
| Secret issued | the copy-once dialog |
| In use | the delete's message with links to the Rules |
| Error | `ErrorState`; form errors beside the form |
| Scoped user | the scope note; read-only |
| Permission denied | `PermissionDenied`; no link |

## Done when

- Every Contact group lists with its Contacts and the Rules using it.
- A whole-Organisation editor can create, edit and delete groups;
  deleting one in use shows which Rule to change.
- Every newly issued or rotated webhook secret is shown exactly once
  and never cached.
