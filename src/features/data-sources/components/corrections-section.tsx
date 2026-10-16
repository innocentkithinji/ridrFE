import { AdapterService, type Unit } from "@ridr/web";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMetrics, useUnits } from "@/features/data-sources/api/catalog";
import { useCorrectMeasurements } from "@/features/data-sources/api/correct-measurements";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { Field, Section } from "@/features/data-sources/components/section";
import {
  lastDay,
  windowTimes,
  WindowFields,
  type Window,
} from "@/features/data-sources/components/window-fields";
import { useCan } from "@/lib/me";
import { unitLabel } from "@/lib/units";

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3";

// The New Unit choice that leaves Units as they are; "" makes them
// unitless.
const keepUnits = "keep";

type Draft = {
  metric: string;
  window: Window;
  unit: string;
  onlyThisAdapter: boolean;
  devices: string;
  toMetric: string;
  toUnit: string;
};

// deviceIdsOf splits the Devices field at commas and whitespace.
function deviceIdsOf(devices: string): string[] {
  return devices.split(/[\s,]+/).filter(Boolean);
}

// CorrectionsSection lets an admin relabel the Metric or Unit of
// Measurements over a device-time window, when a Manifest or Mapping
// named them wrongly. For admins, on Adapters that aren't retired.
export function CorrectionsSection({ adapter, retired }: AdapterSectionProps) {
  const canCorrect = useCan(AdapterService.method.correctMeasurements);
  if (!canCorrect || retired) return null;
  return <Corrections adapterId={adapter.id} adapterName={adapter.name} />;
}

function Corrections({ adapterId, adapterName }: { adapterId: string; adapterName: string }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    metric: "",
    window: lastDay(),
    unit: "",
    onlyThisAdapter: true,
    devices: "",
    toMetric: "",
    toUnit: keepUnits,
  }));
  const metrics = useMetrics().data?.metrics ?? [];
  const units = useUnits().data?.units ?? [];
  const correct = useCorrectMeasurements();
  const id = useId();
  const update = (patch: Partial<Draft>) => {
    correct.reset();
    setDraft((d) => ({ ...d, ...patch }));
  };

  const times = windowTimes(draft.window);
  const changes = draft.toMetric !== "" || draft.toUnit !== keepUnits;
  const problem = !draft.metric
    ? "Choose the Metric to correct."
    : times.problem ?? (changes ? null : "Choose a new Metric or a new Unit.");

  function send() {
    if (times.problem !== undefined) return Promise.resolve();
    return correct.mutateAsync({
      metric: draft.metric,
      from: times.from,
      to: times.to,
      unit: draft.unit,
      adapterId: draft.onlyThisAdapter ? adapterId : "",
      deviceIds: deviceIdsOf(draft.devices),
      toMetric: draft.toMetric,
      toUnit: draft.toUnit === keepUnits ? undefined : draft.toUnit,
    });
  }

  return (
    <Section title="Corrections">
      <p className="text-muted-foreground text-sm">
        Relabel the Metric or Unit of Measurements over a device-time window, when a Manifest or
        Mapping named them wrongly. Values never change, and corrected Measurements never raise
        Alerts.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Metric" htmlFor={`${id}-metric`}>
          <select
            id={`${id}-metric`}
            className={selectClass}
            value={draft.metric}
            onChange={(e) => update({ metric: e.target.value })}
          >
            <option value="" disabled>
              Choose a Metric
            </option>
            {metrics.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Only in Unit" htmlFor={`${id}-unit`}>
          <select
            id={`${id}-unit`}
            className={selectClass}
            value={draft.unit}
            onChange={(e) => update({ unit: e.target.value })}
          >
            <option value="">Any Unit</option>
            <UnitOptions units={units} />
          </select>
        </Field>
      </div>
      <WindowFields value={draft.window} onChange={(window) => update({ window })} />
      <Field
        label="Devices"
        htmlFor={`${id}-devices`}
        hint="Optional. Device IDs, separated by commas; empty means every Device."
      >
        <Input
          id={`${id}-devices`}
          value={draft.devices}
          onChange={(e) => update({ devices: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.onlyThisAdapter}
          onChange={(e) => update({ onlyThisAdapter: e.target.checked })}
        />
        Only from this Adapter
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New Metric" htmlFor={`${id}-to-metric`}>
          <select
            id={`${id}-to-metric`}
            className={selectClass}
            value={draft.toMetric}
            onChange={(e) => update({ toMetric: e.target.value })}
          >
            <option value="">Keep the Metric</option>
            {metrics.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New Unit" htmlFor={`${id}-to-unit`}>
          <select
            id={`${id}-to-unit`}
            className={selectClass}
            value={draft.toUnit}
            onChange={(e) => update({ toUnit: e.target.value })}
          >
            <option value={keepUnits}>Keep their Units</option>
            <option value="">Unitless</option>
            <UnitOptions units={units} />
          </select>
        </Field>
      </div>
      {problem && <p className="text-muted-foreground text-sm">{problem}</p>}
      {!problem && (
        <ConfirmDialog
          trigger={<Button variant="destructive">Correct</Button>}
          title={`Correct ${draft.metric} Measurements?`}
          confirm="Correct"
          onConfirm={send}
        >
          Every {draft.metric} Measurement in the window
          {draft.onlyThisAdapter ? ` from ${adapterName}` : ""} that matches is relabelled. This
          can't be undone, only corrected back.
        </ConfirmDialog>
      )}
      {correct.data && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {correct.data.corrected === 1n
            ? "1 Measurement corrected."
            : `${correct.data.corrected} Measurements corrected.`}
        </p>
      )}
    </Section>
  );
}

function UnitOptions({ units }: { units: Unit[] }) {
  return units.map((u) => (
    <option key={u.code} value={u.code}>
      {unitLabel(u.code) === u.code ? u.code : `${unitLabel(u.code)} (${u.code})`}
    </option>
  ));
}
