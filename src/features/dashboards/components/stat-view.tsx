import type { RunQueryResponse } from "@ridr/web";
import { palette } from "@/components/charts/palette";
import { measurementSeries, rollupSeries, type TimeSeries } from "@/components/charts/time-series";
import { useTheme } from "@/lib/theme";
import { unitLabel } from "@/lib/units";

// StatView draws a Widget's answer as stat tiles: each series' latest
// value (a rollup's last bucket, or the newest Measurement), large, with
// its Unit, and a sparkline of the values before it. Up to four series
// show side by side; more are counted, since a stat is a headline, not a
// comparison (use a line or table for that).

const shownSeries = 4;

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function StatView({ answer, label }: { answer: RunQueryResponse; label: string }) {
  const rollup = answer.rows.length > 0;
  const series = (rollup ? rollupSeries(answer.rows) : measurementSeries(answer.readings)).filter(
    (one) => one.points.length > 0,
  );
  if (series.length === 0) {
    return <p className="text-muted-foreground text-sm">No Measurements to show as a stat.</p>;
  }
  const shown = series.slice(0, shownSeries);
  return (
    <figure aria-label={label} className="flex h-full flex-col gap-2">
      <div className="grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-4">
        {shown.map((one) => (
          <StatTile key={one.id} series={one} named={series.length > 1} rollup={rollup} />
        ))}
      </div>
      {series.length > shownSeries && (
        <figcaption className="text-muted-foreground text-xs">
          and {series.length - shownSeries} more; a table shows them all.
        </figcaption>
      )}
    </figure>
  );
}

type StatTileProps = { series: TimeSeries; named: boolean; rollup: boolean };

function StatTile({ series, named, rollup }: StatTileProps) {
  const latest = series.points.at(-1)!;
  const unit = series.unit ? unitLabel(series.unit) : "";
  const value = Math.abs(latest.value) >= 10_000 ? compact.format(latest.value) : plain.format(latest.value);
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1">
      {named && <p className="text-muted-foreground truncate text-xs">{series.label}</p>}
      <p className="text-3xl leading-none font-semibold">
        {value}
        {unit && <span className="text-muted-foreground ml-1 text-base font-normal">{unit}</span>}
      </p>
      <Sparkline series={series} />
      <p className="text-muted-foreground text-xs">
        {/* A rollup's time is where its bucket starts, not when it was read. */}
        {rollup ? `${named ? "" : `${series.label} `}from ${timeFormat.format(latest.time)}` : `as of ${timeFormat.format(latest.time)}`}
      </p>
    </div>
  );
}

// Sparkline is the trend before the latest value: a thin line in the
// muted ink, the latest point marked in the first series colour. Nothing
// when there is only one value.
function Sparkline({ series }: { series: TimeSeries }) {
  const { resolved } = useTheme();
  const points = series.points.slice(-24);
  if (points.length < 2) return null;
  const width = 120;
  const height = 28;
  const times = points.map((p) => p.time);
  const values = points.map((p) => p.value);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const [v0, v1] = [Math.min(...values), Math.max(...values)];
  const x = (t: number) => (t1 === t0 ? width : ((t - t0) / (t1 - t0)) * (width - 4) + 2);
  const y = (v: number) => (v1 === v0 ? height / 2 : height - 3 - ((v - v0) / (v1 - v0)) * (height - 6));
  const last = points.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full max-w-32" aria-hidden preserveAspectRatio="none">
      <polyline
        points={points.map((p) => `${x(p.time)},${y(p.value)}`).join(" ")}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <circle cx={x(last.time)} cy={y(last.value)} r={2.5} fill={palette[resolved][0]} />
    </svg>
  );
}
