import { useMutation } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import { listIngestKeysKey, useInvalidate } from "@/features/data-sources/api/keys";

// useRevokeIngestKey revokes one Ingest key.
export function useRevokeIngestKey() {
  return useMutation(AdapterService.method.revokeIngestKey, {
    onSuccess: useInvalidate(listIngestKeysKey),
  });
}
