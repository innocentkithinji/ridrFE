import { ConnectError } from "@connectrpc/connect";
import { CatalogService, QueryService, RegistryService, type RunQueryResponse, type Unit } from "@ridr/web";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { QueryEditor } from "@/components/query-editor/query-editor";
import { Empty, ErrorState, Loading, PermissionDenied } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExplainQuery } from "@/features/explore/api/explain-query";
import { useRunQuery } from "@/features/explore/api/run-query";
import { useAssets, useMetrics, useUnits } from "@/features/explore/api/vocabulary";
import { viewsFor } from "@/features/explore/components/result-views";
import { UnderstoodForm } from "@/features/explore/components/understood-form";
import { refreshPlan, type RefreshPlan } from "@/features/explore/refresh";
import { withUnitStage } from "@/lib/query-text";
import { isRefusal, isTooCostly, queryProblemOf } from "@/lib/errors";
import { useCan, useIsScoped } from "@/lib/me";
import { unitLabel } from "@/lib/units";
import { useLiveQuery, type LiveStatus } from "@/lib/use-live-query";
import { useWithUnitPreference } from "@/lib/use-unit-preferences";

// What the editor holds before anything has run.
export const exampleQuery = `measurements
| where metric == temperature
| range last 1h
| rollup avg, max every 5m by asset`;

// ExploreScreen writes a Query, shows how Ridr understood it, and draws
// the answer. The text that ran lives in the URL (`q`), with the chosen
// view (`view`), so a result can be shared and Back works.
export function ExploreScreen() {
  const [params, setParams] = useSearchParams();
  const text = params.get("q") ?? "";
  // The example is the app's Query, so it takes the Unit preference.
  const example = useWithUnitPreference().apply(exampleQuery, "temperature");
  const draft = useDraft(text, example);
  const canExplain = useCan(QueryService.method.explainQuery);
  const [liveWanted, setLiveWanted] = useState(true);

  const explain = useExplainQuery(text, { enabled: canExplain });
  const plan = refreshPlan(explain.data?.query);
  const refreshing = liveWanted && plan.kind === "refresh";

  // A Query that ends now streams once RunQuery has answered it: RunQuery
  // reports a QueryProblem's position, a Live query can't. Both write the
  // same cache entry, so the answer carries over.
  const run = useRunQuery(text, {
    refetchInterval: refreshing ? plan.everyMs : false,
  });
  const answered = run.isSuccess && !run.isPlaceholderData;
  const streaming = liveWanted && plan.kind === "stream" && answered;
  const live = useLiveQuery(text, { enabled: streaming });
  const vocabulary = useVocabulary();

  const error = (streaming ? live.error : run.error) ?? explain.error;
  const problem = queryProblemOf(run.error ?? explain.error);

  function submit(next: string) {
    const trimmed = next.trim();
    if (trimmed === text) {
      void run.refetch();
      void explain.refetch();
      return;
    }
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("q", trimmed);
      return updated;
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Explore</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <form
          aria-label="Query"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft.value);
          }}
        >
          <QueryEditor
            value={draft.value}
            onChange={draft.set}
            onSubmit={submit}
            problem={problem}
            vocabulary={vocabulary}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Run</Button>
            <span className="text-muted-foreground text-xs">or press Ctrl/⌘ + Enter</span>
            <UnitPicker
              value={explain.data?.query?.unit ?? ""}
              disabled={!text || explain.data?.query?.source !== "measurements"}
              onPick={(unit) => submit(withUnitStage(text, unit))}
            />
          </div>
        </form>
        <aside className="flex flex-col gap-3">
          {explain.data?.query && <UnderstoodForm query={explain.data.query} />}
          <ScopeNote />
        </aside>
      </div>

      {text && plan.kind !== "still" && (
        <LiveControls
          plan={plan}
          wanted={liveWanted}
          onWanted={setLiveWanted}
          status={streaming ? live.status : null}
        />
      )}

      <section aria-label="Answer" className="flex flex-col gap-3">
        {!text ? (
          <Empty>Write a Query and run it to see its answer.</Empty>
        ) : problem ? null : error ? (
          <AnswerError error={error} />
        ) : (streaming ? live.data : run.data) === undefined ? (
          <Loading what="the answer" />
        ) : (
          <Answer
            answer={(streaming ? live.data : run.data)!}
            loading={run.isPlaceholderData && run.isFetching}
          />
        )}
      </section>
    </div>
  );
}

// useDraft holds the text being edited, reset to the URL's text whenever
// that changes (a shared link, Back). Until the user edits it, an empty
// URL shows example.
function useDraft(text: string, example: string) {
  const [draft, setDraft] = useState<{ from: string; value: string | null }>({ from: text, value: null });
  const set = (value: string) => setDraft({ from: text, value });
  if (draft.from !== text) {
    setDraft({ from: text, value: null });
    return { value: text || example, set };
  }
  return { value: draft.value ?? (text || example), set };
}

