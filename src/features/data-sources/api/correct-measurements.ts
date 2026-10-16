import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AdapterService, QueryService } from "@ridr/web";
import { useInvalidate } from "@/features/data-sources/api/keys";

const queryServiceKey = createConnectQueryKey({ schema: QueryService, cardinality: undefined });

// useCorrectMeasurements relabels the Metric or Unit of the Measurements
// in a device-time window. Values never change, but every Query may
// answer differently, so they all reload.
export function useCorrectMeasurements() {
  return useMutation(AdapterService.method.correctMeasurements, {
    onSuccess: useInvalidate(queryServiceKey),
  });
}
