# Settings: Team

Who belongs to the Organisation, what each person may do (their Role)
and which Assets they see (their Scope). Admins invite people, change
Roles and Scopes, withdraw invitations and remove members. Words in
capitals are from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/team` | members by email with Role and Scope; pending invitations with when sent; the invite form |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useMe` | `AccessService/GetMe {}` | method key (already loaded by `MeProvider`) |
| `useMembers` | `AccessService/ListMembers {}` | method key |
| `useInvitations` | `AccessService/ListInvitations {}` | method key |
| `useControlledKeys` (Scope editor) | `RegistryService/ListControlledKeys {}` | method key |

- A member is `userId`, `email`, `role` and `scope`; an invitation is
  `email`, `role`, `scope` and `sentAt`. Members come by email; only
  people who have signed in are members.
- Mark the signed-in user's row ("you", by `GetMe`'s `userId`) and
  offer no Role change or removal on it.
- A **Scope** is a list of conditions, each a Controlled key and the
  values an Asset may hold for it; none means the whole Organisation.
  Build the editor from `ListControlledKeys`: pick keys, then values.
- A scoped admin sees only the invitations whose Scope lies inside
  their own.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useInviteUser` | `AccessService/InviteUser {email, role, scope}` | method key `ListInvitations` |
| `useRevokeInvitation` | `AccessService/RevokeInvitation {email}` | method key `ListInvitations` |
| `useSetMemberRole` | `AccessService/SetMemberRole {userId, role}` | method key `ListMembers` |
| `useSetMemberScope` | `AccessService/SetMemberScope {userId, scope}` | method key `ListMembers` |
| `useRemoveMember` | `AccessService/RemoveMember {userId}` | method keys `ListMembers`, `ListInvitations` |

- **Invite** sends an email through the identity provider; the person
  gets the Role and Scope on first sign-in. Inviting the same email
  again resends it and resets `sentAt`.
- **Revoke** withdraws a pending invitation; it can no longer be
  accepted. Unknown is `NotFound`.
- **Remove** ends the membership: the person's next call is refused,
  and any pending invitation to their email goes too. Their identity
  provider account stays. Confirm first.
- **Refusals to show:** changing your own Role or removing yourself is
  `FailedPrecondition`; a Scope naming a key that isn't controlled is
  `InvalidArgument`; a scoped admin granting a Scope outside their own
  is `PermissionDenied`; a member or invitation outside their Scope is
  `NotFound`, like an unknown one.
- A changed Role or Scope applies to the member's next call; their open
  Live queries close within about 30 s and their app reloads `GetMe`
  ([Permissions](../architecture/permissions.md)).

## Live updates

None. Lists refetch on mount, focus and invalidation. An invitation
leaves the list when its person signs in; refetch on focus catches it.

## Permissions

| Control | Needs |
|---|---|
| Route, members | `AccessService/ListMembers` (admins) |
| Invitations | `AccessService/ListInvitations` (admins) |
| Invite | `AccessService/InviteUser` (admins) |
| Revoke | `AccessService/RevokeInvitation` (admins) |
| Change Role | `AccessService/SetMemberRole` (admins) |
| Change Scope | `AccessService/SetMemberScope` (admins) |
| Remove | `AccessService/RemoveMember` (admins) |
| Header, "you" | `AccessService/GetMe` (everyone) |

Scoped admins have all of these, limited to people and invitations
inside their Scope. Roles are fixed: viewer, editor, admin; the
[permissions table](../reference/permissions.md) shows what each grants,
so link it beside the Role picker.

## States

| State | Shows |
|---|---|
| Loading | `Loading` per list |
| Only you | "You're the only member. Invite your team." |
| No invitations | "No pending invitations." |
| Error | `ErrorState`; a refused change shows its message beside the row |
| Scoped admin | the scope note: "You see people within your Scope only" |
| Permission denied | `PermissionDenied`; no link (viewers and editors) |

## Done when

- Members list with email, Role and Scope, the signed-in user marked;
  pending invitations list with Role, Scope and when sent.
- An admin can invite with a Role and Scope, revoke an invitation,
  change a member's Role and Scope, and remove a member, each with the
  server's refusal shown when it says no.
- The admin can't act on their own row.
