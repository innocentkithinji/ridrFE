import { Code, ConnectError } from "@connectrpc/connect";
import { GeofenceTrigger, ThresholdOperator, type Asset } from "@ridr/web";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { AttributeEditor } from "@/components/attribute-editor";
import { TrackMap } from "@/components/map/track-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssets } from "@/features/assets/api/get-assets";
import { sortMetrics, useMetrics } from "@/features/catalog/api/metrics";
import { useUnits } from "@/features/catalog/api/units";
import { useContactGroups } from "@/features/contact-groups/api/get-contact-groups";
import { useControlledKeys } from "@/features/controlled-keys/api/get-controlled-keys";
import {
  draftProblems,
  kindLabels,
  operatorLabels,
  triggerLabels,
  type DraftProblems,
  type RuleDraft,
  type RuleKind,
} from "@/features/rules/components/rule-draft";
import {
  attributeProblems,
  attributeRowsOf,
  attributesOf,
  hasAttributeProblems,
  holdsEvery,
  type AttributeRow,
} from "@/lib/attributes";
import { messageFor } from "@/lib/errors";
import { unitLabel } from "@/lib/units";

const selectClass =
  "border-input bg-background h-8 w-full rounded-lg border px-2 text-sm aria-invalid:border-destructive";

type RuleFormProps = {
  initial: RuleDraft;
  submitLabel: string;
  // Sends the draft; a refusal it throws shows beside the form.
  save: (draft: RuleDraft) => Promise<unknown>;
  onCancel: () => void;
};

