import { useSearchParams } from "react-router";
import { measurementSeries, pointCount } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Loading, PermissionDenied, QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveQuery, type LiveStatus } from "@/lib/use-live-query";
import { useWithUnitPreference } from "@/lib/use-unit-preferences";

// A developer route that charts any Measurement Query live: the proving
// ground for useLiveQuery and TimeSeriesChart. Dev server only; a Live
// query needs no Permission, so it has no gate and no nav link.

export const liveQueryDevPath = "/dev/live-query";

const defaultQuery =
  'measurements | where asset == "Demo medicine fridge 1" and metric == temperature | range last 15m';

export function LiveQueryDevRoute() {
  const [params, setParams] = useSearchParams();
  // The default Query is the app's, so it takes the Unit preference;
  // text from the URL was typed and runs as written.
  const unitPreference = useWithUnitPreference();
  const text = params.get("text") || unitPreference.apply(defaultQuery, "temperature");
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Live query</h1>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new FormData(event.currentTarget).get("text");
          setParams({ text: String(next ?? "") });
        }}
      >
        <Input name="text" aria-label="Query" defaultValue={text} key={text} className="font-mono" />
        <Button type="submit">Run</Button>
      </form>
      {unitPreference.ready ? <LiveChart text={text} /> : <Loading what="your Unit preferences" />}
    </div>
  );
}

function LiveChart({ text }: { text: string }) {
  const live = useLiveQuery(text);
  if (live.status === "denied") {
    return <PermissionDenied what="these Readings" />;
  }
  return (
    <QueryView
      query={live.query}
      what="the Live query"
      empty="No Measurements in this range yet."
      isEmpty={(answer) => measurementSeries(answer.readings).length === 0}
    >
      {(answer) => {
        const series = measurementSeries(answer.readings);
        return (
          <section className="flex flex-col gap-2">
            <p className="text-muted-foreground flex items-center gap-3 text-sm">
              <StatusBadge status={live.status} />
              <span data-testid="reading-count">{pointCount(series)} Readings</span>
            </p>
            <TimeSeriesChart series={series} label="Live query chart" />
          </section>
        );
      }}
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

function StatusBadge({ status }: { status: LiveStatus }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={
          status === "live"
            ? "size-2 rounded-full bg-emerald-600"
            : "size-2 rounded-full bg-amber-500"
        }
      />
      {statusLabel[status]}
    </span>
  );
}
