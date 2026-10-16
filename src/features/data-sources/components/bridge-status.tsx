import { MqttBridgeState, type MqttBridgeStatus } from "@ridr/web";
import { Badge } from "@/components/ui/badge";
import { When } from "@/features/data-sources/components/format";

const labels: Record<MqttBridgeState, string> = {
  [MqttBridgeState.UNSPECIFIED]: "Unknown",
  [MqttBridgeState.CONNECTING]: "Connecting",
  [MqttBridgeState.CONNECTED]: "Connected",
  [MqttBridgeState.DISCONNECTED]: "Disconnected",
};

// BridgeStateBadge names a bridge's connection state.
export function BridgeStateBadge({ status }: { status?: MqttBridgeStatus }) {
  const state = status?.state ?? MqttBridgeState.UNSPECIFIED;
  const variant =
    state === MqttBridgeState.CONNECTED
      ? "default"
      : state === MqttBridgeState.DISCONNECTED
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{labels[state]}</Badge>;
}

// BridgeStatus says whether a bridge is connected, since when, and why
// not. A disconnected bridge keeps retrying on its own.
export function BridgeStatus({ status }: { status?: MqttBridgeStatus }) {
  const disconnected = status?.state === MqttBridgeState.DISCONNECTED;
  return (
    <div role="status" className="space-y-1 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <BridgeStateBadge status={status} />
        {status?.changedAt && (
          <span className="text-muted-foreground">
            since <When at={status.changedAt} />
          </span>
        )}
        {disconnected && <span className="text-muted-foreground">· retrying</span>}
      </p>
      {status?.lastError && (
        <p className="text-muted-foreground break-words">
          Last error: <span className="font-mono text-xs">{status.lastError}</span>
        </p>
      )}
    </div>
  );
}
