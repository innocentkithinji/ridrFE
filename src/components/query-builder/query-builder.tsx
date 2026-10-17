import { ConnectError } from "@connectrpc/connect";
import { QueryService } from "@ridr/web";
import { Code, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { BuilderForm } from "@/components/query-builder/builder-form";
import { useBuilderLists, type BuilderLists } from "@/components/query-builder/lists";
import { builtQueryOf, forSource, queryText, type BuiltQuery, type Source } from "@/components/query-builder/model";
import { QueryEditor, type QueryProblemAt, type QueryVocabulary } from "@/components/query-editor/query-editor";
import { Button } from "@/components/ui/button";
import { useExplainQuery } from "@/lib/api/query";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";
import { unitLabel } from "@/lib/units";
import { useUnitPreferences, useWithUnitPreference } from "@/lib/use-unit-preferences";

// QueryBuilder is where a Query is put together, by picking options or as
// text: the Dashboard Widget editor and Explore share it. Its value is
// always Query text. The builder writes text; text comes back into the
// builder only through ExplainQuery's understood form, and a Query the
// builder can't show stays as text with the reasons, never with parts
// dropped.

export type QueryMode = "builder" | "text";

type QueryBuilderProps = {
  value: string;
  onChange: (text: string) => void;
  // The sources the builder may read: one for a Widget's Visualization,
  // all three in Explore.
  sources: readonly Source[];
  onSubmit?: (text: string) => void;
  problem?: QueryProblemAt | null;
  vocabulary?: QueryVocabulary;
  // Explore runs its text as written, so the builder writes the viewer's
  // Unit preference into it. A Widget leaves it out: each viewer's own is
  // added when the Widget runs.
  writePreference?: boolean;
  onModeChange?: (mode: QueryMode) => void;
};

type State =
  // Asking Ridr how it reads `text`, to fill the builder from it.
  | { kind: "reading"; text: string }
  // `emitted` is the text the builder last gave out (or read in).
  | { kind: "builder"; built: BuiltQuery; emitted: string }
  // `reasons` says why `about` couldn't open in the builder.
  | { kind: "text"; reasons: string[]; about: string };

export function QueryBuilder({
  value,
  onChange,
  sources,
  onSubmit,
  problem,
  vocabulary,
  writePreference = false,
  onModeChange,
}: QueryBuilderProps) {
  const [state, setState] = useState<State>(() =>
    value.trim() === "" ? { kind: "text", reasons: [], about: value } : { kind: "reading", text: value },
  );
  const canExplain = useCan(QueryService.method.explainQuery);
  const lists = useBuilderLists();
  const units = useUnitPreferenceText(lists, writePreference);
  const explain = useExplainQuery(state.kind === "reading" ? state.text : "", {
    enabled: state.kind === "reading" && canExplain,
  });
  const textId = useId();

  // Text set from outside (a link, Back, Explore's Unit picker) refills
  // the builder.
  if (state.kind === "builder" && value !== state.emitted) setState({ kind: "reading", text: value });
  if (state.kind === "reading" && value !== state.text) setState({ kind: "reading", text: value });

  if (state.kind === "reading") {
    const settled = settle(state.text);
    if (settled) setState(settled);
  }

  function settle(text: string): State | null {
    if (text.trim() === "") return { kind: "text", reasons: [], about: text };
    if (!canExplain) {
      return { kind: "text", about: text, reasons: ["You can't ask Ridr how it reads a Query, so the builder can't open one."] };
    }
    if (explain.error) {
      const failed = ConnectError.from(explain.error);
      return { kind: "text", about: text, reasons: [`Ridr can't read this Query: ${failed.rawMessage || messageFor(failed)}`] };
    }
    const query = explain.data?.query;
    if (!query || !lists.catalogReady || !units.ready) return null;
    const read = builtQueryOf(query, { sources, unitFits: (metric, unit) => lists.unitsOf(metric).some((u) => u.code === unit) });
    if (!read.ok) return { kind: "text", about: text, reasons: read.reasons };
    return { kind: "builder", built: units.asDefault(read.built), emitted: text };
  }

  const mode: QueryMode | null = state.kind === "reading" ? null : state.kind;
  useEffect(() => {
    if (mode) onModeChange?.(mode);
  }, [mode, onModeChange]);

  function build(built: BuiltQuery) {
    const text = units.textOf(built);
    setState({ kind: "builder", built, emitted: text });
    onChange(text);
  }

  // A Widget whose Visualization changes reads the source it now draws.
  const outOfSource = state.kind === "builder" && !sources.includes(state.built.source);
  useEffect(() => {
    if (outOfSource && state.kind === "builder") build(forSource(state.built, sources[0]));
    // build and state are read when the source stops fitting, not on each change.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfSource]);

  return (
    <div className="flex flex-col gap-3">
      {state.kind === "reading" ? (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Opening the Query in the builder…
        </p>
      ) : state.kind === "builder" ? (
        <>
          <div role="group" aria-label="Query builder" className="flex flex-col gap-3">
            <BuilderForm
              built={state.built}
              sources={sources}
              lists={lists}
              defaultUnitLabel={units.defaultLabel}
              onChange={build}
            />
          </div>
          <section aria-labelledby={textId} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 id={textId} className="text-xs font-medium">
                Query text
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setState({ kind: "text", reasons: [], about: value })}>
                <Code /> Edit as text
              </Button>
            </div>
            <pre className="bg-muted/50 overflow-x-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {value}
            </pre>
            {problem && (
              <p role="alert" className="text-destructive text-sm">
                {problem.message}
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <QueryEditor value={value} onChange={onChange} onSubmit={onSubmit} problem={problem} vocabulary={vocabulary} />
          <div className="flex flex-wrap items-start justify-between gap-2">
            {state.reasons.length > 0 && state.about === value ? (
              <div role="status" className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                <p className="text-foreground font-medium">This Query stays as text: the builder can't show all of it.</p>
                <ul className="list-disc pl-4">
                  {state.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setState({ kind: "reading", text: value })}>
              <SlidersHorizontal /> Use the builder
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// useUnitPreferenceText decides what the Unit option's default means:
// the viewer's Unit preference for the Metric's Quantity kind.
function useUnitPreferenceText(lists: BuilderLists, writePreference: boolean) {
  const preferences = useUnitPreferences();
  const withPreference = useWithUnitPreference();
  const preferred = (metric: string) => {
    const chosen = preferences.data ?? [];
    if (!metric) return chosen.length === 1 ? chosen[0].unit : "";
    return chosen.find((one) => one.quantityKind === lists.quantityKindOf(metric))?.unit ?? "";
  };
  // The text, with the preference written in when the Query runs as written.
  const textOf = (built: BuiltQuery) => {
    const text = queryText(built);
    if (!writePreference || built.source !== "measurements") return text;
    return withPreference.apply(text, built.metric || undefined);
  };
  return {
    ready: !writePreference || withPreference.ready,
    textOf,
    defaultLabel: (metric: string) => {
      const unit = preferred(metric);
      return unit ? `Your Unit preference (${unitLabel(unit)})` : "As reported";
    },
    // A Unit that is the one the preference would write reads back as the
    // default, so the round trip keeps it the viewer's.
    asDefault: (built: BuiltQuery): BuiltQuery =>
      writePreference && built.unit && built.unit === preferred(built.metric) ? { ...built, unit: "" } : built,
  };
}