// useVocabulary gathers the Metric and Asset names the editor completes,
// from the lists the user may read.
function useVocabulary() {
  const metrics = useMetrics({ enabled: useCan(CatalogService.method.listMetrics) });
  const assets = useAssets({ enabled: useCan(RegistryService.method.listAssets) });
  return {
    metrics: metrics.data?.metrics.map((metric) => metric.name),
    assets: assets.data?.assets.map((asset) => asset.name),
  };
}

function Answer({ answer, loading }: { answer: RunQueryResponse; loading: boolean }) {
  const [params, setParams] = useSearchParams();
  const views = viewsFor(answer);
  if (answer.readings.length === 0 && answer.rows.length === 0) {
    return <Empty>No Readings match.</Empty>;
  }
  const chosen = views.find((view) => view.id === params.get("view")) ?? views[0];
  return (
    <div className="relative flex flex-col gap-3">
      <Tabs
        value={chosen.id}
        onValueChange={(id) =>
          setParams(
            (current) => {
              const updated = new URLSearchParams(current);
              updated.set("view", id);
              return updated;
            },
            { replace: true },
          )
        }
      >
        <TabsList aria-label="View">
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id}>
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div aria-busy={loading} className={loading ? "opacity-50 transition-opacity" : undefined}>
        {chosen.render(answer)}
      </div>
      {loading && (
        <p role="status" className="absolute inset-x-0 top-16 flex justify-center">
          <LoaderCircle className="size-6 animate-spin" aria-label="Running the Query" />
        </p>
      )}
    </div>
  );
}

function AnswerError({ error }: { error: unknown }) {
  if (isRefusal(error)) return <PermissionDenied what="these Readings" />;
  if (isTooCostly(error)) {
    return (
      <div role="alert" className="border-destructive/40 flex gap-3 rounded-md border p-4 text-sm">
        <TriangleAlert className="text-destructive size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Ridr won't run this Query: {ConnectError.from(error).rawMessage}</p>
          <p className="text-muted-foreground">
            Try a shorter range, a rollup or a filter.
          </p>
        </div>
      </div>
    );
  }
  return <ErrorState error={error} />;
}

const statusLabel: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  denied: "Refused",
  failed: "Stopped",
};

type LiveControlsProps = {
  plan: Exclude<RefreshPlan, { kind: "still" }>;
  wanted: boolean;
  onWanted: (wanted: boolean) => void;
  status: LiveStatus | null;
};

// LiveControls turns keeping the answer current on and off, and says how:
// streaming new Readings, or rerunning a rollup each bucket.
function LiveControls({ plan, wanted, onWanted, status }: LiveControlsProps) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-sm">
      <label className="text-foreground flex items-center gap-2">
        <input type="checkbox" checked={wanted} onChange={(event) => onWanted(event.target.checked)} />
        Live
      </label>
      {wanted && plan.kind === "stream" && status && (
        <span role="status" className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={status === "live" ? "size-2 rounded-full bg-emerald-600" : "size-2 rounded-full bg-amber-500"}
          />
          {statusLabel[status]}
        </span>
      )}
      {wanted && plan.kind === "refresh" && (
        <span role="status">Refreshing every {everyText(plan.everyMs)}</span>
      )}
    </div>
  );
}

function everyText(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
  if (ms % 60_000 === 0) return `${ms / 60_000}m`;
  return `${Math.round(ms / 1000)}s`;
}

type UnitPickerProps = { value: string; disabled: boolean; onPick: (unit: string) => void };

// UnitPicker sets the Query's `unit` stage, so values come back converted.
function UnitPicker({ value, disabled, onPick }: UnitPickerProps) {
  const canList = useCan(CatalogService.method.listUnits);
  const units = useUnits({ enabled: canList });
  if (!canList) return null;
  const kinds = groupByKind(units.data?.units ?? []);
  return (
    <label className="ml-auto flex items-center gap-2 text-sm">
      Unit
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onPick(event.target.value)}
        className="border-input dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2 text-sm"
      >
        <option value="">As reported</option>
        {kinds.map(([kind, kindUnits]) => (
          <optgroup key={kind} label={kind}>
            {kindUnits.map((unit) => (
              <option key={unit.code} value={unit.code}>
                {unitLabel(unit.code)}
                {unit.aliases.length > 0 ? ` (${unit.aliases.join(", ")})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function groupByKind(units: readonly Unit[]): [string, Unit[]][] {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) groups.set(unit.quantityKind, [...(groups.get(unit.quantityKind) ?? []), unit]);
  return [...groups].toSorted(([a], [b]) => a.localeCompare(b));
}

function ScopeNote() {
  if (!useIsScoped()) return null;
  return (
    <p className="text-muted-foreground text-sm">
      You see only Readings of Assets in your Scope, and every Query reads raw Readings, so its range is
      limited to 31 days.
    </p>
  );
}
