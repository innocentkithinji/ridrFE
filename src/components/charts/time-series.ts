import { timestampMs } from "@bufbuild/protobuf/wkt";
import type { Reading, RollupRow } from "@ridr/web";

// TimeSeries is one line on a TimeSeriesChart: a Metric of one Device in
// one Unit, its points oldest first. The chart knows nothing of Readings
// or Queries, so anything with times and values can feed it.
export type TimeSeries = {
  // Stable across updates: the chart keeps a series' colour by its id.
  id: string;
  // What the legend and table call it, as in "fridge-1 · temperature".
  label: string;
  // The Unit code its values are in; "" for unitless.
  unit: string;
  points: TimePoint[];
};

// TimePoint is one value at a time, in milliseconds since the epoch.
export type TimePoint = { time: number; value: number };

// measurementSeries splits a Query's Readings into one TimeSeries per
// Device, Metric and Unit, in the order each first appears. Locations and
// Events are skipped. Readings are placed at their device time, as
// Queries place them.
export function measurementSeries(readings: readonly Reading[]): TimeSeries[] {
  const byId = new Map<string, TimeSeries>();
  for (const reading of readings) {
    if (reading.kind.case !== "measurement" || !reading.deviceTime) continue;
    const { metric, value, unit } = reading.kind.value;
    const id = `${reading.deviceId}\u0000${metric}\u0000${unit}`;
    let series = byId.get(id);
    if (!series) {
      series = { id, label: `${reading.deviceId} · ${metric}`, unit, points: [] };
      byId.set(id, series);
    }
    series.points.push({ time: timestampMs(reading.deviceTime), value });
  }
  return [...byId.values()];
}

// rollupSeries splits a rollup's rows into one TimeSeries per group,
// function and Unit, each point at its bucket's start. Rows never mix
// Units, so a Metric reported in Units that can't convert makes two.
export function rollupSeries(rows: readonly RollupRow[]): TimeSeries[] {
  const byId = new Map<string, TimeSeries>();
  for (const row of rows) {
    if (!row.bucketStart) continue;
    const group = groupOf(row);
    for (const [fn, value] of Object.entries(row.values)) {
      const id = `${group}\u0000${fn}\u0000${row.unit}`;
      let series = byId.get(id);
      if (!series) {
        series = { id, label: group ? `${group} · ${fn}` : fn, unit: row.unit, points: [] };
        byId.set(id, series);
      }
      series.points.push({ time: timestampMs(row.bucketStart), value });
    }
  }
  return [...byId.values()];
}

// groupOf names a rollup row's group by its grouped fields, as in
// "Demo medicine fridge 1 · temperature"; "" when the rollup has no `by`.
export function groupOf(row: RollupRow): string {
  return [row.asset, row.deviceId, row.metric, ...pairs(row.attributes), ...pairs(row.tags)]
    .filter(Boolean)
    .join(" · ");
}

// pointCount is how many points all series hold together.
export function pointCount(series: readonly TimeSeries[]): number {
  return series.reduce((total, one) => total + one.points.length, 0);
}

// pairs writes fields as key=value, by key.
function pairs(fields: Record<string, string>): string[] {
  return Object.entries(fields)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
}
