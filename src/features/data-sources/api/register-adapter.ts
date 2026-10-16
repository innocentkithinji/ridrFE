import { useMutation } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import { listAdaptersKey, secretMutation, useInvalidate } from "@/features/data-sources/api/keys";

// useRegisterAdapter registers an Adapter for an Agent and issues its
// first Ingest key, whose plaintext the answer carries once.
export function useRegisterAdapter() {
  return useMutation(AdapterService.method.registerAdapter, {
    ...secretMutation,
    onSuccess: useInvalidate(listAdaptersKey),
  });
}
