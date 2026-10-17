import { cn } from "@/lib/utils";
import type { LiveStatus } from "@/lib/use-live-query";

const statusLabel: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  denied: "Refused",
  failed: "Stopped",
};

// LiveStatusBadge says where a Live query is: a green dot while live, an
// amber one otherwise.
export function LiveStatusBadge({ status }: { status: LiveStatus }) {
  return (
    <span role="status" className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={
          status === "live" ? "size-2 rounded-full bg-emerald-600" : "size-2 rounded-full bg-amber-500"
        }
      />
      {statusLabel[status]}
    </span>
  );
}

type LiveSwitchProps = {
  on: boolean;
  onChange: (on: boolean) => void;
  // Where its Live query is while on, when it streams.
  status?: LiveStatus | null;
};

// LiveSwitch turns a view's live updates on and off. Off, the view holds
// still on what it last showed, marked Paused, until switched back on.
export function LiveSwitch({ on, onChange, status }: LiveSwitchProps) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Live updates"
        onClick={() => onChange(!on)}
        className={cn(
          "focus-visible:ring-ring/50 relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px]",
          on ? "bg-emerald-600" : "bg-input",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "bg-background size-3 rounded-full shadow transition-transform",
            on ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </button>
      {on ? (
        status && <LiveStatusBadge status={status} />
      ) : (
        <span role="status" className="text-muted-foreground">
          Paused
        </span>
      )}
    </span>
  );
}
