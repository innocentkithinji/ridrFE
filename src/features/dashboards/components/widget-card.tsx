import { ConnectError } from "@connectrpc/connect";
import type { QueryProblem, RunQueryResponse } from "@ridr/web";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnswerTable } from "@/components/answer-table";
import { measurementSeries, rollupSeries } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { TrackMap } from "@/components/map/track-map";
import { locationTracks } from "@/components/map/tracks";
import { Button } from "@/components/ui/button";
import { QueryService } from "@ridr/web";
import { useExplainQuery } from "@/features/dashboards/api/explain-query";
import { useWidgetResult } from "@/features/dashboards/api/widget-result";
import { EventsList } from "@/features/dashboards/components/events-list";
import { StatView } from "@/features/dashboards/components/stat-view";
import type { Visualization, WidgetDraft } from "@/features/dashboards/widgets";
import { isRefusal, isTooCostly, messageFor, queryProblemOf } from "@/lib/errors";
import { useCan } from "@/lib/me";
import { cn } from "@/lib/utils";

// The class the grid drags a Widget by: its header.
export const widgetHandle = "widget-handle";

type WidgetCardProps = {
  widget: WidgetDraft;
  // Where a save said this Widget's Query is wrong, if it did.
  problem?: QueryProblem | null;
  // Given in edit mode: the Widget's edit and remove buttons.
  onEdit?: () => void;
  onRemove?: () => void;
};

// WidgetCard is one Widget on a Dashboard: its title, and its own Query's
// answer drawn as its Visualization, with its own loading, empty and
// error states, so one failing Widget never affects the others.
export function WidgetCard({ widget, problem, onEdit, onRemove }: WidgetCardProps) {
  const canExplain = useCan(QueryService.method.explainQuery);
  const explain = useExplainQuery(widget.text, { enabled: canExplain && !widget.understood });
  const result = useWidgetResult(widget.text, widget.understood ?? explain.data?.query, { live: true });
  const editing = !!onEdit;

  return (
    <section
      aria-label={widget.title}
      data-invalid={problem ? "true" : undefined}
      className="bg-card data-[invalid=true]:border-destructive flex h-full flex-col overflow-hidden rounded-lg border"
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b px-3 py-1.5",
          editing && `${widgetHandle} cursor-grab active:cursor-grabbing`,
        )}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{widget.title}</h2>
        {result.status === "live" && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />
            Live
          </span>
        )}
        {editing && (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${widget.title}`} onClick={onEdit}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${widget.title}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          </>
        )}
      </header>
      {problem && (
        <p role="alert" className="text-destructive border-b px-3 py-1.5 text-xs">
          Not saved. This widget's Query, line {problem.line}, column {problem.column}: {problem.message}
        </p>
      )}
      <WidgetBody>
        {(height) =>
          result.isPending ? (
            <p role="status" className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading…
            </p>
          ) : result.error ? (
            <WidgetError error={result.error} />
          ) : result.data!.readings.length === 0 && result.data!.rows.length === 0 ? (
            <p className="text-muted-foreground flex h-full items-center justify-center text-sm">No Readings match.</p>
          ) : (
            <Drawn
              visualization={widget.visualization}
              answer={result.data!}
              title={widget.title}
              height={height}
              stale={result.status === "reconnecting"}
            />
          )
        }
      </WidgetBody>
    </section>
  );
}

// WidgetBody measures the space under the header, so charts and maps can
// fill the Widget's cell.
function WidgetBody({ children }: { children: (height: number) => ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = body.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={body} className="min-h-0 flex-1 overflow-hidden p-3">
      {height > 0 && children(height - 24)}
    </div>
  );
}

// The room a chart or map leaves for its "Show as table" line.
const detailsLine = 32;
const smallest = 80;

type DrawnProps = {
  visualization: Visualization;
  answer: RunQueryResponse;
  title: string;
  height: number;
  stale: boolean;
};

function Drawn({ visualization, answer, title, height, stale }: DrawnProps) {
  const room = Math.max(height - detailsLine, smallest);
  switch (visualization) {
    case "line": {
      const series = answer.rows.length > 0 ? rollupSeries(answer.rows) : measurementSeries(answer.readings);
      if (series.length === 0) return <Nothing>No Measurements to draw.</Nothing>;
      return (
        <div className="h-full overflow-auto">
          <TimeSeriesChart series={series} label={`${title} chart`} height={room} />
        </div>
      );
    }
    case "stat":
      return <StatView answer={answer} label={title} />;
    case "map": {
      const tracks = locationTracks(answer.readings);
      if (tracks.length === 0) return <Nothing>No Locations to draw.</Nothing>;
      return (
        <div className="h-full overflow-auto">
          <TrackMap tracks={tracks} label={`${title} map`} height={room} stale={stale} />
        </div>
      );
    }
    case "events":
      return <EventsList answer={answer} label={title} />;
    case "table":
      return <AnswerTable answer={answer} label={title} className="max-h-full" />;
  }
}

function Nothing({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground flex h-full items-center justify-center text-sm">{children}</p>;
}

// WidgetError says why a Widget's Query didn't answer, inside the Widget.
function WidgetError({ error }: { error: unknown }) {
  const failed = ConnectError.from(error);
  const problem = queryProblemOf(error);
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm">
      {isRefusal(error) ? (
        <p>You don't have access to these Readings.</p>
      ) : problem ? (
        <p className="text-destructive">
          Line {problem.line}, column {problem.column}: {problem.message}
        </p>
      ) : isTooCostly(error) ? (
        <>
          <p className="text-destructive">Ridr won't run this Query: {failed.rawMessage}</p>
          <p className="text-muted-foreground">Try a shorter range, a rollup or a filter.</p>
        </>
      ) : (
        <p className="text-destructive">{messageFor(failed)}</p>
      )}
    </div>
  );
}
