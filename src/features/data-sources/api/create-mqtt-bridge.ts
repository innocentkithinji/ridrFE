import { useMutation } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import {
  listAdaptersKey,
  listMqttBridgesKey,
  useInvalidate,
} from "@/features/data-sources/api/keys";

// useCreateMqttBridge creates an MQTT bridge and its Adapter. The
// password goes with the request and is never shown again.
export function useCreateMqttBridge() {
  return useMutation(ConnectorService.method.createMqttBridge, {
    onSuccess: useInvalidate(listAdaptersKey, listMqttBridgesKey),
  });
}
