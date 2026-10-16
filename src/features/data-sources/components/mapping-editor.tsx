import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  ConnectorService,
  type Mapping,
  type MappedReading,
  type PreviewMappingResponse,
} from "@ridr/web";
import { Plus, X } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMetrics, useUnits } from "@/features/data-sources/api/catalog";
import { useNewestRawPayload } from "@/features/data-sources/api/get-raw-payloads";
import { usePreviewMapping, useSetMapping } from "@/features/data-sources/api/set-mapping";
import { Field } from "@/features/data-sources/components/section";
import {
  fieldOf,
  parseUnknownValues,
  toDraft,
  toMapping,
  unitsFitting,
  type FieldKey,
  type MappingDraft,
} from "@/features/data-sources/mapping-draft";
import { decodeBody, topicLevels } from "@/features/data-sources/raw-payload";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";
import { unitLabel, withUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

type Rows = "metrics" | "events" | "tags" | "attributes";
type Row<K extends Rows> = MappingDraft[K][number];

const emptyRow: { [K in Rows]: Row<K> } = {
  metrics: { field: "", metric: "", unit: "", unknownValues: "" },
  events: { field: "", name: "" },
  tags: { field: "", key: "" },
  attributes: { field: "", key: "" },
};

// A refusal, placed beside the field it is about when it names one.
type Problem = { at: FieldKey | null; message: string };

function problemOf(error: unknown, draft: MappingDraft): Problem {
  const failed = ConnectError.from(error);
  const message = messageFor(failed);
  return { at: failed.code === Code.InvalidArgument ? fieldOf(message, draft) : null, message };
}

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3";

type MappingEditorProps = {
  adapterId: string;
  // The current version, or undefined for a Connector without one.
  saved?: Mapping;
  onSaved: (version: number) => void;
};

// MappingEditor writes a Connector's Mapping: dotted paths into the
// payload, or levels of its MQTT topic picked as chips, previewed against
// a sample before saving as a new version.
export function MappingEditor({ adapterId, saved, onSaved }: MappingEditorProps) {
  const [draft, setDraft] = useState(() => toDraft(saved));
  // The path input a topic level chip fills: the last one focused.
  const [target, setTarget] = useState<{ set: (path: string) => void } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const metrics = useMetrics();
  const units = useUnits();
  const setMapping = useSetMapping();
  const id = useId();

  const update = (patch: Partial<MappingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  function updateRow<K extends Rows>(key: K, i: number, patch: Partial<Row<K>>) {
    setDraft((d) => ({ ...d, [key]: d[key].map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  }
  const addRow = (key: Rows) => setDraft((d) => ({ ...d, [key]: [...d[key], { ...emptyRow[key] }] }));
  const removeRow = (key: Rows, i: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].filter((_, j) => j !== i) }));
  const setIdPart = (i: number, path: string) =>
    setDraft((d) => ({ ...d, deviceIdFields: d.deviceIdFields.with(i, path) }));

  // Props for an input holding a path, which a topic level chip can fill.
  const path = (value: string, set: (path: string) => void): ComponentProps<"input"> => ({
    value,
    onChange: (e) => set(e.target.value),
    onFocus: () => setTarget({ set }),
    className: "font-mono",
    spellCheck: false,
  });
  const errorAt = (at: FieldKey) => (problem?.at === at ? problem.message : null);

  const unknownValuesBad = draft.metrics.some((m) => parseUnknownValues(m.unknownValues) === null);

  function save() {
    setMapping.mutate(
      { adapterId, mapping: toMapping(draft) },
      {
        onSuccess: (answer) => {
          setProblem(null);
          onSaved(answer.mapping?.version ?? 0);
        },
        onError: (error) => setProblem(problemOf(error, draft)),
      },
    );
  }

  const multipart = draft.deviceIdFields.length > 1;
  return (
    <div className="space-y-4">
      <TopicLevels adapterId={adapterId} target={target} />
      <div className="space-y-4">
        <div className="space-y-2">
          {draft.deviceIdFields.map((part, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={multipart ? `Device ID part ${i + 1}` : "Device ID field"}
                  htmlFor={`${id}-device-${i}`}
                  hint={
                    i === draft.deviceIdFields.length - 1 && multipart
                      ? "The parts are joined with / into the Device ID."
                      : undefined
                  }
                >
                  <Input id={`${id}-device-${i}`} {...path(part, (p) => setIdPart(i, p))} />
                </Field>
              </div>
              {multipart && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove Device ID part ${i + 1}`}
                  onClick={() =>
                    update({ deviceIdFields: draft.deviceIdFields.filter((_, j) => j !== i) })
                  }
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
          ))}
          <FieldProblem message={errorAt("deviceId")} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ deviceIdFields: [...draft.deviceIdFields, ""] })}
          >
            <Plus aria-hidden />
            Join another field
          </Button>
        </div>

        <Field
          label="Device time field"
          htmlFor={`${id}-time`}
          hint="RFC 3339 time or Unix seconds."
          error={errorAt("deviceTime")}
        >
          <Input
            id={`${id}-time`}
            aria-invalid={!!errorAt("deviceTime")}
            {...path(draft.deviceTimeField, (p) => update({ deviceTimeField: p }))}
          />
        </Field>

        <RowGroup
          title="Metrics"
          add="Add a Metric"
          onAdd={() => addRow("metrics")}
         
          problem={errorAt("metrics")}
        >
          {draft.metrics.map((row, i) => {
            const fitting = unitsFitting(row.metric, metrics.data?.metrics ?? [], units.data?.units ?? []);
            const known = metrics.data?.metrics.some((m) => m.name === row.metric) ?? false;
            const badValues = parseUnknownValues(row.unknownValues) === null;
            return (
              <RowFields
                key={i}
                legend={`Metric ${i + 1}`}
                onRemove={() => removeRow("metrics", i)}
                problem={errorAt(`metric.${i}`)}
              >
                <Field label="Field" htmlFor={`${id}-m${i}-field`}>
                  <Input
                    id={`${id}-m${i}-field`}
                    {...path(row.field, (p) => updateRow("metrics", i, { field: p }))}
                  />
                </Field>
                <Field label="Metric" htmlFor={`${id}-m${i}-metric`}>
                  <select
                    id={`${id}-m${i}-metric`}
                    className={selectClass}
                    value={row.metric}
                    onChange={(e) => {
                      const metric = e.target.value;
                      const stillFits = unitsFitting(
                        metric,
                        metrics.data?.metrics ?? [],
                        units.data?.units ?? [],
                      ).some((u) => u.code === row.unit);
                      updateRow("metrics", i, { metric, unit: stillFits ? row.unit : "" });
                    }}
                  >
                    <option value="" disabled>
                      Choose a Metric
                    </option>
                    {!known && row.metric && <option value={row.metric}>{row.metric}</option>}
                    {metrics.data?.metrics.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit" htmlFor={`${id}-m${i}-unit`}>
                  <select
                    id={`${id}-m${i}-unit`}
                    className={selectClass}
                    value={row.unit}
                    onChange={(e) => updateRow("metrics", i, { unit: e.target.value })}
                  >
                    <option value="">Unitless</option>
                    {!fitting.some((u) => u.code === row.unit) && row.unit && (
                      <option value={row.unit}>{unitLabel(row.unit)}</option>
                    )}
                    {fitting.map((u) => (
                      <option key={u.code} value={u.code}>
                        {unitLabel(u.code) === u.code ? u.code : `${unitLabel(u.code)} (${u.code})`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Unknown values"
                  htmlFor={`${id}-m${i}-unknown`}
                  hint="Optional. Values meaning “no measurement”, such as 511."
                  error={badValues ? "Numbers, separated by commas." : null}
                >
                  <Input
                    id={`${id}-m${i}-unknown`}
                    aria-invalid={badValues}
                    value={row.unknownValues}
                    onChange={(e) => updateRow("metrics", i, { unknownValues: e.target.value })}
                  />
                </Field>
              </RowFields>
            );
          })}
        </RowGroup>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Location (optional)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["latitudeField", "Latitude field"],
                ["longitudeField", "Longitude field"],
                ["altitudeField", "Altitude field"],
                ["accuracyField", "Accuracy field"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`${id}-${key}`}>
                <Input
                  id={`${id}-${key}`}
                  {...path(draft.location[key], (p) =>
                    setDraft((d) => ({ ...d, location: { ...d.location, [key]: p } })),
                  )}
                />
              </Field>
            ))}
          </div>
          <FieldProblem message={errorAt("location")} />
        </fieldset>

        <RowGroup title="Events (optional)" add="Add an Event" onAdd={() => addRow("events")}>
          {draft.events.map((row, i) => (
            <RowFields
              key={i}
              legend={`Event ${i + 1}`}
              onRemove={() => removeRow("events", i)}
              problem={errorAt(`event.${i}`)}
            >
              <Field label="Field" htmlFor={`${id}-e${i}-field`}>
                <Input id={`${id}-e${i}-field`} {...path(row.field, (p) => updateRow("events", i, { field: p }))} />
              </Field>
              <Field label="Event name" htmlFor={`${id}-e${i}-name`}>
                <Input
                  id={`${id}-e${i}-name`}
                  value={row.name}
                  onChange={(e) => updateRow("events", i, { name: e.target.value })}
                />
              </Field>
            </RowFields>
          ))}
        </RowGroup>

        {(
          [
            ["tags", "Tags (optional)", "Add a Tag", "Tag", "tag"],
            ["attributes", "Attributes (optional)", "Add an Attribute", "Attribute", "attribute"],
          ] as const
        ).map(([key, title, add, noun, at]) => (
          <RowGroup key={key} title={title} add={add} onAdd={() => addRow(key)}>
            {draft[key].map((row, i) => (
              <RowFields
                key={i}
                legend={`${noun} ${i + 1}`}
                onRemove={() => removeRow(key, i)}
                problem={errorAt(`${at}.${i}`)}
              >
                <Field label="Field" htmlFor={`${id}-${at}${i}-field`}>
                  <Input
                    id={`${id}-${at}${i}-field`}
                    {...path(row.field, (p) => updateRow(key, i, { field: p }))}
                  />
                </Field>
                <Field label="Key" htmlFor={`${id}-${at}${i}-key`}>
                  <Input
                    id={`${id}-${at}${i}-key`}
                    value={row.key}
                    onChange={(e) => updateRow(key, i, { key: e.target.value })}
                  />
                </Field>
              </RowFields>
            ))}
          </RowGroup>
        ))}
      </div>

      <MappingPreview
        adapterId={adapterId}
        draft={draft}
        disabled={unknownValuesBad}
        onProblem={setProblem}
      />
      {problem && problem.at === null && (
        <p role="alert" className="text-destructive text-sm">
          {problem.message}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={save} disabled={setMapping.isPending || unknownValuesBad}>
          {setMapping.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// TopicLevels shows the levels of the newest payload's MQTT topic as
// chips; picking one fills the last focused path with "$topic.N".
function TopicLevels({
  adapterId,
  target,
}: {
  adapterId: string;
  target: { set: (path: string) => void } | null;
}) {
  const newest = useNewestRawPayload(adapterId, {
    enabled: useCan(ConnectorService.method.listRawPayloads),
  });
  const levels = topicLevels(newest.data?.topic ?? "");
  if (levels.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Topic levels</p>
      <p className="text-muted-foreground text-xs">
        From the newest payload’s topic. Pick a field, then a level to read it from the topic.
      </p>
      <ul className="flex flex-wrap gap-1" aria-label="Topic levels">
        {levels.map((level, n) => (
          <li key={n}>
            <button
              type="button"
              disabled={!target}
              // Keep focus on the field the chip fills.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => target?.set(`$topic.${n}`)}
              className="hover:bg-muted rounded-full border px-2 py-0.5 font-mono text-xs disabled:opacity-50"
            >
              <span className="text-muted-foreground">$topic.{n}</span> {level || "(empty)"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// MappingPreview runs the draft against a sample: the newest Raw payload
// by default, or one pasted in. It saves nothing.
function MappingPreview({
  adapterId,
  draft,
  disabled,
  onProblem,
}: {
  adapterId: string;
  draft: MappingDraft;
  disabled: boolean;
  onProblem: (problem: Problem | null) => void;
}) {
  const canList = useCan(ConnectorService.method.listRawPayloads);
  const newest = useNewestRawPayload(adapterId, { enabled: canList });
  const hasNewest = newest.data !== undefined;
  const [pasting, setPasting] = useState(false);
  const [sample, setSample] = useState("");
  const [sampleTopic, setSampleTopic] = useState("");
  const preview = usePreviewMapping();
  const id = useId();
  const usePasted = pasting || !canList || (!newest.isPending && !hasNewest);

  function run() {
    const payload =
      !usePasted && newest.data
        ? { samplePayload: decodeBody(newest.data.body).text, sampleTopic: newest.data.topic }
        : { samplePayload: sample, sampleTopic: sampleTopic.trim() };
    preview.mutate(
      { mapping: toMapping(draft), ...payload },
      {
        onSuccess: () => onProblem(null),
        onError: (error) => onProblem(problemOf(error, draft)),
      },
    );
  }

  return (
    <section aria-label="Preview" className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium">Sample</span>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-sample`}
            checked={!usePasted}
            disabled={!hasNewest}
            onChange={() => setPasting(false)}
          />
          Newest Raw payload
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-sample`}
            checked={usePasted}
            onChange={() => setPasting(true)}
          />
          Paste a sample
        </label>
      </div>
      {usePasted && (
        <div className="space-y-2">
          <Field label="Sample payload" htmlFor={`${id}-payload`}>
            <textarea
              id={`${id}-payload`}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              rows={6}
              spellCheck={false}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1 font-mono text-xs outline-none focus-visible:ring-3"
            />
          </Field>
          <Field label="Sample topic" htmlFor={`${id}-topic`} hint="Optional: the MQTT topic it came on.">
            <Input
              id={`${id}-topic`}
              className="font-mono"
              value={sampleTopic}
              onChange={(e) => setSampleTopic(e.target.value)}
            />
          </Field>
        </div>
      )}
      <Button variant="outline" onClick={run} disabled={disabled || preview.isPending}>
        {preview.isPending ? "Previewing…" : "Preview"}
      </Button>
      {preview.data && <PreviewResult answer={preview.data} />}
    </section>
  );
}

function PreviewResult({ answer }: { answer: PreviewMappingResponse }) {
  if (answer.problem) {
    return (
      <p className="text-destructive text-sm">
        <span className="font-medium">Problem:</span> {answer.problem}
      </p>
    );
  }
  const attributes = Object.entries(answer.attributes);
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">
        {answer.readings.length === 1 ? "1 Reading" : `${answer.readings.length} Readings`}
      </p>
      {answer.readings.length > 0 && (
        <ul className="space-y-1">
          {answer.readings.map((reading, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 rounded-md border px-2 py-1">
              <code className="font-mono">{reading.deviceId}</code>
              {reading.deviceTime && (
                <time dateTime={timestampDate(reading.deviceTime).toISOString()}>
                  {timestampDate(reading.deviceTime).toLocaleString()}
                </time>
              )}
              <span>{describe(reading)}</span>
              {Object.entries(reading.tags).map(([k, v]) => (
                <span key={k} className="text-muted-foreground">
                  {k}={v}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {attributes.length > 0 && (
        <div>
          <p className="font-medium">Attributes</p>
          <ul>
            {attributes.map(([k, v]) => (
              <li key={k}>
                <span className="font-mono">{k}</span> = {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// describe says what a Reading holds, as in "temperature 21.5 °C".
function describe(reading: MappedReading): string {
  const kind = reading.kind;
  switch (kind.case) {
    case "measurement":
      return `${kind.value.metric} ${withUnit(kind.value.value, kind.value.unit)}`;
    case "location":
      return `Location ${kind.value.latitude}, ${kind.value.longitude}`;
    case "event": {
      const fields = Object.entries(kind.value.fields).map(([k, v]) => `${k}=${v}`);
      return `Event ${kind.value.name}${fields.length ? ` (${fields.join(", ")})` : ""}`;
    }
    default:
      return "";
  }
}

function RowGroup(props: {
  title: string;
  add: string;
  onAdd: () => void;
  problem?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{props.title}</p>
      {props.children}
      <FieldProblem message={props.problem ?? null} />
      <Button variant="outline" size="sm" onClick={props.onAdd}>
        <Plus aria-hidden />
        {props.add}
      </Button>
    </div>
  );
}

function RowFields(props: {
  legend: string;
  onRemove: () => void;
  problem: string | null;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={cn("relative space-y-2 rounded-lg border p-3", props.problem && "border-destructive")}
    >
      <legend className="text-muted-foreground float-left text-xs font-medium">{props.legend}</legend>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${props.legend}`}
        onClick={props.onRemove}
        className="absolute top-1.5 right-1.5"
      >
        <X aria-hidden />
      </Button>
      <div className="clear-left grid gap-2 pt-1 sm:grid-cols-2">{props.children}</div>
      <FieldProblem message={props.problem} />
    </fieldset>
  );
}

function FieldProblem({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  ) : null;
}
