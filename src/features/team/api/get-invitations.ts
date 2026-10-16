import { useQuery } from "@connectrpc/connect-query";
import { AccessService } from "@ridr/web";

// useInvitations lists pending invitations; a scoped admin sees only
// those whose Scope lies inside their own. (Members come from
// useMembers in @/lib/api/access, which the Audit log shares.)
export function useInvitations() {
  return useQuery(AccessService.method.listInvitations, {});
}
