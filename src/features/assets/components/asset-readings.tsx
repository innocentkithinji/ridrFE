import { measurementSeries } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { PermissionDenied, QueryView } from "@/components/states";
import { useLiveQuery, type LiveStatus } from "@/lib/use-live-query";

// assetReadingsQuery is the Live query for an Asset's last hour of
// Measurements. Names are quoted with Go escapes, as Queries expect.
export function assetReadingsQuery(assetName: string): string {
  return `measurements | where asset == ${JSON.stringify(assetName)} | range last 1h`;
}

// AssetReadings charts an Asset's Measurements of the last hour, one line
// per Device and Metric, growing as Readings arrive.
export function AssetReadings({ assetName }: { assetName: string }) {
  const live = useLiveQuery(assetReadingsQuery(assetName));
  if (live.status === "denied") {
    return <PermissionDenied what="this Asset's Readings" />;
  }
  return (
    <QueryView
      query={live.query}
      what="Readings"
      empty="No Measurements in the last hour."
      isEmpty={(answer) => measurementSeries(answer.readings).length === 0}
    >
      {(answer) => (
        <div className="flex flex-col gap-2">
          <LiveBadge status={live.status} />
          <TimeSeriesChart
            series={measurementSeries(answer.readings)}
            label={`${assetName}, last hour`}
          />
        </div>
      )}
    </QueryView>
  );
}

const statusLabel: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  denied: "Refused",
  failed: "Stopped",
};

function LiveBadge({ status }: { status: LiveStatus }) {
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
