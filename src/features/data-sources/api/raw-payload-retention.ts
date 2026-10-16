import { createConnectQueryKey, useMutation, useQuery } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import { useInvalidate } from "@/features/data-sources/api/keys";

// The days Raw payloads may be kept, inclusive.
export const minRetentionDays = 1;
export const maxRetentionDays = 3650;

const getRetentionKey = createConnectQueryKey({
  schema: ConnectorService.method.getRawPayloadRetention,
  cardinality: undefined,
});

// useRawPayloadRetention is how many days the Organisation keeps Raw
// payloads. Cached by method key.
export function useRawPayloadRetention(options: { enabled?: boolean } = {}) {
  return useQuery(ConnectorService.method.getRawPayloadRetention, {}, options);
}

// useSetRawPayloadRetention sets it for the whole Organisation.
export function useSetRawPayloadRetention() {
  return useMutation(ConnectorService.method.setRawPayloadRetention, {
    onSuccess: useInvalidate(getRetentionKey),
  });
}
