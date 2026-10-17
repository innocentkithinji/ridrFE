import { useQuery } from "@connectrpc/connect-query";
import { useState } from "react";
import { QueryService, type Query } from "@ridr/web";
import { refreshPlan } from "@/lib/refresh-plan";
import { textQuery, useLiveQuery } from "@/lib/use-live-query";

// A Live query keeps only its newest 500 Readings (useLiveQuery). A
// Widget whose first answer already holds that many would lose the start
// of its range on the first new Reading, so it reruns on an interval
// instead. That is decided once, from the first answer: a Live query
// appends to the same answer, so counting it again would soon find 500
// and drop a streaming Widget back to static. Maps always stream, since
// their vehicles keep their own history.
const liveReadingLimit = 500;
const tooManyToStreamRefreshMs = 60_000;

// useWidgetResult answers one Widget's Query, on its own, so a slow or
// failing Widget never holds up the rest. `understood` is the Query's JSON
// form (saved with the Widget, or from ExplainQuery while editing): from
// it, a range that ends now streams new Readings, and a rollup over such a
// range reruns each bucket.
export function useWidgetResult(
  text: string,
  understood: Query | undefined,
  options: { live: boolean; alwaysStream?: boolean },
) {
  const plan = options.live ? refreshPlan(understood) : { kind: "still" as const };
  const [tooMany, setTooMany] = useState<{ text: string; tooMany: boolean } | null>(null);
  const decided = tooMany?.text === text ? tooMany.tooMany : undefined;
  const run = useQuery(QueryService.method.runQuery, textQuery(text), {
    enabled: text !== "",
    refetchInterval:
      plan.kind === "refresh" ? plan.everyMs : plan.kind === "stream" && decided ? tooManyToStreamRefreshMs : false,
  });
  if (decided === undefined && run.isSuccess) {
    setTooMany({ text, tooMany: !options.alwaysStream && run.data.readings.length >= liveReadingLimit });
  }
  const streaming = plan.kind === "stream" && decided === false;
  const live = useLiveQuery(text, { enabled: streaming });
  const error = (streaming ? live.error : run.error) ?? null;
  const data = streaming ? live.data : run.data;
  return {
    error,
    data,
    isPending: !data && !error,
    streaming,
    status: streaming ? live.status : null,
    // Whether the Query could be kept current (its range ends now).
    canBeLive: refreshPlan(understood).kind !== "still",
  };
}
