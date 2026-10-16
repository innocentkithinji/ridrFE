import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { QueryService, RegistryService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

// An Assignment changes which Asset a Device's Readings count for, the
// Unclaimed list, health panels and every Query naming the Asset.
const registryQueries = createConnectQueryKey({ schema: RegistryService, cardinality: undefined });
const queryQueries = createConnectQueryKey({ schema: QueryService, cardinality: undefined });

function useReloadAfterAssignment() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [registryQueries, queryQueries].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    ).then(() => undefined);
}

// useAssignDevice assigns a Device to an Asset from startsAt (unset means
// now), ending its current Assignment then.
export function useAssignDevice() {
  const reload = useReloadAfterAssignment();
  return useMutation(RegistryService.method.assignDevice, { onSuccess: reload });
}

// useUnassignDevice ends a Device's current Assignment at endsAt (unset
// means now).
export function useUnassignDevice() {
  const reload = useReloadAfterAssignment();
  return useMutation(RegistryService.method.unassignDevice, { onSuccess: reload });
}
