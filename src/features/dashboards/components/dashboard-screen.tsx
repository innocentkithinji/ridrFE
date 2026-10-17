import { Code, ConnectError } from "@connectrpc/connect";
import { DashboardService, type Dashboard, type QueryProblem } from "@ridr/web";
import { Pencil, Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { FormError } from "@/components/form-error";
import { ErrorState, Loading, NotFound, PermissionDenied } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveDashboard, useShareDashboard } from "@/features/dashboards/api/change-dashboard";
import { useDashboard } from "@/features/dashboards/api/get-dashboards";
import { DeleteDashboard, ShareButton } from "@/features/dashboards/components/dashboard-actions";
import { EarlierVersionBanner, VersionHistory } from "@/features/dashboards/components/dashboard-history";
import { WidgetView } from "@/features/dashboards/components/widget-view";
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
// their layout, and edit mode for editors. A `version` other than 0 shows
// that earlier version read-only.
export function DashboardScreen({ dashboardId, version }: { dashboardId: string; version: number }) {
  const dashboard = useDashboard(dashboardId, version);
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
  if (version > 0) return <EarlierVersion dashboard={loaded} />;
  const reload = async () => (await dashboard.refetch()).data?.dashboard;
  return <DashboardView dashboard={loaded} startEditing={startEditing} reload={reload} />;
}

// EarlierVersion shows one earlier version as it was, read-only.
function EarlierVersion({ dashboard }: { dashboard: Dashboard }) {
  const widgets = useMemo(() => draftsOf(dashboard.widgets), [dashboard.widgets]);
  return (
    <div className="flex flex-col gap-4">
      <EarlierVersionBanner dashboard={dashboard} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h1>
        <DashboardFacts dashboard={dashboard} />
      </header>
      <ScopeNote shared={dashboard.shared} />
      <Widgets widgets={widgets} />
    </div>
  );
}

function Widgets({ widgets }: { widgets: WidgetDraft[] }) {
  if (widgets.length === 0) return <p className="text-muted-foreground py-8 text-center text-sm">No widgets.</p>;
  return <WidgetGrid widgets={widgets} render={(widget) => <WidgetView widget={widget} />} />;
}

// Reload fetches the Dashboard's latest version again.
type Reload = () => Promise<Dashboard | undefined>;

// Draft is a Dashboard being edited: kept apart from the saved one until
// a save succeeds, so a failed save loses nothing. `baseVersion` is the
// version the edit started from, kept even when a newer one loads.
type Draft = { name: string; widgets: WidgetDraft[]; baseVersion: number };

// SaveProblem marks the Widget a failed save's QueryProblem was about,
// while its text is still the one that was sent.
type SaveProblem = { key: string; text: string; problem: QueryProblem };

type DashboardViewProps = { dashboard: Dashboard; startEditing: boolean; reload: Reload };

function DashboardView({ dashboard, startEditing, reload }: DashboardViewProps) {
  const saved = useMemo(() => draftsOf(dashboard.widgets), [dashboard.widgets]);
  const edit = (): Draft => ({ name: dashboard.name, widgets: saved, baseVersion: dashboard.version });
  const [draft, setDraft] = useState<Draft | null>(() => (startEditing ? edit() : null));
  const share = useShareDashboard();
  const shareErrorId = useId();

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <DashboardEditor
          dashboard={dashboard}
          draft={draft}
          onChange={setDraft}
          onDone={() => setDraft(null)}
          reload={reload}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h1>
              <DashboardFacts dashboard={dashboard} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Can method={DashboardService.method.listDashboardVersions}>
                <VersionHistory dashboardId={dashboard.id} />
              </Can>
              <ShareButton dashboard={dashboard} share={share} />
              <DeleteDashboard dashboard={dashboard} />
              <Can method={DashboardService.method.saveDashboard}>
                <Button variant="outline" onClick={() => setDraft(edit())}>
                  <Pencil /> Edit
                </Button>
              </Can>
            </div>
          </header>
          <FormError id={shareErrorId} error={share.error} />
          <ScopeNote shared={dashboard.shared} />
          <Widgets widgets={saved} />
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
  reload: Reload;
};

// DashboardEditor is edit mode: rename, add, change, remove, drag and
// resize Widgets, then save them all as a new version.
function DashboardEditor({ dashboard, draft, onChange, onDone, reload }: DashboardEditorProps) {
  const save = useSaveDashboard();
  const [checked, setChecked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);
  const [form, setForm] = useState<{ open: boolean; key: string | null }>({ open: false, key: null });
  const nameId = useId();
  const problemId = useId();

  const editingWidget = draft.widgets.find((widget) => widget.key === form.key) ?? null;
  const problemOf = (widget: WidgetDraft) =>
    saveProblem && saveProblem.key === widget.key && saveProblem.text === widget.text ? saveProblem.problem : null;
  const localProblem = checked ? (nameProblem(draft.name) ?? widgetsProblem(draft.widgets)) : null;
  // A QueryProblem marks its Widget and a conflict has its own banner; any
  // other refusal shows above the grid.
  const otherError = save.error && !queryProblemOf(save.error) && !conflict ? save.error : null;

  const setWidgets = (widgets: WidgetDraft[]) => onChange({ ...draft, widgets });

  // onSave saves the draft as a new version on top of `baseVersion`.
  const onSave = async (baseVersion = draft.baseVersion) => {
    setChecked(true);
    if (nameProblem(draft.name) || widgetsProblem(draft.widgets)) return;
    setSaveProblem(null);
    setConflict(false);
    const sent = draft.widgets;
    try {
      await save.mutateAsync({
        dashboardId: dashboard.id,
        baseVersion,
        name: draft.name.trim(),
        widgets: widgetsOf(sent),
      });
      onDone();
    } catch (error) {
      if (ConnectError.from(error).code === Code.FailedPrecondition) {
        setConflict(true);
        return;
      }
      const problem = queryProblemOf(error);
      const index = widgetIndexOf(problem);
      if (problem && index !== null && sent[index]) {
        setSaveProblem({ key: sent[index].key, text: sent[index].text, problem });
      }
      // Any other refusal shows as the save's error.
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
          <Button onClick={() => void onSave()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>
      {conflict && (
        <ConflictBanner
          busy={save.isPending}
          onReload={() => {
            onDone();
            void reload();
          }}
          onSaveOnTop={async () => {
            const latest = await reload();
            if (latest) await onSave(latest.version);
          }}
        />
      )}
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
            <WidgetView
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

type ConflictBannerProps = { busy: boolean; onReload: () => void; onSaveOnTop: () => Promise<void> };

// ConflictBanner shows when someone saved a newer version while the user
// edited. The edit stays until they choose: reload the newer version and
// lose the edit, or save the edit on top of it.
function ConflictBanner({ busy, onReload, onSaveOnTop }: ConflictBannerProps) {
  return (
    <div
      role="alert"
      className="border-destructive/50 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
    >
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">Someone saved a newer version</p>
        <p className="text-muted-foreground">
          Reload it to see their changes (your edit is lost), or save your edit on top of it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onReload} disabled={busy}>
          Reload
        </Button>
        <Button onClick={() => void onSaveOnTop()} disabled={busy}>
          Save on top
        </Button>
      </div>
    </div>
  );
}
