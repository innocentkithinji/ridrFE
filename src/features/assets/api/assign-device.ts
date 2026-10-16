import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { QueryService, RegistryService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

const registryQueries = createConnectQueryKey({ schema: RegistryService, cardinality: undefined });
const queryQueries = createConnectQueryKey({ schema: QueryService, cardinality: undefined });

// useAssignDevice assigns a Device to an Asset from startsAt (unset means
// now), then reloads the Registry and Query answers it changes.
export function useAssignDevice() {
  const queryClient = useQueryClient();
  return useMutation(RegistryService.method.assignDevice, {
    onSuccess: () =>
      Promise.all(
        [registryQueries, queryQueries].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