// RuleForm edits every field of a Rule: name, the Assets it watches, its
// condition, timing, who it notifies and how often.
export function RuleForm({ initial, submitLabel, save, onCancel }: RuleFormProps) {
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [saving, setSaving] = useState(false);
  const controlledKeys = useControlledKeys();
  const keys = controlledKeys.data?.controlledKeys ?? [];
  const id = useId();

  const problems: DraftProblems = submitted ? draftProblems(draft) : {};
  const change = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setRefusal(undefined);
    const found = draftProblems(draft);
    if (Object.keys(found).length > 0 || hasAttributeProblems(attributeProblems(draft.selector, keys))) {
      return;
    }
    setSaving(true);
    try {
      await save(draft);
    } catch (error) {
      setRefusal(refusalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const field = (name: keyof RuleDraft) => ({
    id: `${id}-${name}`,
    error: problems[name],
    "aria-invalid": problems[name] ? true : undefined,
    "aria-describedby": problems[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-8">
      <Field {...field("name")} label="Name">
        <Input
          {...controlProps(field("name"))}
          value={draft.name}
          maxLength={200}
          placeholder="Vaccine fridges too warm"
          onChange={(event) => change({ name: event.target.value })}
        />
      </Field>

      <Section title="Assets">
        <FromAsset onPick={(asset) => change({ selector: attributeRowsOf(asset.attributes) })} />
        <AttributeEditor
          legend="Selector"
          rows={draft.selector}
          onChange={(selector) => change({ selector })}
          controlledKeys={keys}
          showAllProblems={submitted}
        />
        <WatchedAssets rows={draft.selector} />
      </Section>

      <Section title="Condition">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">Kind</legend>
          {(Object.keys(kindLabels) as RuleKind[]).map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-kind`}
                checked={draft.kind === kind}
                onChange={() => change({ kind })}
              />
              {kindLabels[kind]}
            </label>
          ))}
        </fieldset>
        {draft.kind === "threshold" && <ThresholdFields draft={draft} change={change} field={field} />}
        {draft.kind === "noData" && <NoDataFields draft={draft} change={change} field={field} />}
        {draft.kind === "geofence" && <GeofenceFields draft={draft} change={change} field={field} />}
      </Section>

      <Section title="Timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field {...field("forMinutes")} label="Holds for (minutes)" hint="0 fires on the first breaking Reading.">
            <Input
              {...controlProps(field("forMinutes"))}
              type="number"
              min={0}
              step="any"
              value={draft.forMinutes}
              onChange={(event) => change({ forMinutes: event.target.value })}
            />
          </Field>
          <Field
            {...field("freshnessMinutes")}
            label="Freshness (minutes)"
            hint="How late a Reading may arrive and still count."
          >
            <Input
              {...controlProps(field("freshnessMinutes"))}
              type="number"
              min={0}
              step="any"
              value={draft.freshnessMinutes}
              onChange={(event) => change({ freshnessMinutes: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Notify">
        <ContactGroupPicker
          chosen={draft.contactGroupIds}
          onChange={(contactGroupIds) => change({ contactGroupIds })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            {...field("renotifyMinutes")}
            label="Repeat every (minutes)"
            hint="While nobody acknowledges the Alert. 0 never repeats."
          >
            <Input
              {...controlProps(field("renotifyMinutes"))}
              type="number"
              min={0}
              step="any"
              value={draft.renotifyMinutes}
              onChange={(event) => change({ renotifyMinutes: event.target.value })}
            />
          </Field>
          <Field {...field("maxRepeats")} label="Repeat at most (times)" hint="Up to 100.">
            <Input
              {...controlProps(field("maxRepeats"))}
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.maxRepeats}
              onChange={(event) => change({ maxRepeats: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      {refusal && (
        <p role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// refusalMessage says why Ridr refused a Rule. Its InvalidArgument and
// PermissionDenied (a selector outside the user's Scope) name what to
// change, so the server's own words are shown.
function refusalMessage(error: unknown): string {
  const refusal = ConnectError.from(error);
  if (refusal.code === Code.PermissionDenied && refusal.rawMessage) {
    return refusal.rawMessage;
  }
  return messageFor(refusal);
}

type FieldControl = {
  id: string;
  error?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function controlProps({ error: _error, ...props }: FieldControl) {
  return props;
}

type ConditionFieldsProps = {
  draft: RuleDraft;
  change: (patch: Partial<RuleDraft>) => void;
  field: (name: keyof RuleDraft) => FieldControl;
};

function ThresholdFields({ draft, change, field }: ConditionFieldsProps) {
  const metrics = useMetrics();
  const units = useUnits();
  const all = sortMetrics(metrics.data?.metrics ?? []);
  const kind = all.find((metric) => metric.name === draft.metric)?.quantityKind ?? "";
  // A threshold compares Readings in Units of its Quantity kind, so only
  // those are offered.
  const fitting = kind ? (units.data?.units ?? []).filter((unit) => unit.quantityKind === kind) : [];
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Field {...field("metric")} label="Metric">
        <select
          {...controlProps(field("metric"))}
          className={selectClass}
          value={draft.metric}
          onChange={(event) => change({ metric: event.target.value, unit: "" })}
        >
          <option value="" disabled>
            Choose a Metric
          </option>
          {draft.metric && !all.some((metric) => metric.name === draft.metric) && (
            <option value={draft.metric}>{draft.metric}</option>
          )}
          {all.map((metric) => (
            <option key={metric.name} value={metric.name}>
              {metric.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${field("operator").id}`} label="Operator">
        <select
          id={field("operator").id}
          className={selectClass}
          value={draft.operator}
          onChange={(event) => change({ operator: Number(event.target.value) as ThresholdOperator })}
        >
          {Object.entries(operatorLabels).map(([operator, label]) => (
            <option key={operator} value={operator}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field {...field("value")} label="Value">
        <Input
          {...controlProps(field("value"))}
          type="number"
          step="any"
          value={draft.value}
          onChange={(event) => change({ value: event.target.value })}
        />
      </Field>
      <Field id={field("unit").id} label="Unit">
        <select
          id={field("unit").id}
          className={selectClass}
          value={draft.unit}
          onChange={(event) => change({ unit: event.target.value })}
        >
          <option value="">No unit</option>
          {draft.unit && !fitting.some((unit) => unit.code === draft.unit) && (
            <option value={draft.unit}>{unitLabel(draft.unit)}</option>
          )}
          {fitting.map((unit) => (
            <option key={unit.code} value={unit.code}>
              {unitLabel(unit.code)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function NoDataFields({ draft, change, field }: ConditionFieldsProps) {
  const metrics = useMetrics();
  const all = sortMetrics(metrics.data?.metrics ?? []);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={field("noDataMetric").id} label="Metric" hint="Which Readings count as reporting.">
        <select
          id={field("noDataMetric").id}
          className={selectClass}
          value={draft.noDataMetric}
          onChange={(event) => change({ noDataMetric: event.target.value })}
        >
          <option value="">Any Reading</option>
          {all.map((metric) => (
            <option key={metric.name} value={metric.name}>
              {metric.name}
            </option>
          ))}
        </select>
      </Field>
      <Field {...field("silentForMinutes")} label="Silent for (minutes)" hint="At least 1 minute.">
        <Input
          {...controlProps(field("silentForMinutes"))}
          type="number"
          min={1}
          step="any"
          value={draft.silentForMinutes}
          onChange={(event) => change({ silentForMinutes: event.target.value })}
        />
      </Field>
    </div>
  );
}

function GeofenceFields({ draft, change, field }: ConditionFieldsProps) {
  const zone = field("zone");
  return (
    <div className="space-y-4">
      <Field id={field("trigger").id} label="Fires when an Asset">
        <select
          id={field("trigger").id}
          className={selectClass}
          value={draft.trigger}
          onChange={(event) => change({ trigger: Number(event.target.value) as GeofenceTrigger })}
        >
          {Object.entries(triggerLabels).map(([trigger, label]) => (
            <option key={trigger} value={trigger}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <TrackMap
        tracks={[]}
        label="Geofence"
        area={{ polygon: draft.zone, onChange: (polygon) => change({ zone: polygon }) }}
      />
      {zone.error && (
        <p id={`${zone.id}-error`} className="text-destructive text-sm">
          {zone.error}
        </p>
      )}
    </div>
  );
}

// ContactGroupPicker chooses the Contact groups a Rule notifies, warning
// when nobody will be.
function ContactGroupPicker({ chosen, onChange }: { chosen: string[]; onChange: (ids: string[]) => void }) {
  const groups = useContactGroups();
  const all = groups.data?.contactGroups ?? [];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Contact groups</legend>
      {all.map((group) => (
        <label key={group.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={chosen.includes(group.id)}
            onChange={(event) =>
              onChange(event.target.checked ? [...chosen, group.id] : chosen.filter((id) => id !== group.id))
            }
          />
          {group.name}
        </label>
      ))}
      {chosen.length === 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Nobody will be notified.{" "}
          {all.length === 0 ? "There are no Contact groups yet: " : "Choose a group above, or manage "}
          <Link to="/settings/contact-groups" className="underline underline-offset-4">
            Contact groups
          </Link>
          .
        </p>
      )}
    </fieldset>
  );
}

// FromAsset fills the selector with one Asset's Attributes, picked by
// name.
function FromAsset({ onPick }: { onPick: (asset: Asset) => void }) {
  const assets = useAssets();
  const listId = useId();
  const [name, setName] = useState("");
  const all = assets.data?.assets ?? [];
  return (
    <label className="block space-y-1 text-sm font-medium">
      <span>Start from an Asset</span>
      <datalist id={listId}>
        {all.map((asset) => (
          <option key={asset.id} value={asset.name} />
        ))}
      </datalist>
      <Input
        list={listId}
        value={name}
        autoComplete="off"
        placeholder="Asset name"
        onChange={(event) => {
          setName(event.target.value);
          const picked = all.find((asset) => asset.name === event.target.value);
          if (picked) {
            onPick(picked);
          }
        }}
      />
      <span className="text-muted-foreground block text-xs font-normal">
        Copies its Attributes into the selector, so Assets like it are watched too.
      </span>
    </label>
  );
}

// How many watched Assets the preview names before summing up the rest.
const previewLimit = 20;

// WatchedAssets previews the Assets holding every complete pair.
function WatchedAssets({ rows }: { rows: AttributeRow[] }) {
  const assets = useAssets();
  const selector = useMemo(
    () => attributesOf(rows.filter((row) => row.key.trim() && row.value.trim())),
    [rows],
  );
  const watched = useMemo(
    () => (assets.data?.assets ?? []).filter((asset) => holdsEvery(asset.attributes, selector)),
    [assets.data, selector],
  );
  if (!assets.data) {
    return null;
  }
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        An empty selector watches every Asset, and Devices with no Asset.
      </p>
    );
  }
  if (watched.length === 0) {
    return <p className="text-muted-foreground text-sm">No Assets hold every pair yet.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        Watches {watched.length} {watched.length === 1 ? "Asset" : "Assets"}
      </p>
      <ul aria-label="Assets this Rule watches" className="text-muted-foreground list-disc pl-5">
        {watched.slice(0, previewLimit).map((asset) => (
          <li key={asset.id}>{asset.name}</li>
        ))}
        {watched.length > previewLimit && <li>and {watched.length - previewLimit} more</li>}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type FieldProps = FieldControl & { label: string; hint?: string; children: ReactNode };

// Field labels a control and shows its hint, or its error, beneath.
function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}
