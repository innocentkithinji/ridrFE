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
