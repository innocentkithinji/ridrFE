import { DeviceHealth, type Device } from "@ridr/web";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { HealthBadge } from "@/components/device-health";
import { ErrorState, Loading } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAssetDevices, type AssetDevice } from "@/features/home/api/get-asset-devices";
import { useAssets } from "@/features/home/api/get-assets";
import { useDeviceHealth } from "@/features/home/api/get-device-health";
import { useReportingDevices } from "@/features/home/api/get-reporting-devices";
import { useUnclaimedDevices } from "@/features/home/api/get-unclaimed-devices";
import { formatTime } from "@/lib/format";
import { messageFor } from "@/lib/errors";
import { useIsScoped } from "@/lib/me";

// Up to this many Assets, Home loads each one's Devices by itself; past it
// the user asks, as each Asset is one GetAsset call.
const autoCheckAssets = 20;

type DeviceHealthPanelProps = {
  // Links "Set up a data source" for users who may add one.
  setUpPath?: string;
};

// DeviceHealthPanel counts the live, silent and Unclaimed devices. No
// procedure lists every Device with its health, so it is assembled: live
// Devices sent a Measurement in the last 15 minutes; known Devices are
// the Assets' open Assignments plus the Unclaimed devices; a known Device
// that isn't live is silent.
export function DeviceHealthPanel({ setUpPath }: DeviceHealthPanelProps) {
  const live = useReportingDevices();
  // No Scope admits a Device with no Asset: a scoped user has none.
  const scoped = useIsScoped();
  const unclaimed = useUnclaimedDevices({ enabled: !scoped });
  const assets = useAssets();
  const [asked, setAsked] = useState(false);
  const assetList = assets.data?.assets ?? [];
  const checking = asked || (assets.data !== undefined && assetList.length <= autoCheckAssets);
  const assigned = useAssetDevices(assetList, checking);

  const liveIds = live.data;
  const unclaimedDevices = scoped ? [] : unclaimed.data?.devices;
  const error = live.error ?? unclaimed.error ?? assets.error;
  let body: ReactNode;
  if (error) {
    body = <ErrorState error={error} />;
  } else if (!liveIds || !unclaimedDevices || assets.isPending) {
    body = <Loading what="Device health" />;
  } else if (liveIds.size === 0 && unclaimedDevices.length === 0 && assetList.length === 0) {
    body = (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No Devices yet.{" "}
        {setUpPath ? (
          <Link to={setUpPath} className="text-foreground underline">
            Set up a data source.
          </Link>
        ) : (
          "Set up a data source."
        )}
      </p>
    );
  } else {
    const silent = checking && assigned.pending === 0
      ? assigned.devices.filter((d) => !liveIds.has(d.deviceId))
      : undefined;
    body = (
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-2">
          <Count label="Live" value={liveIds.size} />
          <Count label="Silent" value={silent?.length} />
          {!scoped && <Count label="Unclaimed" value={unclaimedDevices.length} />}
        </dl>
        {!checking && (
          <Button size="sm" variant="outline" onClick={() => setAsked(true)}>
            Check {assetList.length} Assets for silent Devices
          </Button>
        )}
        {checking && silent === undefined && (
          <p role="status" className="text-muted-foreground text-sm">
            Checking {assigned.pending} of {assetList.length} Assets…
          </p>
        )}
        {silent && silent.length > 0 && <SilentDevices devices={silent} />}
        {unclaimedDevices.length > 0 && <UnclaimedDevices devices={unclaimedDevices} />}
      </div>
    );
  }

  return (
    <section aria-label="Device health" className="space-y-2">
      <h2 className="text-lg font-semibold">Device health</h2>
      {body}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div role="group" aria-label={label} className="rounded-lg border px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value ?? "—"}</dd>
    </div>
  );
}

function SilentDevices({ devices }: { devices: AssetDevice[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">Silent devices</h3>
      <p className="text-muted-foreground text-xs">
        No Measurement in 15 minutes. Point at one to check its other Readings.
      </p>
      <ul aria-label="Silent devices" className="max-h-64 divide-y overflow-auto rounded-lg border text-sm">
        {devices.map((device) => (
          <SilentDevice key={`${device.asset.id}\u0000${device.deviceId}`} device={device} />
        ))}
      </ul>
    </div>
  );
}

// SilentDevice asks GetDeviceHealth, which counts every Reading, once
// pointed at: a Device sending only Locations or Events looks silent to
// the Measurement rollup.
function SilentDevice({ device }: { device: AssetDevice }) {
  const [asked, setAsked] = useState(false);
  const health = useDeviceHealth(device.deviceId, { enabled: asked });
  const ask = () => setAsked(true);
  return (
    <li
      tabIndex={0}
      onMouseEnter={ask}
      onFocus={ask}
      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2"
    >
      <span className="font-mono font-medium">{device.deviceId}</span>
      <Link to={`/assets/${device.asset.id}`} className="text-muted-foreground hover:underline">
        {device.asset.name}
      </Link>
      <span className="ml-auto">
        {!asked ? (
          <HealthBadge health={DeviceHealth.SILENT} />
        ) : health.isPending ? (
          <span className="text-muted-foreground text-xs">Checking…</span>
        ) : health.error ? (
          <span className="text-muted-foreground text-xs">{messageFor(health.error)}</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <HealthBadge health={health.data.health} />
            {health.data.lastSeen && (
              <span className="text-muted-foreground text-xs">
                last seen {formatTime(health.data.lastSeen)}
              </span>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

function UnclaimedDevices({ devices }: { devices: Device[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Unclaimed devices</h3>
        <Link to="/devices/unclaimed" className="text-muted-foreground hover:text-foreground text-sm">
          Claim
        </Link>
      </div>
      <ul aria-label="Unclaimed devices" className="max-h-64 divide-y overflow-auto rounded-lg border text-sm">
        {devices.map((device) => (
          <li key={`${device.adapterId}\u0000${device.deviceId}`} className="flex flex-wrap items-center gap-x-3 px-3 py-2">
            <span className="font-mono font-medium">{device.deviceId}</span>
            <span className="ml-auto inline-flex items-center gap-2">
              <HealthBadge health={device.health} />
              <span className="text-muted-foreground text-xs">last seen {formatTime(device.lastSeen)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
