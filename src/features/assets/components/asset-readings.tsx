import { measurementSeries } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Loading, PermissionDenied, QueryView } from "@/components/states";
import { LiveStatusBadge } from "@/components/live-status";
import { useLiveQuery } from "@/lib/use-live-query";
import { useWithUnitPreference } from "@/lib/use-unit-preferences";

// assetReadingsQuery is the Live query for an Asset's last hour of
// Measurements. Names are quoted with Go escapes, as Queries expect.
export function assetReadingsQuery(assetName: string): string {
  return `measurements | where asset == ${JSON.stringify(assetName)} | range last 1h`;
}

// AssetReadings charts an Asset's Measurements of the last hour, one line
// per Device and Metric, growing as Readings arrive.
// The Query is the app's, so it takes the user's Unit preference; it
// waits for the preferences so it opens once.
export function AssetReadings({ assetName }: { assetName: string }) {
  const unitPreference = useWithUnitPreference();
  if (!unitPreference.ready) return <Loading what="Readings" />;
  const text = unitPreference.apply(assetReadingsQuery(assetName));
  return <AssetReadingsChart assetName={assetName} text={text} />;
}

function AssetReadingsChart({ assetName, text }: { assetName: string; text: string }) {
  const live = useLiveQuery(text);
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
          <LiveStatusBadge status={live.status} />
          <TimeSeriesChart
            series={measurementSeries(answer.readings)}
            label={`${assetName}, last hour`}
          />
        </div>
      )}
    </QueryView>
  );
}
