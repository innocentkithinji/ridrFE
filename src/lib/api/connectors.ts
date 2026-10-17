import { useQuery } from "@connectrpc/connect-query";
import { ConnectorService, MqttBridgeState, type MqttBridge } from "@ridr/web";

// A bridge keeps retrying on its own, and nothing streams its status, so
// while one isn't connected its status refetches this often.
const statusRefetchMs = 10_000;

// settling tells whether a bridge is still trying to connect.
export function settling(bridge: MqttBridge): boolean {
  return (
    bridge.adapter?.retiredAt === undefined &&
    bridge.status?.state !== MqttBridgeState.CONNECTED
  );
}

// useMqttBridges lists every MQTT bridge, refetching while any isn't
// connected. Data sources manage them; Home credits the open data they
// bring in. An Adapter is an MQTT bridge when this list holds its ID.
export function useMqttBridges(options: { enabled?: boolean } = {}) {
  return useQuery(
    ConnectorService.method.listMqttBridges,
    {},
    {
      enabled: options.enabled,
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
