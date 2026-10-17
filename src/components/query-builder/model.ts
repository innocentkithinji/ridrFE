import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Query } from "@ridr/web";

// What the query builder holds, and how it turns into Query text and back.
// Text is what Widgets save and Explore keeps in its URL, so the builder
// writes text; reading text back goes through ExplainQuery's JSON form
// (Query), never by parsing text here. A Query the builder can't show
// comes back with the reasons, never with parts dropped.

export const sourceNames = ["measurements", "locations", "events"] as const;
export type Source = (typeof sourceNames)[number];

// One `where` condition the builder offers. Attribute and Tag carry a key.
export type ConditionKind = "asset" | "attribute" | "device" | "adapter" | "tag";
export type Condition = { id: number; kind: ConditionKind; key: string; value: string };

export type RangeChoice = { kind: "last"; last: string } | { kind: "between"; from: string; to: string };

export type Summary = { kind: "raw" } | { kind: "rollup"; functions: string[]; every: string; by: string[] };

export type BuiltQuery = {
  source: Source;
  // "" means any Metric. Measurements only.
  metric: string;
  conditions: Condition[];
  range: RangeChoice;
  // Measurements only.
  summary: Summary;
  // A UCUM code, or "" for the viewer's Unit preference. Measurements only.
  unit: string;
  // 0 means no limit.
  limit: number;
};

let nextId = 0;
export function newCondition(kind: ConditionKind = "asset"): Condition {
  nextId += 1;
  return { id: nextId, kind, key: "", value: "" };
}

export const defaultRange: RangeChoice = { kind: "last", last: "1h" };

// startingQuery is an empty Query of a source: the last hour, raw values.
export function startingQuery(source: Source): BuiltQuery {
  return { source, metric: "", conditions: [], range: defaultRange, summary: { kind: "raw" }, unit: "", limit: 0 };
}

// forSource moves a built Query to another source, keeping what applies
// to every source (conditions, range, limit).
export function forSource(built: BuiltQuery, source: Source): BuiltQuery {
  if (built.source === source) return built;
  const measurements = source === "measurements";
  return {
    ...built,
    source,
    metric: measurements ? built.metric : "",
    summary: measurements ? built.summary : { kind: "raw" },
    unit: measurements ? built.unit : "",
  };
}

// fieldOf is the query-language field a condition filters on.
export function fieldOf(condition: Condition): string {
  switch (condition.kind) {
    case "attribute":
      return `asset.${condition.key.trim()}`;
    case "tag":
      return `tag.${condition.key.trim()}`;
    default:
      return condition.kind;
  }
}

// isComplete tells whether a condition has all it needs to be written.
export function isComplete(condition: Condition): boolean {
  const keyed = condition.kind === "attribute" || condition.kind === "tag";
  return condition.value !== "" && (!keyed || /^[A-Za-z0-9_.-]+$/.test(condition.key.trim()));
}

// Words the language reads as itself, so they are quoted as values.
const reserved = new Set([
  "measurements", "locations", "events", "where", "range", "rollup", "unit", "limit",
  "and", "in", "or", "not", "last", "to", "every", "by", "all",
]);

// valueText writes a value bare when it is a plain word, else quoted.
export function valueText(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) && !reserved.has(value) ? value : JSON.stringify(value);
}

// queryText writes a built Query as text, one stage per line. Conditions
// not yet complete are left out until they are.
export function queryText(built: BuiltQuery): string {
  const measurements = built.source === "measurements";
  const conditions = [
    ...(measurements && built.metric ? [`metric == ${valueText(built.metric)}`] : []),
    ...built.conditions.filter(isComplete).map((c) => `${fieldOf(c)} == ${valueText(c.value)}`),
  ];
  const lines: string[] = [built.source];
  if (conditions.length > 0) lines.push(`| where ${conditions.join(" and ")}`);
  lines.push(`| range ${rangeText(built.range)}`);
  if (measurements && built.summary.kind === "rollup" && built.summary.functions.length > 0) {
    const { functions, every, by } = built.summary;
    lines.push(`| rollup ${functions.join(", ")} every ${every}${by.length > 0 ? ` by ${by.join(", ")}` : ""}`);
  }
  if (measurements && built.unit) lines.push(`| unit ${built.unit}`);
  if (built.limit > 0) lines.push(`| limit ${built.limit}`);
  return lines.join("\n");
}

function rangeText(range: RangeChoice): string {
  if (range.kind === "last") return `last ${range.last}`;
  return `${range.from} to ${range.to}`;
}

// rfc3339 writes a time as RFC 3339 in UTC, without zero milliseconds.
export function rfc3339(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}

export type ReadBack = { ok: true; built: BuiltQuery } | { ok: false; reasons: string[] };

type ReadOptions = {
  // The sources the builder may show here (a Widget's Visualization
  // allows one).
  sources: readonly Source[];
  // Whether a Unit can be offered for a Metric: the builder offers only
  // Units of the Metric's Quantity kind.
  unitFits: (metric: string, unit: string) => boolean;
};

// builtQueryOf reads ExplainQuery's understood form into the builder, or
// says every part of it the builder can't show.
export function builtQueryOf(query: Query, options: ReadOptions): ReadBack {
  const reasons: string[] = [];
  const source = sourceNames.find((name) => name === query.source);
  if (!source) return { ok: false, reasons: [`It reads ${query.source}, which the builder doesn't know.`] };
  if (!options.sources.includes(source)) {
    reasons.push(`It reads ${source}, which this Visualization doesn't draw.`);
  }

  let metric = "";
  const conditions: Condition[] = [];
  for (const filter of query.filters) {
    if (filter.values.length !== 1) {
      reasons.push(`It matches ${filter.field} against several values (in …); the builder takes one value per condition.`);
      continue;
    }
    const value = filter.values[0];
    const field = filter.field;
    if (field === "metric") {
      if (metric) reasons.push("It filters by more than one Metric.");
      else metric = value;
    } else if (field === "asset" || field === "device" || field === "adapter") {
      conditions.push({ ...newCondition(field), value });
    } else if (field.startsWith("asset.")) {
      conditions.push({ ...newCondition("attribute"), key: field.slice("asset.".length), value });
    } else if (field.startsWith("tag.")) {
      conditions.push({ ...newCondition("tag"), key: field.slice("tag.".length), value });
    } else if (field === "name") {
      reasons.push("It filters Events by name, which the builder can't show.");
    } else {
      reasons.push(`It filters by ${field}, which the builder can't show.`);
    }
  }

  let range: RangeChoice = defaultRange;
  if (query.range?.last) range = { kind: "last", last: query.range.last };
  else if (query.range?.from && query.range.to) {
    range = {
      kind: "between",
      from: rfc3339(timestampDate(query.range.from)),
      to: rfc3339(timestampDate(query.range.to)),
    };
  } else if (query.range?.from || query.range?.to) reasons.push("Its range is open at one end.");

  const summary: Summary = query.rollup
    ? { kind: "rollup", functions: [...query.rollup.functions], every: query.rollup.every, by: [...query.rollup.by] }
    : { kind: "raw" };

  if (query.unit) {
    if (!metric) reasons.push("It sets a Unit without choosing one Metric.");
    else if (!options.unitFits(metric, query.unit)) {
      reasons.push(`Its Unit ${query.unit} isn't one of ${metric}'s Quantity kind.`);
    }
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    built: { source, metric, conditions, range, summary, unit: query.unit, limit: query.limit },
  };
}
