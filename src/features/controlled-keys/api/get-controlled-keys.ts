import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useControlledKeys lists every Controlled key with its sorted allowed
// values. Pickers across the app (Assets, Silences, Rules, Team) reuse it.
export function useControlledKeys() {
  return useQuery(RegistryService.method.listControlledKeys);
}
