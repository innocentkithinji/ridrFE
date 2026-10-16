import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { TimestampSchema, type Timestamp } from "@bufbuild/protobuf/wkt";
import type { ListAuditEntriesRequestSchema } from "@ridr/web";

// The Audit log's filters, as they live in the URL query so a view can
// be shared. Times are RFC 3339 with up to nanosecond precision, so
// "Older" can set `to` to exactly the oldest entry shown.
export type AuditFilters = {
  actor: string; // the identity provider's user ID
  action: string; // exact match, "<thing>.<verb>"
  target: string; // exact match
  from: string; // inclusive
  to: string; // exclusive
  limit: string; // entries a page; empty means the server's 100
};

const keys = ["actor", "action", "target", "from", "to", "limit"] as const;

// defaultLimit is what the server returns for limit 0.
export const defaultLimit = 100;

export function filtersFrom(params: URLSearchParams): AuditFilters {
  const filters = {} as AuditFilters;
  for (const key of keys) {
    filters[key] = params.get(key) ?? "";
  }
  return filters;
}

export function paramsFrom(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of keys) {
    if (filters[key]) {
      params.set(key, filters[key]);
    }
  }
  return params;
}

// isFiltered tells whether anything narrows the log, for the empty state.
export function isFiltered(filters: AuditFilters): boolean {
  return Boolean(filters.actor || filters.action || filters.target || filters.from || filters.to);
}

// pageSize is the number of entries one fetch returns at most.
export function pageSize(filters: AuditFilters): number {
  const limit = Number(filters.limit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : defaultLimit;
}

type Request = MessageInitShape<typeof ListAuditEntriesRequestSchema>;

export function requestFrom(filters: AuditFilters): Request {
  return {
    actorId: filters.actor,
    action: filters.action,
    targetId: filters.target,
    from: parseTime(filters.from),
    to: parseTime(filters.to),
    limit: Number(filters.limit) || 0,
  };
}

// formatTime writes a Timestamp as RFC 3339 keeping its nanoseconds,
// which Date would round to milliseconds.
export function formatTime(ts: Timestamp): string {
  const whole = new Date(Number(ts.seconds) * 1000).toISOString().replace(/\.\d+Z$/, "");
  return `${whole}.${String(ts.nanos).padStart(9, "0")}Z`;
}

// parseTime reads an RFC 3339 time, keeping a fraction finer than
// milliseconds; anything unreadable is no bound at all.
export function parseTime(text: string): Timestamp | undefined {
  if (!text) {
    return undefined;
  }
  const fraction = /\.(\d{1,9})/.exec(text);
  const ms = Date.parse(fraction ? text.replace(fraction[0], "") : text);
  if (Number.isNaN(ms)) {
    return undefined;
  }
  return create(TimestampSchema, {
    seconds: BigInt(Math.floor(ms / 1000)),
    nanos: fraction ? Number(fraction[1].padEnd(9, "0")) : 0,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// localInput turns a filter time into a datetime-local input's value,
// in the viewer's time zone, to the minute.
export function localInput(text: string): string {
  const ts = parseTime(text);
  if (!ts) {
    return "";
  }
  const d = new Date(Number(ts.seconds) * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// fromLocalInput is localInput's inverse; it keeps the precise original
// when the input still shows it unchanged.
export function fromLocalInput(value: string, original: string): string {
  if (!value) {
    return "";
  }
  if (value === localInput(original)) {
    return original;
  }
  return new Date(value).toISOString();
}

// The actions Ridr records (internal/audit/audit.go), offered by the
// action filter. Free text works too.
export const knownActions = [
  "adapter.registered",
  "adapter.retired",
  "ingest_key.issued",
  "ingest_key.revoked",
  "member.invited",
  "member.role_changed",
  "member.removed",
  "invitation.revoked",
  "scope.changed",
  "metric.defined",
  "manifest.published",
  "controlled_key.declared",
  "controlled_key.values_added",
  "controlled_key.values_removed",
  "dashboard.created",
  "dashboard.saved",
  "dashboard.restored",
  "dashboard.shared",
  "dashboard.unshared",
  "dashboard.deleted",
  "mapping.changed",
  "raw_payload_retention.changed",
  "mqtt_bridge.created",
  "mqtt_bridge.changed",
  "mqtt_bridge.deleted",
  "reprocessing.started",
  "correction.applied",
  "rule.created",
  "rule.updated",
  "rule.deleted",
  "rule.disabled",
  "rule.enabled",
  "contact_group.created",
  "contact_group.updated",
  "contact_group.deleted",
  "webhook_secret.rotated",
  "silence.created",
  "silence.ended",
];
