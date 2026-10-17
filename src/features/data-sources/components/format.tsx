import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Badge } from "@/components/ui/badge";

// When shows a timestamp in the reader's locale, or nothing.
export function When({ at }: { at?: Timestamp }) {
  return at ? <time dateTime={timestampDate(at).toISOString()}>{timestampDate(at).toLocaleString()}</time> : null;
}

export function RetiredBadge() {
  return <Badge variant="secondary">Retired</Badge>;
}
