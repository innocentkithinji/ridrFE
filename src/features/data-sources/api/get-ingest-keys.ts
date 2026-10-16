import { useQuery } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";

// useIngestKeys lists an Adapter's Ingest keys, revoked ones included.
// Cached by method key and request.
export function useIngestKeys(adapterId: string) {
  return useQuery(AdapterService.method.listIngestKeys, { adapterId });
}
