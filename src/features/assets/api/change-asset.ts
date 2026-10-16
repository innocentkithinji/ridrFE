import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AlertService, QueryService, RegistryService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

const listAssetsKey = createConnectQueryKey({
  schema: RegistryService.method.listAssets,
  cardinality: undefined,
});
const getAssetKey = createConnectQueryKey({
  schema: RegistryService.method.getAsset,
  cardinality: undefined,
});
// Alerts and Query answers show Asset names and Attributes.
const alertQueries = createConnectQueryKey({ schema: AlertService, cardinality: undefined });
const queryQueries = createConnectQueryKey({ schema: QueryService, cardinality: undefined });

// useCreateAsset creates an Asset, then reloads the Asset list.
export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation(RegistryService.method.createAsset, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listAssetsKey }),
  });
}

// useUpdateAsset renames an Asset and replaces its Attributes, then
// reloads everything that shows them.
export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation(RegistryService.method.updateAsset, {
    onSuccess: () =>
      Promise.all(
        [listAssetsKey, getAssetKey, alertQueries, queryQueries].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
