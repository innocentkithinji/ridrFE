import { timestampMs } from "@bufbuild/protobuf/wkt";
import type { Reading, RunQueryResponse } from "@ridr/web";

// EventsList shows a Widget's Events newest first: what happened, on which
// Device, when, and the fields it carried. Text, not a chart: Events are
// things to read, one by one.

const shownEvents = 200;
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" });

type EventReading = Reading & { kind: { case: "event" } };

export function EventsList({ answer, label }: { answer: RunQueryResponse; label: string }) {
  const events = answer.readings
    .filter((reading): reading is EventReading => reading.kind.case === "event")
    .toReversed();
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">No Events match.</p>;
  }
  return (
    <div className="flex h-full flex-col gap-1">
      <ul aria-label={label} className="min-h-0 flex-1 divide-y overflow-auto text-sm">
        {events.slice(0, shownEvents).map((reading, index) => (
          <EventItem key={index} reading={reading} />
        ))}
      </ul>
      {events.length > shownEvents && (
        <p className="text-muted-foreground text-xs">
          Showing the newest {shownEvents} of {events.length.toLocaleString()}.
        </p>
      )}
    </div>
  );
}

function EventItem({ reading }: { reading: EventReading }) {
  const { name, fields } = reading.kind.value;
  const pairs = Object.entries(fields);
  return (
    <li className="flex flex-col gap-0.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{name}</span>
        <time className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {reading.deviceTime ? timeFormat.format(timestampMs(reading.deviceTime)) : "–"}
        </time>
      </div>
      <p className="text-muted-foreground truncate text-xs">
        {reading.deviceId}
        {pairs.length > 0 && " · "}
        {pairs.map(([key, value]) => `${key}=${value}`).join(", ")}
      </p>
    </li>
  );
}
