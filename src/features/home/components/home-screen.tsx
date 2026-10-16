import { AlertService, ConnectorService, QueryService, RegistryService } from "@ridr/web";
import type { ReactNode } from "react";
import { DataCredit } from "@/components/data-credit";
import { useMqttBridges } from "@/features/home/api/get-mqtt-bridges";
import { DeviceHealthPanel } from "@/features/home/components/device-health-panel";
import { FleetMap } from "@/features/home/components/fleet-map";
import { useCan, useIsScoped } from "@/lib/me";

type HomeScreenProps = {
  // The open Alerts panel; the route mounts it from the Alerts feature.
  alerts?: ReactNode;
  // Where to set up a data source, for users who may.
  setUpPath?: string;
};

// HomeScreen is `/`: where the fleet is, which Alerts are open and which
// Devices have gone quiet. Each panel gates and loads on its own, so a
// user missing one Permission still gets the others.
export function HomeScreen({ alerts, setUpPath }: HomeScreenProps) {
  const canMap = useCan(QueryService.method.runQuery);
  const canAlerts = useCan(AlertService.method.listAlerts);
  const canHealth = [
    useCan(QueryService.method.runQuery),
    useCan(RegistryService.method.getDeviceHealth),
    useCan(RegistryService.method.listUnclaimedDevices),
    useCan(RegistryService.method.listAssets),
    useCan(RegistryService.method.getAsset),
  ].every(Boolean);
  const canCredit = useCan(ConnectorService.method.listMqttBridges);
  return (
    <div className="space-y-6">
      <h1 className="sr-only">Home</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {canMap && (
            <div className="space-y-1">
              <FleetMap />
              <ScopeNote />
            </div>
          )}
          {canHealth && (
            <div className="space-y-1">
              <DeviceHealthPanel setUpPath={setUpPath} />
              <ScopeNote />
            </div>
          )}
        </div>
        {canAlerts && (
          <div className="space-y-1">
            {alerts}
            <ScopeNote />
          </div>
        )}
      </div>
      {canCredit && <Credit />}
    </div>
  );
}

// The open data's licences require its credit wherever it is shown.
function Credit() {
  const bridges = useMqttBridges();
  return <DataCredit bridges={bridges.data?.bridges ?? []} />;
}

// ScopeNote tells a scoped user why some Assets may be missing.
function ScopeNote() {
  if (!useIsScoped()) return null;
  return <p className="text-muted-foreground text-sm">You see Assets in your Scope only.</p>;
}
