import { useQuery } from "@connectrpc/connect-query";
import { ContactGroupService } from "@ridr/web";

// useContactGroups lists the Organisation's Contact groups by name. A
// scoped user gets only the groups their Rules notify. Signing secrets
// are never listed.
export function useContactGroups() {
  return useQuery(ContactGroupService.method.listContactGroups, {});
}
