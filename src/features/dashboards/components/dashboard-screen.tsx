import { Code } from "@connectrpc/connect";
import { DashboardService, type Dashboard, type QueryProblem } from "@ridr/web";
import { Pencil, Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { FormError } from "@/components/form-error";
import { ErrorState, Loading, NotFound, PermissionDenied } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveDashboard } from "@/features/dashboards/api/change-dashboard";
import { useDashboard } from "@/features/dashboards/api/get-dashboards";
import { WidgetCard } from "@/features/dashboards/components/widget-card";
import { WidgetFormDialog, type WidgetFields } from "@/features/dashboards/components/widget-form";
import { WidgetGrid } from "@/features/dashboards/components/widget-grid";
import {
  draftsOf,
  nameProblem,
  newWidgetKey,
  placeNew,
  widgetIndexOf,
  widgetLimit,
  widgetsOf,
  widgetsProblem,
  type WidgetDraft,
} from "@/features/dashboards/widgets";
import { isRefusal, queryProblemOf } from "@/lib/errors";
import { formatTime } from "@/lib/format";
import { Can, useIsScoped, useMe } from "@/lib/me";

// Opening a Dashboard with this navigation state starts in edit mode, as
// right after creating one.
export type DashboardLocationState = { editing?: boolean };

// DashboardScreen is /dashboards/:dashboardId: one Dashboard's Widgets at
// their layout, and edit mode for editors.
export function DashboardScreen({ dashboardId }: { dashboardId: string }) {
  const dashboard = useDashboard(dashboardId);
  const startEditing = !!(useLocation().state as DashboardLocationState | null)?.editing;

  if (dashboard.isPending) return <Loading what="the Dashboard" />;
  if (dashboard.error) {
    if (dashboard.error.code === Code.NotFound) {
      return <NotFound what="Dashboard" message="This Dashboard doesn't exist, or isn't yours to see." />;
    }
    if (isRefusal(dashboard.error)) return <PermissionDenied what="this Dashboard" />;
    return <ErrorState error={dashboard.error} />;
  }
  const loaded = dashboard.data.dashboard!;
  return <DashboardView dashboard={loaded} startEditing={startEditing} />;
}

// Draft is a Dashboard being edited: kept apart from the saved one until
// a save succeeds, so a failed save loses nothing.
type Draft = { name: string; widgets: WidgetDraft[] };

// SaveProblem marks the Widget a failed save's QueryProblem was about,
// while its text is still the one that was sent.
type SaveProblem = { key: string; text: string; problem: QueryProblem };

function DashboardView({ dashboard, startEditing }: { dashboard: Dashboard; startEditing: boolean }) {
  const saved = useMemo(() => draftsOf(dashboard.widgets), [dashboard.widgets]);
  const [draft, setDraft] = useState<Draft | null>(() =>
    startEditing ? { name: dashboard.name, widgets: saved } : null,
  );

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <DashboardEditor
          dashboard={dashboard}
          draft={draft}
          onChange={setDraft}
          onDone={() => setDraft(null)}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h1>
              <DashboardFacts dashboard={dashboard} />
            </div>
            {/* #22 adds version history, Share (owner only) and Delete here. */}
            <Can method={DashboardService.method.saveDashboard}>
              <Button variant="outline" onClick={() => setDraft({ name: dashboard.name, widgets: saved })}>
                <Pencil /> Edit
              </Button>
            </Can>
          </header>
          <ScopeNote shared={dashboard.shared} />
          {saved.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No widgets.</p>
          ) : (
            <WidgetGrid widgets={saved} render={(widget) => <WidgetCard widget={widget} />} />
          )}
        </>
      )}
    </div>
  );
}

function DashboardFacts({ dashboard }: { dashboard: Dashboard }) {
  const me = useMe();
  const owner = dashboard.ownerId === me.userId ? "you" : dashboard.ownerId;
  return (
    <p className="text-muted-foreground text-sm">
      {dashboard.shared ? "Shared with the Organisation" : "Private"} · owned by {owner} · version{" "}
      {dashboard.version}, saved {formatTime(dashboard.savedAt)} by {dashboard.savedBy}
    </p>
  );
}

// ScopeNote tells a scoped user why a shared Dashboard may show them
// different numbers than others see.
function ScopeNote({ shared }: { shared: boolean }) {
  if (!useIsScoped() || !shared) return null;
  return (
    <p className="text-muted-foreground text-sm">
      Widgets show only Readings of Assets in your Scope, so others may see different numbers here.
    </p>
  );
}

