import { createConnectQueryKey } from "@connectrpc/connect-query";
import { AdapterService, ConnectorService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

type QueryKey = ReturnType<typeof createConnectQueryKey>;

export const listAdaptersKey = createConnectQueryKey({
  schema: AdapterService.method.listAdapters,
  cardinality: undefined,
});

export const listIngestKeysKey = createConnectQueryKey({
  schema: AdapterService.method.listIngestKeys,
  cardinality: undefined,
});

export const listMqttBridgesKey = createConnectQueryKey({
  schema: ConnectorService.method.listMqttBridges,
  cardinality: undefined,
});

export const getMqttBridgeKey = createConnectQueryKey({
  schema: ConnectorService.method.getMqttBridge,
  cardinality: undefined,
});

export const adapterServiceKey = createConnectQueryKey({
  schema: AdapterService,
  cardinality: undefined,
});

export const connectorServiceKey = createConnectQueryKey({
  schema: ConnectorService,
  cardinality: undefined,
});

// useInvalidate returns a callback reloading every query under keys.
export function useInvalidate(...keys: QueryKey[]) {
  const queryClient = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

// Options for a mutation whose answer holds a secret Ridr shows once: it
// stays in the mutation cache not a moment longer than the screen
// watches it. The screen moves the secret into component state and
// resets the mutation.
export const secretMutation = { gcTime: 0 };
