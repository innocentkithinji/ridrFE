import { useQuery } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";

// useMqttBridges lists every MQTT bridge, to credit the open data they
// bring in.
export function useMqttBridges() {
  return useQuery(ConnectorService.method.listMqttBridges, {});
}
