import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

// shownTime writes a Timestamp in the viewer's locale and time zone.
export function shownTime(ts: Timestamp | undefined): string {
  return ts ? timestampDate(ts).toLocaleString() : "–";
}
