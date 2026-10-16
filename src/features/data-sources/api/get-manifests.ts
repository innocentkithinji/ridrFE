import { useQuery } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";

// useManifests lists every Manifest version an Adapter has published,
// oldest first. Cached by method key and request.
export function useManifests(adapterId: string) {
  return useQuery(AdapterService.method.listManifests, { adapterId });
}
