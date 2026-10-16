import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { palette } from "@/components/charts/palette";
import type { TimeSeries } from "@/components/charts/time-series";
import { useTheme } from "@/lib/theme";
import { unitLabel, withUnit } from "@/lib/units";

// TimeSeriesChart draws TimeSeries as lines over time, on one value axis,
// with a crosshair whose readout lists every series at the pointer, and a
// table view of the latest values. It wraps uPlot; nothing outside this
// file knows that, so the library can be swapped.
//
// Appending is cheap: pass new `series` arrays as points arrive and the
// chart only re-sets its data. It rebuilds only when the set of series
// ids or the theme changes. Colours follow series ids in the order they
// first appear (the reference categorical palette, 8 slots, never
// cycled: series past the eighth draw in the muted ink).

type TimeSeriesChartProps = {
  series: TimeSeries[];
  // Names the figure for assistive tech, as in "Temperature, last 15 min".
  label: string;
  height?: number;
};

export function TimeSeriesChart({ series, label, height = 280 }: TimeSeriesChartProps) {
  const { resolved: theme } = useTheme();
  const target = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<uPlot | null>(null);
  const shape = useShape(series);
  const data = useMemo(() => aligned(series), [series]);

  // Build the chart when its series' shape or the theme changes.
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const made = new uPlot(options(shape, theme, element.clientWidth, height), undefined, element);
    setPlot(made);
    const resize = new ResizeObserver(() => made.setSize({ width: element.clientWidth, height }));
    resize.observe(element);
    return () => {
      resize.disconnect();
      made.destroy();
    };
  }, [shape, theme, height]);

  // Hand new points to the chart without rebuilding it.
  useEffect(() => {
    plot?.setData(data);
  }, [plot, data]);

  return (
    <figure aria-label={label} className="ridr-chart flex flex-col gap-2">
      <div ref={target} className="w-full" />
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">Show as table</summary>
        <LatestTable series={series} />
      </details>
    </figure>
  );
}

// A series as the chart draws it, without its points.
type Shape = Pick<TimeSeries, "id" | "label" | "unit">[];

// useShape returns series without their points, keeping the same array
// until an id, label or unit changes, so new points don't rebuild.
function useShape(series: TimeSeries[]): Shape {
  const next = series.map(({ id, label, unit }) => ({ id, label, unit }));
  const [shape, setShape] = useState(next);
  const same =
    shape.length === next.length &&
    shape.every((one, i) => one.id === next[i].id && one.label === next[i].label && one.unit === next[i].unit);
  if (!same) {
    setShape(next);
    return next;
  }
  return shape;
}

function LatestTable({ series }: { series: TimeSeries[] }) {
  return (
    <table className="mt-2 w-full text-left tabular-nums">
      <thead className="text-muted-foreground">
        <tr>
          <th className="font-normal">Series</th>
          <th className="font-normal">Latest</th>
          <th className="font-normal">At</th>
          <th className="font-normal">Points</th>
        </tr>
      </thead>
      <tbody>
        {series.map((one) => {
          const last = one.points.at(-1);
          return (
            <tr key={one.id}>
              <td>{one.label}</td>
              <td>{last ? withUnit(last.value, one.unit) : "–"}</td>
              <td>{last ? new Date(last.time).toLocaleTimeString() : "–"}</td>
              <td>{one.points.length}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const chrome = {
  light: { axis: "#898781", grid: "#e1e0d9", baseline: "#c3c2b7" },
  dark: { axis: "#898781", grid: "#2c2c2a", baseline: "#383835" },
};

function options(series: Shape, theme: "light" | "dark", width: number, height: number): uPlot.Options {
  const ink = chrome[theme];
  const axis: uPlot.Axis = {
    stroke: ink.axis,
    grid: { stroke: ink.grid, width: 1 },
    ticks: { stroke: ink.baseline, width: 1, size: 4 },
    font: "12px Geist Variable, system-ui, sans-serif",
  };
  const units = new Set(series.map((one) => one.unit));
  const sharedUnit = units.size === 1 ? [...units][0] : "";
  return {
    width,
    height,
    ms: 1,
    cursor: { y: false, points: { size: 8, width: 2 } },
    legend: { live: true },
    scales: { x: { time: true } },
    axes: [
      axis,
      { ...axis, size: 56, values: (_, ticks) => ticks.map((tick) => compact(tick) + (sharedUnit ? ` ${unitLabel(sharedUnit)}` : "")) },
    ],
    series: [
      { label: "Time", value: (_, time) => (time == null ? "–" : new Date(time).toLocaleTimeString()) },
      ...series.map((one, index) => ({
        label: one.label,
        stroke: palette[theme][index] ?? ink.axis,
        width: 2,
        spanGaps: true,
        points: { show: false },
        value: (_: uPlot, value: number | null) => (value == null ? "–" : withUnit(value, one.unit)),
      })),
    ],
  };
}

// aligned turns series into uPlot's columns: every series' times merged,
// and each series' value at each time (null where it has none).
function aligned(series: TimeSeries[]): uPlot.AlignedData {
  if (series.length === 1) {
    const points = series[0].points;
    return [points.map((point) => point.time), points.map((point) => point.value)];
  }
  const times = [...new Set(series.flatMap((one) => one.points.map((point) => point.time)))].toSorted(
    (a, b) => a - b,
  );
  const column = new Map(times.map((time, index) => [time, index]));
  const values = series.map((one) => {
    const ys = Array.from<number | null>({ length: times.length }).fill(null);
    for (const point of one.points) ys[column.get(point.time)!] = point.value;
    return ys;
  });
  return [times, ...values];
}

const compactFormat = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

function compact(value: number): string {
  return compactFormat.format(value);
}
