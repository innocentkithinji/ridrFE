import { timestampFromMs, type Timestamp } from "@bufbuild/protobuf/wkt";
import { useId } from "react";
import { Input } from "@/components/ui/input";

// When is the moment an Assignment starts or ends: now, or a time the
// user picks, as a datetime-local value in their own time zone.
export type When = { mode: "now" } | { mode: "at"; local: string };

export const now: When = { mode: "now" };

// timestampOf is the request's time for a When: unset means now.
export function timestampOf(when: When): Timestamp | undefined {
  return when.mode === "now" ? undefined : timestampFromMs(new Date(when.local).getTime());
}

// whenProblem tells what is wrong with a chosen time, if anything.
export function whenProblem(when: When): string | undefined {
  if (when.mode === "now") return undefined;
  if (!when.local || Number.isNaN(new Date(when.local).getTime())) return "Choose a time.";
  return undefined;
}

type WhenFieldProps = {
  // What the moment is, as in "Starts" or "Ends".
  legend: string;
  // The label of the picked time, as in "From a chosen time".
  atLabel: string;
  value: When;
  onChange: (when: When) => void;
  problem?: string;
};

// WhenField picks now or a chosen time.
export function WhenField({ legend, atLabel, value, onChange, problem }: WhenFieldProps) {
  const name = useId();
  const problemId = useId();
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="mb-1 font-medium">{legend}</legend>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={value.mode === "now"}
          onChange={() => onChange(now)}
        />
        Now
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={value.mode === "at"}
          onChange={() => onChange({ mode: "at", local: "" })}
        />
        {atLabel}
      </label>
      {value.mode === "at" && (
        <Input
          type="datetime-local"
          aria-label={`${legend} at`}
          value={value.local}
          onChange={(event) => onChange({ mode: "at", local: event.target.value })}
          aria-invalid={!!problem}
          aria-describedby={problem ? problemId : undefined}
          className="max-w-60"
        />
      )}
      {problem && (
        <span id={problemId} role="alert" className="text-destructive block text-xs">
          {problem}
        </span>
      )}
    </fieldset>
  );
}
