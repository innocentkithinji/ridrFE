import { timestampFromMs, type Timestamp } from "@bufbuild/protobuf/wkt";
import { useId } from "react";
import { Input } from "@/components/ui/input";

// A window [from, to) as datetime-local values in the viewer's time zone.
export type Window = { from: string; to: string };

const minute = 60_000;

// localValue writes a moment as a datetime-local value.
function localValue(ms: number): string {
  return new Date(ms - new Date(ms).getTimezoneOffset() * minute).toISOString().slice(0, 16);
}

// lastDay is the 24 hours up to the next whole minute.
export function lastDay(): Window {
  const to = Math.ceil(Date.now() / minute) * minute;
  return { from: localValue(to - 24 * 60 * minute), to: localValue(to) };
}

// windowTimes is the request's from and to, or what is wrong with them.
export function windowTimes(
  window: Window,
): { from: Timestamp; to: Timestamp; problem?: undefined } | { problem: string } {
  const from = new Date(window.from).getTime();
  const to = new Date(window.to).getTime();
  if (!window.from || Number.isNaN(from)) return { problem: "Choose when the window starts." };
  if (!window.to || Number.isNaN(to)) return { problem: "Choose when the window ends." };
  if (from >= to) return { problem: "The window must end after it starts." };
  return { from: timestampFromMs(from), to: timestampFromMs(to) };
}

type WindowFieldsProps = {
  value: Window;
  onChange: (window: Window) => void;
  disabled?: boolean;
};

// WindowFields picks a window: from, inclusive, to, exclusive.
export function WindowFields({ value, onChange, disabled }: WindowFieldsProps) {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1">
        <label htmlFor={`${id}-from`} className="text-sm font-medium">
          From
        </label>
        <Input
          id={`${id}-from`}
          type="datetime-local"
          value={value.from}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-56"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-to`} className="text-sm font-medium">
          To
        </label>
        <Input
          id={`${id}-to`}
          type="datetime-local"
          value={value.to}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-56"
        />
      </div>
    </div>
  );
}
