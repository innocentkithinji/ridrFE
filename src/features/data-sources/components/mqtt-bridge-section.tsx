import { ConnectorService, type MqttBridge } from "@ridr/web";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataCredit } from "@/components/data-credit";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useDeleteMqttBridge } from "@/features/data-sources/api/delete-mqtt-bridge";
import { useIsMqttBridge, useMqttBridge } from "@/features/data-sources/api/get-mqtt-bridges";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { BridgeStatus } from "@/features/data-sources/components/bridge-status";
import { EditMqttBridgeForm } from "@/features/data-sources/components/edit-mqtt-bridge-form";
import { Section } from "@/features/data-sources/components/section";
import { dataSourcesPath } from "@/features/data-sources/paths";
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

function BridgeDetails({ adapterId, retired }: { adapterId: string; retired: boolean }) {
  const bridge = useMqttBridge(adapterId);
  const canUpdate = useCan(ConnectorService.method.updateMqttBridge) && !retired;
  const canDelete = useCan(ConnectorService.method.deleteMqttBridge) && !retired;
  const [editing, setEditing] = useState(false);
  return (
    <QueryView query={bridge} what="the bridge" isEmpty={(data) => !data.bridge} empty="Not a bridge.">
      {(data) =>
        data.bridge && (
          <div className="space-y-4">
            <BridgeSettings bridge={data.bridge} />
            {editing ? (
              <EditMqttBridgeForm bridge={data.bridge} onDone={() => setEditing(false)} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {canUpdate && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {canDelete && <DeleteBridge bridge={data.bridge} />}
              </div>
            )}
          </div>
        )
      }
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

// DeleteBridge stops the bridge, forgets its settings and retires its
// Adapter, after asking; then it's back to every data source.
function DeleteBridge({ bridge }: { bridge: MqttBridge }) {
  const remove = useDeleteMqttBridge();
  const navigate = useNavigate();
  const name = bridge.adapter?.name ?? "this bridge";
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="destructive">
          Delete bridge
        </Button>
      }
      title={`Delete ${name}?`}
      confirm="Delete"
      onConfirm={async () => {
        await remove.mutateAsync({ adapterId: bridge.adapter?.id ?? "" });
        await navigate(dataSourcesPath);
      }}
    >
      Ridr stops subscribing, forgets the broker settings and password, and retires the bridge's
      Adapter. Its Readings stay queryable. This can't be undone.
    </ConfirmDialog>
  );
}
