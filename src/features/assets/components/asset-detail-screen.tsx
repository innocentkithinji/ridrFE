import { Code, ConnectError } from "@connectrpc/connect";
import { AlertService, RegistryService, type Asset, type Assignment } from "@ridr/web";
import { useState, type ReactNode } from "react";
import { ErrorState, Loading, NotFound } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsset } from "@/features/assets/api/get-asset";
import { AssignDeviceDialog } from "@/features/assets/components/assign-device-dialog";
import { UnassignDeviceDialog } from "@/features/assets/components/unassign-device-dialog";
import { AssetAlerts } from "@/features/assets/components/asset-alerts";
import { AssetReadings } from "@/features/assets/components/asset-readings";
import { AssignmentHistory } from "@/features/assets/components/assignment-history";
import { CurrentDevices } from "@/features/assets/components/current-devices";
import { AttributeList } from "@/features/assets/components/attribute-list";
import { Can, useCan } from "@/lib/me";

// AssetDetailScreen is /assets/:assetId: one Asset's Attributes, its
// current Devices, live Readings, Alerts and Assignment history.
export function AssetDetailScreen({ assetId }: { assetId: string }) {
  const query = useAsset(assetId);
  if (query.isPending) {
    return <Loading what="the Asset" />;
  }
  if (query.error) {
    return isMissing(query.error) ? (
      <NotFound what="Asset" message="This Asset doesn't exist, or isn't yours to see." />
    ) : (
      <ErrorState error={query.error} />
    );
  }
  const { asset, assignments } = query.data;
  if (!asset) {
    return <NotFound what="Asset" message="This Asset doesn't exist, or isn't yours to see." />;
  }
  return <AssetDetail asset={asset} assignments={assignments} />;
}

// A malformed ID can't name an Asset either, so it reads as not found.
function isMissing(error: ConnectError): boolean {
  return error.code === Code.NotFound || error.code === Code.InvalidArgument;
}

type AssetDetailProps = { asset: Asset; assignments: Assignment[] };

function AssetDetail({ asset, assignments }: AssetDetailProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
        <AttributeList attributes={asset.attributes} />
      </header>
      <DevicesPanel asset={asset} assignments={assignments} />
      <Panel title="Readings">
        <AssetReadings assetName={asset.name} />
      </Panel>
      <Can method={AlertService.method.listAlerts}>
        <Panel title="Alerts">
          <AssetAlerts assetId={asset.id} />
        </Panel>
      </Can>
      <Panel title="Assignment history">
        <AssignmentHistory assignments={assignments} />
      </Panel>
    </section>
  );
}

// DevicesPanel shows the Asset's current Devices, with Assign and
// Unassign for editors.
function DevicesPanel({ asset, assignments }: AssetDetailProps) {
  const canAssign = useCan(RegistryService.method.assignDevice);
  const canUnassign = useCan(RegistryService.method.unassignDevice);
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState<{ deviceId: string; open: boolean }>({
    deviceId: "",
    open: false,
  });
  const hasCurrent = assignments.some((assignment) => !assignment.endsAt);
  const assignButton = canAssign && (
    <Button size="sm" variant={hasCurrent ? "outline" : "default"} onClick={() => setAssigning(true)}>
      Assign
    </Button>
  );
  return (
    <Panel title="Devices" action={hasCurrent && assignButton}>
      <CurrentDevices
        assignments={assignments}
        assign={assignButton}
        onUnassign={
          canUnassign ? (deviceId) => setUnassigning({ deviceId, open: true }) : undefined
        }
      />
      {canAssign && (
        <AssignDeviceDialog
          open={assigning}
          onOpenChange={setAssigning}
          asset={{ id: asset.id, name: asset.name }}
        />
      )}
      {canUnassign && (
        <UnassignDeviceDialog
          deviceId={unassigning.deviceId}
          open={unassigning.open}
          onOpenChange={(open) => setUnassigning({ ...unassigning, open })}
        />
      )}
    </Panel>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
