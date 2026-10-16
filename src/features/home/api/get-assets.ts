import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useAssets loads every Asset the user may see.
export function useAssets(options: { enabled?: boolean } = {}) {
  return useQuery(RegistryService.method.listAssets, {}, { enabled: options.enabled });
}
