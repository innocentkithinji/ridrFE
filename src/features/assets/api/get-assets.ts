import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useAssets loads every Asset the user may see, by name. Ridr sends them
// all at once; the screen filters and sorts in the browser.
export function useAssets() {
  return useQuery(RegistryService.method.listAssets);
}
