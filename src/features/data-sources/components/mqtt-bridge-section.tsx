import { ConnectorService, type MqttBridge } from "@ridr/web";
import { DataCredit } from "@/components/data-credit";
import { QueryView } from "@/components/states";
import { useIsMqttBridge, useMqttBridge } from "@/features/data-sources/api/get-mqtt-bridges";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { BridgeStatus } from "@/features/data-sources/components/bridge-status";
import { Section } from "@/features/data-sources/components/section";
import { useCan } from "@/lib/me";

// MqttBridgeSection shows, on an MQTT bridge's Adapter page, whether it
// is connected and what it subscribes to. Other Adapters don't show it.
export function MqttBridgeSection({ adapter, retired }: AdapterSectionProps) {
  const canList = useCan(ConnectorService.method.listMqttBridges);
  const canGet = useCan(ConnectorService.method.getMqttBridge);
  const canRead = canList && canGet;
  const isBridge = useIsMqttBridge(adapter.id, canRead);
  if (!canRead || !isBridge) return null;
  return (
    <Section title="MQTT bridge">
      <BridgeDetails adapterId={adapter.id} retired={retired} />
    </Section>
  );
}

function BridgeDetails({ adapterId }: { adapterId: string; retired: boolean }) {
  const bridge = useMqttBridge(adapterId);
  return (
    <QueryView query={bridge} what="the bridge" isEmpty={(data) => !data.bridge} empty="Not a bridge.">
      {(data) => data.bridge && <BridgeSettings bridge={data.bridge} />}
    </QueryView>
  );
}

function BridgeSettings({ bridge }: { bridge: MqttBridge }) {
  return (
    <div className="space-y-4">
      <BridgeStatus status={bridge.status} />
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted-foreground">Broker URL</dt>
        <dd className="font-mono text-xs break-all">{bridge.brokerUrl}</dd>
        <dt className="text-muted-foreground">Username</dt>
        <dd>{bridge.username || "None"}</dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd>{bridge.hasPassword ? "Password set" : "No password"}</dd>
        <dt className="text-muted-foreground">Topic filter</dt>
        <dd className="font-mono text-xs break-all">{bridge.topicFilter}</dd>
      </dl>
      <DataCredit bridges={[bridge]} />
    </div>
  );
}
