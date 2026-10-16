import { useQuery } from "@connectrpc/connect-query";
import { QueryService, type Query } from "@ridr/web";
import { refreshPlan } from "@/lib/refresh-plan";
import { textQuery, useLiveQuery } from "@/lib/use-live-query";

// A Live query keeps only its newest 500 Readings (useLiveQuery). A
// Widget whose answer already holds that many would lose the start of its
// range on the first new Reading, so it reruns on an interval instead.
const liveReadingLimit = 500;
const tooManyToStreamRefreshMs = 60_000;

// useWidgetResult answers one Widget's Query, on its own, so a slow or
// failing Widget never holds up the rest. `understood` is the Query's JSON
// form (saved with the Widget, or from ExplainQuery while editing): from
// it, a range that ends now streams new Readings, and a rollup over such a
// range reruns each bucket.
export function useWidgetResult(text: string, understood: Query | undefined, options: { live: boolean }) {
  const plan = options.live ? refreshPlan(understood) : { kind: "still" as const };
  const run = useQuery(QueryService.method.runQuery, textQuery(text), {
    enabled: text !== "",
    refetchInterval: (query) => {
      if (plan.kind === "refresh") return plan.everyMs;
      const many = (query.state.data?.readings.length ?? 0) >= liveReadingLimit;
      return plan.kind === "stream" && many ? tooManyToStreamRefreshMs : false;
    },
  });
  const tooMany = (run.data?.readings.length ?? 0) >= liveReadingLimit;
  const streaming = plan.kind === "stream" && run.isSuccess && !tooMany;
  const live = useLiveQuery(text, { enabled: streaming });
  const error = (streaming ? live.error : run.error) ?? null;
  const data = streaming ? live.data : run.data;
  return { error, data, isPending: !data && !error, streaming, status: streaming ? live.status : null };
}
