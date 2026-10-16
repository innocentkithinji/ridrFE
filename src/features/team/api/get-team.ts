import { useQuery } from "@connectrpc/connect-query";
import { AccessService } from "@ridr/web";
import { useCan } from "@/lib/me";

// useMembers lists the Organisation's members (a scoped admin sees only
// those inside their Scope). Team manages them; the Audit log shows
// actors by their email. Without the Permission it never calls and
// stays empty.
export function useMembers() {
  const allowed = useCan(AccessService.method.listMembers);
  return useQuery(AccessService.method.listMembers, {}, { enabled: allowed });
}

// useInvitations lists pending invitations; a scoped admin sees only
// those whose Scope lies inside their own.
export function useInvitations() {
  return useQuery(AccessService.method.listInvitations);
}
