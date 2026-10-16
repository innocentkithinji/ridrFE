import { useMutation } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import {
  listIngestKeysKey,
  secretMutation,
  useInvalidate,
} from "@/features/data-sources/api/keys";

// useCreateIngestKey issues another Ingest key for an Adapter, whose
// plaintext the answer carries once.
export function useCreateIngestKey() {
  return useMutation(AdapterService.method.createIngestKey, {
    ...secretMutation,
    onSuccess: useInvalidate(listIngestKeysKey),
  });
}
