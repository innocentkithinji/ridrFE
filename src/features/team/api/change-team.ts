import type { DescMethodUnary } from "@bufbuild/protobuf";
import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AccessService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

// The cached answers of a list method, whatever its request.
function keyOf(method: DescMethodUnary) {
  return createConnectQueryKey({ schema: method, cardinality: undefined });
}

const members = keyOf(AccessService.method.listMembers);
const invitations = keyOf(AccessService.method.listInvitations);

// useInviteUser invites an email with a Role and Scope, which the person
// gets on first sign-in. Inviting the same email again resends it.
export function useInviteUser() {
  return useMutation(AccessService.method.inviteUser, { onSuccess: useReload(invitations) });
}

// useRevokeInvitation withdraws a pending invitation.
export function useRevokeInvitation() {
  return useMutation(AccessService.method.revokeInvitation, {
    onSuccess: useReload(invitations),
  });
}

// useSetMemberRole changes a member's Role; never your own.
export function useSetMemberRole() {
  return useMutation(AccessService.method.setMemberRole, { onSuccess: useReload(members) });
}

// useSetMemberScope changes which Assets a member sees.
export function useSetMemberScope() {
  return useMutation(AccessService.method.setMemberScope, { onSuccess: useReload(members) });
}

// useRemoveMember ends a membership and any pending invitation to the
// member's email; never your own.
export function useRemoveMember() {
  return useMutation(AccessService.method.removeMember, {
    onSuccess: useReload(members, invitations),
  });
}

// useReload returns a callback refetching the given lists.
function useReload(...queryKeys: ReturnType<typeof keyOf>[]) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
