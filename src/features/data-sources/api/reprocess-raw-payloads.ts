import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { ConnectorService, QueryService } from "@ridr/web";
import { useInvalidate } from "@/features/data-sources/api/keys";

const listRawPayloadsKey = createConnectQueryKey({
  schema: ConnectorService.method.listRawPayloads,
  cardinality: undefined,
});

const queryServiceKey = createConnectQueryKey({ schema: QueryService, cardinality: undefined });

// useReprocessRawPayloads rebuilds a Connector's Readings from the Raw
// payloads received in [from, to) with its current Mapping. It runs
// within the request, so a long window answers late. Payloads record
// their new Mapping version and problems, and Readings change.
export function useReprocessRawPayloads() {
  return useMutation(ConnectorService.method.reprocessRawPayloads, {
    onSuccess: useInvalidate(listRawPayloadsKey, queryServiceKey),
  });
}
