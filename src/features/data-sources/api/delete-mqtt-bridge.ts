import { useMutation } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import {
  adapterServiceKey,
  connectorServiceKey,
  useInvalidate,
} from "@/features/data-sources/api/keys";

// useDeleteMqttBridge stops a bridge, forgets its settings and retires
// its Adapter, so every Adapter and Connector query reloads.
export function useDeleteMqttBridge() {
  return useMutation(ConnectorService.method.deleteMqttBridge, {
    onSuccess: useInvalidate(adapterServiceKey, connectorServiceKey),
  });
}
