import type { Query } from "@ridr/web";

// How Explore keeps a Query's answer current, from how Ridr understood it:
//   still    its range ends in the past: run once
//   stream   no rollup, range ends now: a Live query appends new Readings
//   refresh  a rollup, range ends now: rerun every bucket width
export type RefreshPlan =
  | { kind: "still" }
  | { kind: "stream" }
  | { kind: "refresh"; everyMs: number };

// A rollup over `every all` has one bucket for the whole range; rerun it
// each minute rather than once per range.
const allBucketRefreshMs = 60_000;
// Never rerun faster than this, however narrow the buckets.
const minRefreshMs = 5_000;

export function refreshPlan(query: Query | undefined): RefreshPlan {
  // An unset range means `last 1h`, which ends now.
  const endsNow = !query?.range || query.range.last !== "";
  if (!query || !endsNow) return { kind: "still" };
  if (!query.rollup) return { kind: "stream" };
  const every = durationMs(query.rollup.every) ?? allBucketRefreshMs;
  return { kind: "refresh", everyMs: Math.max(every, minRefreshMs) };
}

const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// durationMs reads a query-language duration such as "15m"; null for
// anything else, such as "all".
export function durationMs(duration: string): number | null {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return null;
  return Number(match[1]) * unitMs[match[2] as keyof typeof unitMs];
}
