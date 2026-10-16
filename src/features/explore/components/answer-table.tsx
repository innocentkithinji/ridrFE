import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import type { Reading, RollupRow, RunQueryResponse } from "@ridr/web";
import { groupOf } from "@/components/charts/time-series";
import { withUnit } from "@/lib/units";

// AnswerTable lists any answer: rollup rows by bucket, or Readings by
// device time. Every value carries its Unit. Long answers show their
// first rows only; the chart draws them all.

const shownRows = 500;

export function AnswerTable({ answer }: { answer: RunQueryResponse }) {
  const total = answer.rows.length || answer.readings.length;
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[32rem] overflow-auto rounded-md border">
        {answer.rows.length > 0 ? (
          <RowsTable rows={answer.rows.slice(0, shownRows)} />
        ) : (
          <ReadingsTable readings={answer.readings.slice(0, shownRows)} />
        )}
      </div>
      {total > shownRows && (
        <p className="text-muted-foreground text-sm">
          Showing the first {shownRows.toLocaleString()} of {total.toLocaleString()}.
        </p>
      )}
    </div>
  );
}

const cell = "px-3 py-1.5";
const head = `${cell} text-muted-foreground font-normal`;

function RowsTable({ rows }: { rows: RollupRow[] }) {
  const functions = [...new Set(rows.flatMap((row) => Object.keys(row.values)))];
  return (
    <table aria-label="Query answer" className="w-full text-left text-sm tabular-nums">
      <thead className="bg-muted sticky top-0">
        <tr>
          <th className={head}>Bucket start</th>
          <th className={head}>Group</th>
          {functions.map((fn) => (
            <th key={fn} className={head}>
              {fn}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t">
            <td className={cell}>{timeOf(row.bucketStart)}</td>
            <td className={cell}>{groupOf(row) || "All"}</td>
            {functions.map((fn) => (
              <td key={fn} className={cell}>
                {fn in row.values ? withUnit(row.values[fn], row.unit) : "–"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReadingsTable({ readings }: { readings: Reading[] }) {
  return (
    <table aria-label="Query answer" className="w-full text-left text-sm tabular-nums">
      <thead className="bg-muted sticky top-0">
        <tr>
          <th className={head}>Device time</th>
          <th className={head}>Device</th>
          <th className={head}>What</th>
          <th className={head}>Value</th>
        </tr>
      </thead>
      <tbody>
        {readings.map((reading, index) => {
          const [what, value] = describe(reading);
          return (
            <tr key={index} className="border-t">
              <td className={cell}>{timeOf(reading.deviceTime)}</td>
              <td className={cell}>{reading.deviceId}</td>
              <td className={cell}>{what}</td>
              <td className={cell}>{value}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// describe names what a Reading holds and its value.
function describe(reading: Reading): [string, string] {
  switch (reading.kind.case) {
    case "measurement": {
      const { metric, value, unit } = reading.kind.value;
      return [metric, withUnit(value, unit)];
    }
    case "location": {
      const { latitude, longitude } = reading.kind.value;
      return ["Location", `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`];
    }
    case "event": {
      const { name, fields } = reading.kind.value;
      const shown = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
      return [`Event ${name}`, shown.join(", ")];
    }
    default:
      return ["–", "–"];
  }
}

// timeOf shows a time in the user's time zone.
function timeOf(time: Timestamp | undefined): string {
  return time ? timestampDate(time).toLocaleString() : "–";
}
