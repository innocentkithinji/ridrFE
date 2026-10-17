// A Mapping as the editor holds it while someone writes it: every field
// a string, as typed, and the parts the proto keeps apart (one Device ID
// field or several) kept in one shape.
import { create } from "@bufbuild/protobuf";
import { MappingSchema, type Mapping, type Metric, type Unit } from "@ridr/web";

export type MetricDraft = { field: string; metric: string; unit: string; unknownValues: string };
export type EventDraft = { field: string; name: string };
export type LabelDraft = { field: string; key: string };
export type LocationDraft = {
  latitudeField: string;
  longitudeField: string;
  altitudeField: string;
  accuracyField: string;
};

export type MappingDraft = {
  // One field, or the parts joined with "/" into the Device ID.
  deviceIdFields: string[];
  deviceTimeField: string;
  metrics: MetricDraft[];
  location: LocationDraft;
  events: EventDraft[];
  tags: LabelDraft[];
  attributes: LabelDraft[];
};

// toDraft opens a saved Mapping for editing, or starts an empty one.
export function toDraft(mapping?: Mapping): MappingDraft {
  const idFields = mapping?.deviceIdFields.length
    ? [...mapping.deviceIdFields]
    : [mapping?.deviceIdField ?? ""];
  return {
    deviceIdFields: idFields,
    deviceTimeField: mapping?.deviceTimeField ?? "",
    metrics: (mapping?.metrics ?? []).map((m) => ({
      field: m.field,
      metric: m.metric,
      unit: m.unit,
      unknownValues: m.unknownValues.join(", "),
    })),
    location: {
      latitudeField: mapping?.location?.latitudeField ?? "",
      longitudeField: mapping?.location?.longitudeField ?? "",
      altitudeField: mapping?.location?.altitudeField ?? "",
      accuracyField: mapping?.location?.accuracyField ?? "",
    },
    events: (mapping?.events ?? []).map(({ field, name }) => ({ field, name })),
    tags: (mapping?.tags ?? []).map(({ field, key }) => ({ field, key })),
    attributes: (mapping?.attributes ?? []).map(({ field, key }) => ({ field, key })),
  };
}

// parseUnknownValues reads "511, -1" as numbers; null when one isn't.
export function parseUnknownValues(text: string): number[] | null {
  const values = text.split(/[\s,]+/).filter(Boolean).map(Number);
  return values.some(Number.isNaN) ? null : values;
}

// toMapping is the Mapping a draft says, for PreviewMapping and
// SetMapping. Ridr checks it; the editor sends what was typed.
export function toMapping(draft: MappingDraft): Mapping {
  const idFields = draft.deviceIdFields.map((f) => f.trim());
  const location = draft.location;
  const hasLocation = Object.values(location).some((f) => f.trim() !== "");
  return create(MappingSchema, {
    ...(idFields.length > 1 ? { deviceIdFields: idFields } : { deviceIdField: idFields[0] ?? "" }),
    deviceTimeField: draft.deviceTimeField.trim(),
    metrics: draft.metrics.map((m) => ({
      field: m.field.trim(),
      metric: m.metric,
      unit: m.unit,
      unknownValues: parseUnknownValues(m.unknownValues) ?? [],
    })),
    location: hasLocation
      ? {
          latitudeField: location.latitudeField.trim(),
          longitudeField: location.longitudeField.trim(),
          altitudeField: location.altitudeField.trim(),
          accuracyField: location.accuracyField.trim(),
        }
      : undefined,
    events: draft.events.map((e) => ({ field: e.field.trim(), name: e.name.trim() })),
    tags: draft.tags.map((t) => ({ field: t.field.trim(), key: t.key.trim() })),
    attributes: draft.attributes.map((a) => ({ field: a.field.trim(), key: a.key.trim() })),
  });
}

// unitsFitting lists the Units a Metric may be in: those of its Quantity
// kind, or every Unit for a Metric whose kind nobody has chosen yet.
export function unitsFitting(
  metricName: string,
  metrics: readonly Metric[],
  units: readonly Unit[],
): Unit[] {
  const kind = metrics.find((m) => m.name === metricName)?.quantityKind ?? "";
  return kind === "" ? [...units] : units.filter((u) => u.quantityKind === kind);
}

// Where in the editor an error belongs.
export type FieldKey =
  | "deviceId"
  | "deviceTime"
  | "location"
  | "metrics"
  | `metric.${number}`
  | `event.${number}`
  | `tag.${number}`
  | `attribute.${number}`;

// fieldOf places Ridr's reason for refusing a Mapping beside the field it
// is about, or returns null to show it under the form.
export function fieldOf(message: string, draft: MappingDraft): FieldKey | null {
  if (/device ID/.test(message)) return "deviceId";
  if (/device time/.test(message)) return "deviceTime";
  if (/\b(latitude|longitude|altitude|accuracy)\b/.test(message)) return "location";
  if (/maps no metric, location or event/.test(message)) return "metrics";
  const unfit = /the kind of (\S+)$/.exec(message);
  if (unfit) {
    const i = draft.metrics.findIndex((m) => m.metric === unfit[1]);
    if (i >= 0) return `metric.${i}`;
  }
  const key = /attribute key "(.*?)"/.exec(message);
  if (key) {
    const i = draft.attributes.findIndex((a) => a.key.trim() === key[1]);
    if (i >= 0) return `attribute.${i}`;
  }
  const field = /field "(.*?)"/.exec(message);
  if (field) {
    const path = field[1];
    const rows = { metric: draft.metrics, event: draft.events, tag: draft.tags, attribute: draft.attributes };
    for (const [kind, list] of Object.entries(rows)) {
      const i = list.findIndex((row) => row.field.trim() === path);
      if (i >= 0) return `${kind}.${i}` as FieldKey;
    }
    if (draft.deviceIdFields.some((f) => f.trim() === path)) return "deviceId";
    if (draft.deviceTimeField.trim() === path) return "deviceTime";
  }
  return null;
}
