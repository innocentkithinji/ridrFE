import { useMutation } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import {
  getMqttBridgeKey,
  listMqttBridgesKey,
  useInvalidate,
} from "@/features/data-sources/api/keys";

// useUpdateMqttBridge changes a bridge's broker, username, password and
// topic filter. Leave password unset to keep it, "" to remove it.
export function useUpdateMqttBridge() {
  return useMutation(ConnectorService.method.updateMqttBridge, {
    onSuccess: useInvalidate(listMqttBridgesKey, getMqttBridgeKey),
  });
}
