import { Code, ConnectError } from "@connectrpc/connect";
import { DeviceHealth, QueryService, RegistryService, type Assignment } from "@ridr/web";
import { withUnit } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { useDeviceHealth } from "@/features/assets/api/get-device-health";
import { useLatestReading } from "@/features/assets/api/get-latest-reading";
import { shownTime } from "@/features/assets/components/time";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";
import type { ReactNode } from "react";

type CurrentDevicesProps = {
  // The Asset's Assignments; the open ones are its current Devices.
  assignments: Assignment[];
  // What an editor may do to assign one, shown when there are none.
  assign?: ReactNode;
  // Offers Unassign on each Device when given; editors only.
  onUnassign?: (deviceId: string) => void;
};

// CurrentDevices lists the Devices reporting for an Asset now, each with
// its health and latest Reading, refreshed every minute.
export function CurrentDevices({ assignments, assign, onUnassign }: CurrentDevicesProps) {
  const current = assignments.filter((assignment) => !assignment.endsAt);
  if (current.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-3 py-6 text-sm">
        No Devices report for this Asset.
        {assign}
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {current.map((assignment) => (
        <li key={assignment.deviceId} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
          <span className="font-mono font-medium">{assignment.deviceId}</span>
          <Health deviceId={assignment.deviceId} />
          <LatestReading deviceId={assignment.deviceId} />
          {onUnassign && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              aria-label={`Unassign ${assignment.deviceId}`}
              onClick={() => onUnassign(assignment.deviceId)}
            >
              Unassign
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

const healthLabel: Record<DeviceHealth, string> = {
  [DeviceHealth.UNSPECIFIED]: "Unknown",
  [DeviceHealth.LIVE]: "Live",
  [DeviceHealth.SILENT]: "Silent",
  [DeviceHealth.NEVER_SEEN]: "Never seen",
};

function Health({ deviceId }: { deviceId: string }) {
  const allowed = useCan(RegistryService.method.getDeviceHealth);
  const health = useDeviceHealth(deviceId, { enabled: allowed });
  if (!allowed) return null;
  if (health.isPending) return <Muted>Loading health…</Muted>;
  if (health.error) return <Muted>{messageFor(health.error)}</Muted>;
  const live = health.data.health === DeviceHealth.LIVE;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={live ? "size-2 rounded-full bg-emerald-600" : "size-2 rounded-full bg-amber-500"}
      />
      <span>{healthLabel[health.data.health]}</span>
      {health.data.lastSeen && (
        <Muted>last seen {shownTime(health.data.lastSeen)}</Muted>
      )}
    </span>
  );
}

function LatestReading({ deviceId }: { deviceId: string }) {
  const allowed = useCan(QueryService.method.getLatestReading);
  const latest = useLatestReading(deviceId, { enabled: allowed });
  if (!allowed) return null;
  if (latest.isPending) return <Muted>Loading latest Reading…</Muted>;
  if (latest.error) {
    return (
      <Muted>
        {ConnectError.from(latest.error).code === Code.NotFound
          ? "No Measurements yet."
          : messageFor(latest.error)}
      </Muted>
    );
  }
  const reading = latest.data.reading;
  if (reading?.kind.case !== "measurement") return <Muted>No Measurements yet.</Muted>;
  const { metric, value, unit } = reading.kind.value;
  return (
    <span className="text-sm tabular-nums">
      {metric} <span className="font-medium">{withUnit(value, unit)}</span>{" "}
      <Muted>at {shownTime(reading.deviceTime)}</Muted>
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground text-sm">{children}</span>;
}
