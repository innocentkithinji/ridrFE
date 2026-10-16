import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useControlledKeys loads the Controlled keys, so Attribute forms offer
// only their allowed values. The Controlled keys feature has the same
// hook; the two are to merge into one shared one.
export function useControlledKeys() {
  return useQuery(RegistryService.method.listControlledKeys);
}