type DashboardEditorProps = {
  dashboard: Dashboard;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onDone: () => void;
};

// DashboardEditor is edit mode: rename, add, change, remove, drag and
// resize Widgets, then save them all as a new version.
function DashboardEditor({ dashboard, draft, onChange, onDone }: DashboardEditorProps) {
  const save = useSaveDashboard();
  const [checked, setChecked] = useState(false);
  const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);
  const [form, setForm] = useState<{ open: boolean; key: string | null }>({ open: false, key: null });
  const nameId = useId();
  const problemId = useId();

  const editingWidget = draft.widgets.find((widget) => widget.key === form.key) ?? null;
  const problemOf = (widget: WidgetDraft) =>
    saveProblem && saveProblem.key === widget.key && saveProblem.text === widget.text ? saveProblem.problem : null;
  const localProblem = checked ? (nameProblem(draft.name) ?? widgetsProblem(draft.widgets)) : null;
  // A QueryProblem marks its Widget; any other refusal shows above the grid.
  const otherError = save.error && !queryProblemOf(save.error) ? save.error : null;

  const setWidgets = (widgets: WidgetDraft[]) => onChange({ ...draft, widgets });

  const onSave = async () => {
    setChecked(true);
    if (nameProblem(draft.name) || widgetsProblem(draft.widgets)) return;
    setSaveProblem(null);
    const sent = draft.widgets;
    try {
      await save.mutateAsync({
        dashboardId: dashboard.id,
        baseVersion: dashboard.version,
        name: draft.name.trim(),
        widgets: widgetsOf(sent),
      });
      onDone();
    } catch (error) {
      const problem = queryProblemOf(error);
      const index = widgetIndexOf(problem);
      if (problem && index !== null && sent[index]) {
        setSaveProblem({ key: sent[index].key, text: sent[index].text, problem });
      }
      // Any other refusal shows as the save's error. FailedPrecondition
      // (someone saved a newer version) gets its conflict banner in #22.
    }
  };

  const onWidgetDone = (fields: WidgetFields) => {
    if (editingWidget) {
      setWidgets(
        draft.widgets.map((widget) =>
          widget.key === editingWidget.key
            ? {
                ...widget,
                ...fields,
                understood: fields.text === widget.text ? widget.understood : undefined,
              }
            : widget,
        ),
      );
    } else {
      const added: WidgetDraft = {
        key: newWidgetKey(),
        ...fields,
        layout: placeNew(draft.widgets, fields.visualization),
      };
      setWidgets([...draft.widgets, added]);
    }
    setForm({ open: false, key: null });
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h1>
          <label htmlFor={nameId} className="text-sm font-medium">
            Name
          </label>
          <Input
            id={nameId}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            aria-invalid={!!localProblem}
            aria-describedby={localProblem ? problemId : undefined}
            className="max-w-md"
          />
          {localProblem && (
            <p id={problemId} role="alert" className="text-destructive text-sm">
              {localProblem}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setForm({ open: true, key: null })}
            disabled={draft.widgets.length >= widgetLimit}
          >
            <Plus /> Add a widget
          </Button>
          <Button variant="outline" onClick={onDone} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>
      <FormError id={`${problemId}-save`} error={otherError} />
      {draft.widgets.length >= widgetLimit && (
        <p className="text-muted-foreground text-sm">A Dashboard holds at most {widgetLimit} widgets.</p>
      )}
      {draft.widgets.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No widgets.</p>
      ) : (
        <WidgetGrid
          widgets={draft.widgets}
          onMove={(layouts) =>
            setWidgets(draft.widgets.map((widget) => ({ ...widget, layout: layouts.get(widget.key) ?? widget.layout })))
          }
          render={(widget) => (
            <WidgetCard
              widget={widget}
              problem={problemOf(widget)}
              onEdit={() => setForm({ open: true, key: widget.key })}
              onRemove={() => setWidgets(draft.widgets.filter((one) => one.key !== widget.key))}
            />
          )}
        />
      )}
      <WidgetFormDialog
        open={form.open}
        onOpenChange={(open) => setForm(open ? form : { open: false, key: null })}
        editing={editingWidget}
        problem={editingWidget ? problemOf(editingWidget) : null}
        onDone={onWidgetDone}
      />
    </>
  );
}
