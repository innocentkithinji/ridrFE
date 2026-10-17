import { Plus, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  forSource,
  newCondition,
  rfc3339,
  type BuiltQuery,
  type Condition,
  type ConditionKind,
  type RangeChoice,
  type Source,
  type Summary,
} from "@/components/query-builder/model";
import type { BuilderLists } from "@/components/query-builder/lists";
import { unitLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

// BuilderForm is the builder's controls, one row per stage of the Query
// it writes, in the order the text has them. Each row's gutter names its
// stage as the text does, coloured as the Query editor colours it, so the
// builder teaches the language it writes.

type BuilderFormProps = {
  built: BuiltQuery;
  sources: readonly Source[];
  lists: BuilderLists;
  // The label the Unit option's default gets: the viewer's preference.
  defaultUnitLabel: (metric: string) => string;
  onChange: (built: BuiltQuery) => void;
};

const sourceLabels: Record<Source, string> = {
  measurements: "Measurements",
  locations: "Locations",
  events: "Events",
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3";

export function BuilderForm({ built, sources, lists, defaultUnitLabel, onChange }: BuilderFormProps) {
  const measurements = built.source === "measurements";
  const set = (change: Partial<BuiltQuery>) => onChange({ ...built, ...change });
  return (
    <ol className="relative flex flex-col">
      <Stage keyword={built.source} tone="source" title="Read">
        {sources.length > 1 ? (
          <SourcePicker value={built.source} sources={sources} onPick={(source) => onChange(forSource(built, source))} />
        ) : (
          <p className="text-sm">
            {sourceLabels[built.source]}
            <span className="text-muted-foreground">, as this Visualization draws</span>
          </p>
        )}
      </Stage>
      <Stage keyword="where" tone="keyword" title="Where">
        <div className="flex flex-col gap-2">
          {measurements && (
            <Field label="Metric">
              {(id) => (
                <select
                  id={id}
                  className={selectClass}
                  value={built.metric}
                  onChange={(event) =>
                    set({ metric: event.target.value, unit: lists.unitsOf(event.target.value).some((u) => u.code === built.unit) ? built.unit : "" })
                  }
                >
                  <option value="">Any Metric</option>
                  {withCurrent(lists.metrics, built.metric).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {built.conditions.map((condition, index) => (
            <ConditionRow
              key={condition.id}
              number={index + 1}
              condition={condition}
              lists={lists}
              onChange={(next) =>
                set({ conditions: built.conditions.map((one) => (one.id === condition.id ? next : one)) })
              }
              onRemove={() => set({ conditions: built.conditions.filter((one) => one.id !== condition.id) })}
            />
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set({ conditions: [...built.conditions, newCondition()] })}
            >
              <Plus /> Add a condition
            </Button>
          </div>
        </div>
      </Stage>
      <Stage keyword="range" tone="keyword" title="Over">
        <RangePicker
          value={built.range}
          source={built.source}
          rawOnly={built.conditions.some((c) => c.kind === "asset" || c.kind === "attribute" || c.kind === "tag")}
          onChange={(range) => set({ range })}
        />
      </Stage>
      <Stage keyword="rollup" tone="function" title="Summarise">
        {measurements ? (
          <SummaryPicker value={built.summary} onChange={(summary) => set({ summary })} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {sourceLabels[built.source]} come back one by one: only Measurements can be summarised.
          </p>
        )}
      </Stage>
      {measurements && (
        <Stage keyword="unit" tone="string" title="Unit">
          {built.metric ? (
            <Field label="Unit">
              {(id) => (
                <select id={id} className={selectClass} value={built.unit} onChange={(event) => set({ unit: event.target.value })}>
                  <option value="">{defaultUnitLabel(built.metric)}</option>
                  {withCurrent(
                    lists.unitsOf(built.metric).map((unit) => unit.code),
                    built.unit,
                  ).map((code) => (
                    <option key={code} value={code}>
                      {unitLabel(code)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <p className="text-muted-foreground text-sm">Choose a Metric to pick its Unit.</p>
          )}
        </Stage>
      )}
      <Stage keyword="limit" tone="keyword" title="Limit" last>
        <Field label="Limit" hint="The most rows to return, up to 10,000. Empty for no limit.">
          {(id, hintId) => (
            <Input
              id={id}
              aria-describedby={hintId}
              type="number"
              inputMode="numeric"
              min={1}
              max={10_000}
              placeholder="No limit"
              className="w-32"
              value={built.limit > 0 ? String(built.limit) : ""}
              onChange={(event) => {
                const limit = Math.trunc(Number(event.target.value));
                set({ limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10_000) : 0 });
              }}
            />
          )}
        </Field>
      </Stage>
    </ol>
  );
}

const tones = {
  source: "text-[var(--query-source)]",
  keyword: "text-[var(--query-keyword)]",
  function: "text-[var(--query-function)]",
  string: "text-[var(--query-string)]",
} as const;

type StageProps = { keyword: string; tone: keyof typeof tones; title: string; last?: boolean; children: ReactNode };

// Stage is one row: its keyword on the pipe that joins the stages, then
// its controls. On a narrow screen the keyword sits above the controls.
function Stage({ keyword, tone, title, last, children }: StageProps) {
  const headingId = useId();
  const source = keyword === "measurements" || keyword === "locations" || keyword === "events";
  return (
    <li
      role="group"
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]"
    >
      <h4 id={headingId} className="sr-only">
        {title}
      </h4>
      <div aria-hidden className="relative sm:pt-0.5 sm:pr-4 sm:text-right">
        <span className={cn("font-mono text-xs font-semibold", tones[tone])}>{source ? keyword : `| ${keyword}`}</span>
        {/* The pipe: a rule down the gutter's edge, joining this stage to the next. */}
        <span className={cn("bg-foreground/15 absolute top-0 right-0 hidden w-px sm:block", last ? "h-3.5" : "h-full")} />
        <span
          className={cn(
            "bg-background absolute top-[7px] -right-[3px] hidden size-[7px] rounded-full border-2 border-current sm:block",
            tones[tone],
          )}
        />
      </div>
      <div className={cn("min-w-0 pb-5", last && "pb-0")}>{children}</div>
    </li>
  );
}

type FieldProps = { label: string; hint?: string; children: (id: string, hintId?: string) => ReactNode };

function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {children(id, hint ? hintId : undefined)}
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

function SourcePicker({ value, sources, onPick }: { value: Source; sources: readonly Source[]; onPick: (s: Source) => void }) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-medium">Source</legend>
      <div className="bg-muted flex w-full rounded-lg p-0.5 sm:w-fit">
        {sources.map((source) => (
          <label
            key={source}
            className="has-checked:bg-background has-checked:shadow-xs has-focus-visible:ring-ring/50 relative flex-1 cursor-pointer rounded-md px-3 py-1 text-center text-sm has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name={name}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              value={source}
              checked={value === source}
              onChange={() => onPick(source)}
            />
            {sourceLabels[source]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const conditionKinds: { kind: ConditionKind; label: string }[] = [
  { kind: "asset", label: "Asset" },
  { kind: "attribute", label: "Attribute" },
  { kind: "device", label: "Device" },
  { kind: "adapter", label: "Data source" },
  { kind: "tag", label: "Tag" },
];

type ConditionRowProps = {
  number: number;
  condition: Condition;
  lists: BuilderLists;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
};

function ConditionRow({ number, condition, lists, onChange, onRemove }: ConditionRowProps) {
  const set = (change: Partial<Condition>) => onChange({ ...condition, ...change });
  return (
    <div
      role="group"
      aria-label={`Condition ${number}`}
      className="bg-muted/40 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]"
    >
      <Field label="Filter by">
        {(id) => (
          <select
            id={id}
            className={selectClass}
            value={condition.kind}
            onChange={(event) => onChange({ ...condition, kind: event.target.value as ConditionKind, key: "", value: "" })}
          >
            {conditionKinds.map((one) => (
              <option key={one.kind} value={one.kind}>
                {one.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="order-last col-span-2 flex min-w-0 flex-wrap gap-2 sm:order-none sm:col-span-1 [&>*]:min-w-32 [&>*]:flex-1">
        <ConditionValue condition={condition} lists={lists} set={set} />
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove condition ${number}`} onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

type ConditionValueProps = { condition: Condition; lists: BuilderLists; set: (change: Partial<Condition>) => void };

function ConditionValue({ condition, lists, set }: ConditionValueProps) {
  switch (condition.kind) {
    case "asset":
      return <Choice label="Asset" value={condition.value} options={lists.assets} onPick={(value) => set({ value })} />;
    case "device":
      return (
        <Field label="Device">
          {(id) => (
            <>
              <Input
                id={id}
                list={`${id}-devices`}
                value={condition.value}
                placeholder="Device ID"
                onChange={(event) => set({ value: event.target.value.trim() })}
              />
              <datalist id={`${id}-devices`}>
                {lists.devices.map((device) => (
                  <option key={device} value={device} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      );
    case "adapter":
      return (
        <Choice
          label="Data source"
          value={condition.value}
          options={lists.adapters.map((adapter) => ({ value: adapter.id, label: adapter.name }))}
          onPick={(value) => set({ value })}
        />
      );
    case "attribute": {
      const allowed = lists.allowedValuesOf(condition.key);
      return (
        <>
          <Choice
            label="Attribute key"
            value={condition.key}
            options={lists.attributeKeys}
            onPick={(key) => set({ key, value: "" })}
          />
          {condition.key &&
            (allowed ? (
              <Choice label="Attribute value" value={condition.value} options={allowed} onPick={(value) => set({ value })} />
            ) : (
              <Choice
                label="Attribute value"
                value={condition.value}
                options={lists.attributeValuesOf(condition.key)}
                onPick={(value) => set({ value })}
                free
              />
            ))}
        </>
      );
    }
    case "tag":
      return (
        <>
          <Field label="Tag key">
            {(id) => (
              <Input id={id} value={condition.key} placeholder="route" onChange={(event) => set({ key: event.target.value.trim() })} />
            )}
          </Field>
          <Field label="Tag value">
            {(id) => <Input id={id} value={condition.value} onChange={(event) => set({ value: event.target.value })} />}
          </Field>
        </>
      );
  }
}

type Option = string | { value: string; label: string };

type ChoiceProps = {
  label: string;
  value: string;
  options: readonly Option[];
  onPick: (value: string) => void;
  // Also take a value typed in, for lists that may not hold every value.
  free?: boolean;
};

// Choice picks one value from Ridr's list, or, when there is no list to
// pick from (or the value may be any), takes it typed.
function Choice({ label, value, options, onPick, free }: ChoiceProps) {
  const listed = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  if (free || listed.length === 0) {
    return (
      <Field label={label}>
        {(id) => (
          <>
            <Input id={id} list={`${id}-list`} value={value} onChange={(event) => onPick(event.target.value)} />
            <datalist id={`${id}-list`}>
              {listed.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
          </>
        )}
      </Field>
    );
  }
  const shown = listed.some((option) => option.value === value) || !value ? listed : [{ value, label: value }, ...listed];
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={selectClass} value={value} onChange={(event) => onPick(event.target.value)}>
          <option value="" disabled>
            Choose…
          </option>
          {shown.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

// withCurrent keeps a value read from a Query among the options, even
// when Ridr's list doesn't hold it, so nothing is dropped.
function withCurrent(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

const durationNames: Record<string, string> = {
  "1m": "Last minute",
  "2m": "Last 2 minutes",
  "5m": "Last 5 minutes",
  "15m": "Last 15 minutes",
  "1h": "Last hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

// Locations add up fast, so their presets stay short.
const presetsFor: Record<Source, string[]> = {
  measurements: ["15m", "1h", "6h", "24h", "7d", "30d"],
  locations: ["1m", "2m", "5m", "15m", "1h"],
  events: ["15m", "1h", "6h", "24h", "7d", "30d"],
};

const between = "between";

type RangePickerProps = { value: RangeChoice; source: Source; rawOnly: boolean; onChange: (range: RangeChoice) => void };

function RangePicker({ value, source, rawOnly, onChange }: RangePickerProps) {
  const presets = presetsFor[source];
  const lasts = value.kind === "last" && !presets.includes(value.last) ? [value.last, ...presets] : presets;
  return (
    <div className="flex flex-col gap-2">
      <Field label="Range">
        {(id) => (
          <select
            id={id}
            className={cn(selectClass, "sm:w-56")}
            value={value.kind === "last" ? value.last : between}
            onChange={(event) => {
              const picked = event.target.value;
              if (picked !== between) onChange({ kind: "last", last: picked });
              else {
                const to = new Date();
                to.setSeconds(0, 0);
                onChange({ kind: "between", from: rfc3339(new Date(to.getTime() - 3_600_000)), to: rfc3339(to) });
              }
            }}
          >
            {lasts.map((last) => (
              <option key={last} value={last}>
                {durationNames[last] ?? `Last ${last}`}
              </option>
            ))}
            <option value={between}>Between two times…</option>
          </select>
        )}
      </Field>
      {value.kind === "between" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <TimeField label="From" value={value.from} onChange={(from) => onChange({ ...value, from })} />
          <TimeField label="To" value={value.to} onChange={(to) => onChange({ ...value, to })} />
        </div>
      )}
      {source === "locations" && (
        <p className="text-muted-foreground text-xs">Positions arrive often: a short range keeps the answer small and quick.</p>
      )}
      {rawOnly && (
        <p className="text-muted-foreground text-xs">
          Filtering by Asset, Attribute or Tag reads every Reading, so the range can be at most 31 days.
        </p>
      )}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <Input
          id={id}
          type="datetime-local"
          step={1}
          value={localTime(value)}
          onChange={(event) => {
            const date = new Date(event.target.value);
            if (!Number.isNaN(date.getTime())) onChange(rfc3339(date));
          }}
        />
      )}
    </Field>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// localTime writes an RFC 3339 time as a datetime-local input shows it.
function localTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const functionNames = ["avg", "min", "max", "sum", "count", "first", "last", "p50", "p95", "p99"];
const everyNames: Record<string, string> = {
  "1m": "Every minute",
  "5m": "Every 5 minutes",
  "15m": "Every 15 minutes",
  "1h": "Every hour",
  "6h": "Every 6 hours",
  "1d": "Every day",
  all: "Once, over the whole range",
};
const groupNames: Record<string, string> = { asset: "Asset", device: "Device", metric: "Metric" };

function SummaryPicker({ value, onChange }: { value: Summary; onChange: (summary: Summary) => void }) {
  const name = useId();
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <legend className="sr-only">Summarising</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={value.kind === "raw"} onChange={() => onChange({ kind: "raw" })} />
          Raw values
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={value.kind === "rollup"}
            onChange={() => onChange({ kind: "rollup", functions: ["avg"], every: "5m", by: [] })}
          />
          Summarise every bucket
        </label>
      </fieldset>
      {value.kind === "rollup" && <RollupFields value={value} onChange={onChange} />}
    </div>
  );
}

function RollupFields({ value, onChange }: { value: Extract<Summary, { kind: "rollup" }>; onChange: (s: Summary) => void }) {
  const functions = [...functionNames, ...value.functions.filter((name) => !functionNames.includes(name))];
  const groups = [...Object.keys(groupNames), ...value.by.filter((field) => !(field in groupNames))];
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium">Functions</legend>
        <div className="flex flex-wrap gap-1.5">
          {functions.map((name) => (
            <label
              key={name}
              className="has-checked:border-[var(--query-function)] has-checked:text-[var(--query-function)] has-focus-visible:ring-ring/50 relative flex cursor-pointer items-center rounded-md border px-2 py-0.5 font-mono text-xs has-focus-visible:ring-3"
            >
              <input
                type="checkbox"
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                checked={value.functions.includes(name)}
                // Keep the order the language lists them in.
                onChange={(event) =>
                  onChange({
                    ...value,
                    functions: functions.filter((one) =>
                      one === name ? event.target.checked : value.functions.includes(one),
                    ),
                  })
                }
              />
              {name}
            </label>
          ))}
        </div>
        {value.functions.length === 0 && (
          <p role="status" className="text-destructive text-xs">
            Choose at least one function, or show raw values.
          </p>
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bucket">
          {(id) => (
            <select id={id} className={selectClass} value={value.every} onChange={(event) => onChange({ ...value, every: event.target.value })}>
              {(value.every in everyNames ? Object.keys(everyNames) : [value.every, ...Object.keys(everyNames)]).map((every) => (
                <option key={every} value={every}>
                  {everyNames[every] ?? `Every ${every}`}
                </option>
              ))}
            </select>
          )}
        </Field>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-medium">One line per</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {groups.map((field) => (
              <label key={field} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={value.by.includes(field)}
                  onChange={(event) => onChange({ ...value, by: toggle(value.by, field, event.target.checked) })}
                />
                {groupNames[field] ?? groupLabel(field)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function toggle(list: string[], item: string, on: boolean): string[] {
  return on ? [...list, item] : list.filter((one) => one !== item);
}

function groupLabel(field: string): string {
  if (field.startsWith("asset.")) return `Attribute ${field.slice(6)}`;
  if (field.startsWith("tag.")) return `Tag ${field.slice(4)}`;
  return field;
}
