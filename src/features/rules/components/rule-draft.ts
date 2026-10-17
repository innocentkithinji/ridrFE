import type { MessageInitShape } from "@bufbuild/protobuf";
import { durationFromMs, durationMs, type Duration } from "@bufbuild/protobuf/wkt";
import { GeofenceTrigger, ThresholdOperator, type Rule, type RuleSchema } from "@ridr/web";
import { crossesAntimeridian, type GeoPolygon } from "@/components/map/tracks";
import { attributeRowsOf, attributesOf, newAttributeRow, type AttributeRow } from "@/lib/attributes";

// The three conditions a Rule watches for.
export type RuleKind = "threshold" | "noData" | "geofence";

export const kindLabels: Record<RuleKind, string> = {
  threshold: "Threshold",
  noData: "No data",
  geofence: "Geofence",
};

export const operatorLabels: Record<Exclude<ThresholdOperator, ThresholdOperator.UNSPECIFIED>, string> = {
  [ThresholdOperator.ABOVE]: "above",
  [ThresholdOperator.AT_OR_ABOVE]: "at or above",
  [ThresholdOperator.BELOW]: "below",
  [ThresholdOperator.AT_OR_BELOW]: "at or below",
};

export const triggerLabels: Record<Exclude<GeofenceTrigger, GeofenceTrigger.UNSPECIFIED>, string> = {
  [GeofenceTrigger.LEAVES]: "leaves the area",
  [GeofenceTrigger.ENTERS]: "enters the area",
};

// RuleDraft is a Rule as the form holds it: numbers as typed, durations
// in minutes.
export type RuleDraft = {
  name: string;
  selector: AttributeRow[];
  kind: RuleKind;
  metric: string;
  operator: ThresholdOperator;
  value: string;
  unit: string;
  noDataMetric: string;
  silentForMinutes: string;
  zone: GeoPolygon | null;
  trigger: GeofenceTrigger;
  forMinutes: string;
  freshnessMinutes: string;
  contactGroupIds: string[];
  renotifyMinutes: string;
  maxRepeats: string;
};

// What may be wrong with a draft, by field.
export type DraftProblems = Partial<Record<keyof RuleDraft, string>>;

export const antimeridianProblem =
  "This area crosses the 180° meridian, which Ridr can't watch. Draw it on one side.";

const minuteMs = 60_000;

// ruleDraftKey is where a Rule's unsaved edit is kept, or a new Rule's.
export function ruleDraftKey(ruleId?: string): string {
  return ruleId ? `rule:${ruleId}` : "rule:new";
}

// storedRuleDraft reads a draft back from storage, with fresh selector
// row IDs so they never clash with rows made since.
export function storedRuleDraft(stored: unknown): RuleDraft | null {
  const draft = stored as RuleDraft | null;
  if (!draft || typeof draft.name !== "string" || !Array.isArray(draft.selector)) return null;
  return {
    ...newDraft(),
    ...draft,
    selector: draft.selector.map(({ key, value }) => ({ ...newAttributeRow(), key, value })),
  };
}

// newDraft starts a Rule with Ridr's defaults: a threshold, fresh for 5
// minutes, no repeats.
export function newDraft(selector: AttributeRow[] = []): RuleDraft {
  return {
    name: "",
    selector,
    kind: "threshold",
    metric: "",
    operator: ThresholdOperator.ABOVE,
    value: "",
    unit: "",
    noDataMetric: "",
    silentForMinutes: "10",
    zone: null,
    trigger: GeofenceTrigger.LEAVES,
    forMinutes: "0",
    freshnessMinutes: "5",
    contactGroupIds: [],
    renotifyMinutes: "0",
    maxRepeats: "0",
  };
}

// draftOf turns a saved Rule into the form's draft.
export function draftOf(rule: Rule): RuleDraft {
  const draft: RuleDraft = {
    ...newDraft(attributeRowsOf(rule.selector)),
    name: rule.name,
    forMinutes: minutesText(rule.forDuration),
    freshnessMinutes: rule.freshness ? minutesText(rule.freshness) : "5",
    contactGroupIds: [...rule.contactGroupIds],
    renotifyMinutes: minutesText(rule.renotifyInterval),
    maxRepeats: String(rule.maxRepeats),
  };
  const condition = rule.condition;
  switch (condition.case) {
    case "threshold":
      return {
        ...draft,
        kind: "threshold",
        metric: condition.value.metric,
        operator: condition.value.operator,
        value: String(condition.value.value),
        unit: condition.value.unit,
      };
    case "noData":
      return {
        ...draft,
        kind: "noData",
        noDataMetric: condition.value.metric,
        silentForMinutes: minutesText(condition.value.silentFor),
      };
    case "geofence":
      return {
        ...draft,
        kind: "geofence",
        zone: condition.value.zone.map((point) => [point.longitude, point.latitude]),
        trigger: condition.value.trigger,
      };
    default:
      return draft;
  }
}

