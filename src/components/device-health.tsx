import { DeviceHealth } from "@ridr/web";

export const healthLabel: Record<DeviceHealth, string> = {
  [DeviceHealth.UNSPECIFIED]: "Unknown",
  [DeviceHealth.LIVE]: "Live",
  [DeviceHealth.SILENT]: "Silent",
  [DeviceHealth.NEVER_SEEN]: "Never seen",
};

// HealthBadge says whether a Device is live, silent or never seen: a
// green dot when live, an amber one otherwise.
export function HealthBadge({ health }: { health: DeviceHealth }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={
          health === DeviceHealth.LIVE
            ? "size-2 rounded-full bg-emerald-600"
            : "size-2 rounded-full bg-amber-500"
        }
      />
      <span>{healthLabel[health]}</span>
    </span>
  );
}
