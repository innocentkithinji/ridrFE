import { useQuery } from "@connectrpc/connect-query";
import { AccessService } from "@ridr/web";
import { useCan } from "@/lib/me";

// useMembers lists the Organisation's members, for showing actors by
// email. Without the Permission it never calls and stays empty.
export function useMembers() {
  const allowed = useCan(AccessService.method.listMembers);
  return useQuery(AccessService.method.listMembers, {}, { enabled: allowed });
}
