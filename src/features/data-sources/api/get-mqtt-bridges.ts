import { useQuery } from "@connectrpc/connect-query";
import { ConnectorService, MqttBridgeState, type MqttBridge } from "@ridr/web";

// A bridge keeps retrying on its own, and nothing streams its status, so
// while one isn't connected its status refetches this often.
const statusRefetchMs = 10_000;

function settling(bridge: MqttBridge): boolean {
  return (
    bridge.adapter?.retiredAt === undefined &&
    bridge.status?.state !== MqttBridgeState.CONNECTED
  );
}

// useMqttBridges lists every MQTT bridge, refetching while any isn't
// connected. Cached by method key. An Adapter is an MQTT bridge when this
// list holds its ID.
export function useMqttBridges() {
  return useQuery(
    ConnectorService.method.listMqttBridges,
    {},
    {
      refetchInterval: (query) =>
        query.state.data?.bridges.some(settling) ? statusRefetchMs : false,
    },
  );
}

// useIsMqttBridge tells whether an Adapter is an MQTT bridge: undefined
// while the list loads, or when not enabled.
export function useIsMqttBridge(adapterId: string, enabled = true) {
  return useQuery(
    ConnectorService.method.listMqttBridges,
    {},
    { enabled, select: (answer) => answer.bridges.some((b) => b.adapter?.id === adapterId) },
  ).data;
}

// useMqttBridge reads one bridge, refetching while it isn't connected.
// Cached by method key and request.
export function useMqttBridge(adapterId: string) {
  return useQuery(
    ConnectorService.method.getMqttBridge,
    { adapterId },
    {
      refetchInterval: (query) => {
        const bridge = query.state.data?.bridge;
        return bridge && settling(bridge) ? statusRefetchMs : false;
      },
    },
  );
}
