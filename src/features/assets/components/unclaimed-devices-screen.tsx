import { ConnectError } from "@connectrpc/connect";
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import { RegistryService, type Device } from "@ridr/web";
import { useState } from "react";
import { HealthBadge } from "@/components/device-health";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAdapterNames } from "@/lib/api/adapters";
import { useLatestReading } from "@/features/assets/api/get-latest-reading";
import { useUnclaimedDevices } from "@/lib/api/registry";
import { ClaimDeviceSheet } from "@/features/assets/components/claim-device";
import { useCan } from "@/lib/me";
import { messageFor } from "@/lib/errors";

// UnclaimedDevicesScreen is /devices/unclaimed: Devices that sent a
// Reading but report for no Asset, oldest first, for editors to claim.
export function UnclaimedDevicesScreen() {
  const devices = useUnclaimedDevices();
  const adapterNames = useAdapterNames();
  const canAssign = useCan(RegistryService.method.assignDevice);
  // The Device stays set while the panel closes, so its title holds.
  const [claiming, setClaiming] = useState<{ deviceId?: string; open: boolean }>({ open: false });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unclaimed devices</h1>
        <p className="text-muted-foreground text-sm">
          Devices that sent a Reading but report for no Asset yet.
        </p>
      </div>
      <QueryView
        query={devices}
        what="Unclaimed devices"
        isEmpty={(data) => data.devices.length === 0}
        empty="Every Device is assigned."
      >
        {(data) => (
          <ul aria-label="Unclaimed devices" className="divide-y rounded-lg border">
            {data.devices.map((device) => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                adapterName={adapterNames.get(device.adapterId)}
                onClaim={
                  canAssign
                    ? () => setClaiming({ deviceId: device.deviceId, open: true })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </QueryView>
      {claiming.deviceId && (
        <ClaimDeviceSheet
          deviceId={claiming.deviceId}
          open={claiming.open}
          onOpenChange={(open) => setClaiming({ ...claiming, open })}
        />
      )}
    </section>
  );
}

type DeviceRowProps = { device: Device; adapterName?: string; onClaim?: () => void };

function DeviceRow({ device, adapterName, onClaim }: DeviceRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm">
      <div className="min-w-48 space-y-0.5">
        <p className="font-mono font-medium">{device.deviceId}</p>
        {adapterName && <p className="text-muted-foreground text-xs">{adapterName}</p>}
      </div>
      <HealthBadge health={device.health} />
      <dl className="text-muted-foreground grid grid-cols-[auto_auto] gap-x-2 text-xs">
        <dt>First seen</dt>
        <dd>{timeText(device.firstSeen)}</dd>
        <dt>Last seen</dt>
        <dd>{timeText(device.lastSeen)}</dd>
      </dl>
      <LatestReading deviceId={device.deviceId} />
      {onClaim && (
        <Button
          size="sm"
          className="ml-auto"
          aria-label={`Claim ${device.deviceId}`}
          onClick={onClaim}
        >
          Claim
        </Button>
      )}
    </li>
  );
}

function timeText(ts: Timestamp | undefined): string {
  return ts ? timestampDate(ts).toLocaleString() : "–";
}

const valueFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

// LatestReading shows a Device's newest Measurement, to help recognise it.
function LatestReading({ deviceId }: { deviceId: string }) {
  const latest = useLatestReading(deviceId);
  if (latest.isPending) {
    return <span className="text-muted-foreground">Loading latest Reading…</span>;
  }
  if (latest.error) {
    return (
      <span className="text-muted-foreground">{messageFor(ConnectError.from(latest.error))}</span>
    );
  }
  const reading = latest.data.reading;
  if (reading?.kind.case !== "measurement") {
    return <span className="text-muted-foreground">No Measurements yet.</span>;
  }
  const { metric, value, unit } = reading.kind.value;
  return (
    <span>
      <span className="font-mono">
        {metric} {valueFormat.format(value)} {unit}
      </span>
      <span className="text-muted-foreground"> at {timeText(reading.deviceTime)}</span>
    </span>
  );
}
