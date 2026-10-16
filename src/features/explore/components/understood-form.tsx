import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Query } from "@ridr/web";
import { unitLabel } from "@/lib/units";

// UnderstoodForm shows how Ridr understood a Query (ExplainQuery's JSON
// form), so the user sees what a typo changed: source, filters, range,
// rollup, unit and limit.
export function UnderstoodForm({ query }: { query: Query }) {
  const range = query.range;
  const rangeText = !range
    ? "last 1h"
    : range.last
      ? `last ${range.last}`
      : `${range.from ? timestampDate(range.from).toLocaleString() : "?"} to ${range.to ? timestampDate(range.to).toLocaleString() : "?"}`;
  const items: [string, string][] = [
    ["Source", query.source],
    [
      "Filters",
      query.filters.length === 0
        ? "none"
        : query.filters
            .map((filter) =>
              filter.values.length === 1
                ? `${filter.field} is ${filter.values[0]}`
                : `${filter.field} is one of ${filter.values.join(", ")}`,
            )
            .join("; "),
    ],
    ["Range", rangeText],
    [
      "Rollup",
      query.rollup
        ? `${query.rollup.functions.join(", ")} every ${query.rollup.every}` +
          (query.rollup.by.length ? ` by ${query.rollup.by.join(", ")}` : "")
        : "none",
    ],
    ["Unit", query.unit ? unitLabel(query.unit) : "as reported"],
    ["Limit", query.limit ? String(query.limit) : "none"],
  ];
  return (
    <section aria-labelledby="understood-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="understood-heading" className="font-medium">
        How Ridr read it
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {items.map(([term, detail]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words">{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