function minutesText(duration: Duration | undefined): string {
  return String(duration ? durationMs(duration) / minuteMs : 0);
}

function minutes(text: string): Duration {
  return durationFromMs(Math.round(Number(text) * minuteMs));
}

// isNumber tells whether text is a number someone typed.
function isNumber(text: string): boolean {
  return text.trim() !== "" && Number.isFinite(Number(text));
}

// draftProblems checks a draft the way Ridr will, so the form can say
// what to fix before saving.
export function draftProblems(draft: RuleDraft): DraftProblems {
  const problems: DraftProblems = {};
  if (!draft.name.trim()) problems.name = "Enter a name.";
  if (draft.kind === "threshold") {
    if (!draft.metric) problems.metric = "Choose a Metric.";
    if (!isNumber(draft.value)) problems.value = "Enter a number.";
  }
  if (draft.kind === "noData" && !(isNumber(draft.silentForMinutes) && Number(draft.silentForMinutes) >= 1)) {
    problems.silentForMinutes = "At least 1 minute.";
  }
  if (draft.kind === "geofence") {
    const zone = draft.zone ?? [];
    if (zone.length < 3) problems.zone = "Draw an area of at least 3 corners.";
    else if (zone.length > 1000) problems.zone = "An area has at most 1000 corners.";
    else if (crossesAntimeridian(zone)) problems.zone = antimeridianProblem;
  }
  if (!(isNumber(draft.forMinutes) && Number(draft.forMinutes) >= 0)) {
    problems.forMinutes = "0 or more minutes.";
  }
  if (!(isNumber(draft.freshnessMinutes) && Number(draft.freshnessMinutes) > 0)) {
    problems.freshnessMinutes = "More than 0 minutes.";
  }
  const interval = Number(draft.renotifyMinutes);
  const repeats = Number(draft.maxRepeats);
  if (!isNumber(draft.renotifyMinutes) || (interval !== 0 && interval < 1)) {
    problems.renotifyMinutes = "0, or at least 1 minute.";
  }
  if (!isNumber(draft.maxRepeats) || !Number.isInteger(repeats) || repeats < 0 || repeats > 100) {
    problems.maxRepeats = "A whole number from 0 to 100.";
  } else if ((interval === 0) !== (repeats === 0)) {
    problems.maxRepeats = "Set both the interval and the count, or neither.";
  }
  return problems;
}

// ruleOf turns a checked draft into the Rule Ridr takes.
export function ruleOf(draft: RuleDraft, id = ""): MessageInitShape<typeof RuleSchema> {
  return {
    id,
    name: draft.name.trim(),
    selector: attributesOf(draft.selector),
    forDuration: minutes(draft.forMinutes),
    freshness: minutes(draft.freshnessMinutes),
    contactGroupIds: draft.contactGroupIds,
    renotifyInterval: minutes(draft.renotifyMinutes),
    maxRepeats: Number(draft.maxRepeats),
    condition: conditionOf(draft),
  };
}

function conditionOf(draft: RuleDraft): MessageInitShape<typeof RuleSchema>["condition"] {
  switch (draft.kind) {
    case "threshold":
      return {
        case: "threshold",
        value: { metric: draft.metric, operator: draft.operator, value: Number(draft.value), unit: draft.unit },
      };
    case "noData":
      return { case: "noData", value: { metric: draft.noDataMetric, silentFor: minutes(draft.silentForMinutes) } };
    case "geofence":
      return {
        case: "geofence",
        value: {
          zone: (draft.zone ?? []).map(([longitude, latitude]) => ({ latitude, longitude })),
          trigger: draft.trigger,
        },
      };
  }
}

// kindOf names a Rule's condition, as the list shows it.
export function kindOf(rule: Rule): string {
  const kind = rule.condition.case;
  return kind ? kindLabels[kind] : "Unknown";
}

// selectorText writes a selector as key=value pairs, or says it watches
// everything.
export function selectorText(selector: Record<string, string>): string {
  const pairs = Object.entries(selector)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  return pairs.length ? pairs.join(", ") : "every Asset";
}
