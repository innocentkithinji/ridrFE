import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

// formatTime writes a Timestamp in the user's locale and time zone, or
// "—" when there is none.
export function formatTime(ts: Timestamp | undefined): string {
  return ts ? timeFormat.format(timestampDate(ts)) : "—";
}

// formatValue writes a value with its Unit code, as in "8.2 Cel".
export function formatValue(value: number, unit: string): string {
  return unit ? `${value} ${unit}` : String(value);
}
