# Dashboards

Saved layouts of widgets, each backed by a Query. Ridr stores,
validates and versions them; the app draws them. A Dashboard is
private to its owner until they share it with the Organisation, and
every save is a new version, so nothing is lost. Words in capitals are
from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/dashboards` | the user's own Dashboards and every shared one, by name |
| `/dashboards/:dashboardId` | one Dashboard's widgets, edit mode, version history |
| `/dashboards/:dashboardId?version=N` | an earlier version, read-only, with "Restore" |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useDashboards` | `DashboardService/ListDashboards {}` | method key |
| `useDashboard(id, version)` | `DashboardService/GetDashboard {dashboardId, version}` (0 = latest) | method key + request |
| `useDashboardVersions(id)` | `DashboardService/ListDashboardVersions {dashboardId}` | method key + request |
| `useWidgetResult(widget)` | `QueryService/RunQuery {form: {case: "text", value: widget.query.text}}` | method key + request |
| `useLiveQuery(text)` (live widgets) | Live query with the widget's text | `QueryService/RunQuery` with that text |
| `useExplainQuery(text)` (editor) | `QueryService/ExplainQuery` | method key + request |

- Listings leave out `widgets`; open a Dashboard with `GetDashboard`.
- A widget has a `title`, a `visualization` string Ridr keeps as given
  (pick your own vocabulary: `line`, `table`, `map`...), a `query` with
  both `text` and the JSON form filled in, and a grid `layout`
  (`x`, `y` from 0; `width`, `height` at least 1).
- Each widget runs its own query, so one slow or failing widget shows
  its own state while the rest render.
- Show "Share" only to the owner: compare `ownerId` with `GetMe`'s
  `userId`.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useCreateDashboard` | `DashboardService/CreateDashboard {name, widgets}` | method key `ListDashboards` |
| `useSaveDashboard` | `DashboardService/SaveDashboard {dashboardId, baseVersion, name, widgets}` | service key `DashboardService` |
| `useRestoreDashboardVersion` | `DashboardService/RestoreDashboardVersion {dashboardId, version}` | service key `DashboardService` |
| `useShareDashboard` | `DashboardService/ShareDashboard {dashboardId, shared}` | service key `DashboardService` |
| `useDeleteDashboard` | `DashboardService/DeleteDashboard {dashboardId}` | method key `ListDashboards`; then navigate to `/dashboards` |

- **Validation.** A name is 1 to 200 characters; at most 100 widgets.
  Every widget's query must be valid for the saver: a bad one is
  `InvalidArgument` with a `QueryProblem` whose `path` starts
  `widgets[i].query` (then `.text`, with `line`/`column`, or the JSON
  form's field). Mark widget `i` in the editor.
- **Conflicts.** Send the version the user edited as `baseVersion`.
  When someone saved a newer one meanwhile, the save is
  `FailedPrecondition`: keep the user's edit, show "Someone saved a
  newer version", and offer to reload it (their edit is then lost) or
  save again on top of it by sending the new `baseVersion`.
- **Delete** removes every version. A Dashboard the user can't see is
  `NotFound`. After a delete, drop the detail's cache entries with
  `removeQueries` on the method keys `GetDashboard` and
  `ListDashboardVersions` for that ID, so nothing refetches a
  Dashboard that is gone.

## Live updates

Widgets showing a range that ends now may stream: use `useLiveQuery`
for widgets without a rollup, and refetch rollup widgets on an
interval matching their bucket (every 60 s for `every 1m`), since
Live queries never recompute `rows`. Nothing streams Dashboard changes made
by others; the conflict rule above catches them at save time.

## Permissions

| Control | Needs |
|---|---|
| Route, list, detail | `DashboardService/ListDashboards`, `DashboardService/GetDashboard` |
| Version history | `DashboardService/ListDashboardVersions` |
| Create | `DashboardService/CreateDashboard` (editor and up) |
| Edit, save | `DashboardService/SaveDashboard` (editor and up) |
| Restore | `DashboardService/RestoreDashboardVersion` (editor and up) |
| Share or make private | `DashboardService/ShareDashboard`, and owning it |
| Delete | `DashboardService/DeleteDashboard` (editor and up) |
| Widgets | `QueryService/RunQuery` |

Editors may change and delete their own Dashboards and every shared
one. A scoped user's widgets show only their Scope's Readings, so the
same shared Dashboard can show different numbers to different users.

## States

| State | Shows |
|---|---|
| Loading | `Loading` for the list; per-widget spinners on a Dashboard |
| Empty list | "No Dashboards yet." with "Create" for editors |
| Empty Dashboard | "No widgets." with "Add a widget" in edit mode |
| Widget empty or failing | inside the widget: "No Readings match." or the error's message; a `ResourceExhausted` widget suggests a shorter range |
| Not found | "This Dashboard doesn't exist, or isn't yours to see." |
| Save conflict | the conflict banner above |
| Earlier version | read-only banner "Version N of M" with "Restore" for editors |
| Scoped user | the scope note on shared Dashboards |
| Permission denied | `PermissionDenied`; no link |

## Done when

- The list shows own and shared Dashboards with owner, shared flag and
  last save.
- A Dashboard draws every widget at its layout, each with its own
  loading, empty and error state; live widgets update.
- An editor can create, edit, save, restore, share (owner only) and
  delete; a stale save shows the conflict and loses nothing.
- Version history lists every version and opens each read-only.
