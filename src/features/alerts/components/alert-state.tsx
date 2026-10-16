import { AlertState } from "@ridr/web";
import { cn } from "@/lib/utils";

const labels: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "Unknown",
  [AlertState.FIRING]: "Firing",
  [AlertState.ACKNOWLEDGED]: "Acknowledged",
  [AlertState.RESOLVED]: "Resolved",
};

const tones: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "bg-muted text-muted-foreground",
  [AlertState.FIRING]: "bg-destructive/10 text-destructive",
  [AlertState.ACKNOWLEDGED]: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  [AlertState.RESOLVED]: "bg-muted text-muted-foreground",
};

// AlertStateBadge names where an Alert is in its life.
export function AlertStateBadge({ state }: { state: AlertState }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", tones[state])}>
      {labels[state]}
    </span>
  );
}
