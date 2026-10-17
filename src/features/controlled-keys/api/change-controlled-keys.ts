import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

// The cached ListControlledKeys, whatever its request.
const controlledKeysQuery = createConnectQueryKey({
  schema: RegistryService.method.listControlledKeys,
  cardinality: undefined,
});

// useDeclareControlledKey makes a key controlled with its allowed
// values. It fails when an Asset already holds a value outside the list.
export function useDeclareControlledKey() {
  return useMutation(RegistryService.method.declareControlledKey, {
    onSuccess: useReloadControlledKeys(),
  });
}

// useAddAllowedValues allows more values for a Controlled key; values
// already allowed are ignored.
export function useAddAllowedValues() {
  return useMutation(RegistryService.method.addAllowedValues, {
    onSuccess: useReloadControlledKeys(),
  });
}

// useRemoveAllowedValues stops allowing values for a Controlled key. It
// fails while an Asset still holds one of them, and one value must remain.
export function useRemoveAllowedValues() {
  return useMutation(RegistryService.method.removeAllowedValues, {
    onSuccess: useReloadControlledKeys(),
  });
}

// useReloadControlledKeys returns a callback refetching the Controlled keys.
function useReloadControlledKeys() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: controlledKeysQuery });
}
