import type { Query, QueryProblem, Widget } from "@ridr/web";

// How the app reads and writes a Dashboard's Widgets. Ridr keeps a
// Widget's `visualization` as given; these are the app's words for it.

export const visualizations = [
  { id: "line", label: "Line", says: "Measurements over time" },
  { id: "stat", label: "Stat", says: "the latest or summary value" },
  { id: "table", label: "Table", says: "every Reading or row" },
  { id: "map", label: "Map", says: "Locations" },
  { id: "events", label: "Events", says: "a list of Events" },
] as const;

export type Visualization = (typeof visualizations)[number]["id"];

// sourceOf is what a Visualization draws: Locations on a map, Events in a
// list, Measurements otherwise. The query builder reads only that source.
export function sourceOf(visualization: Visualization): "measurements" | "locations" | "events" {
  if (visualization === "map") return "locations";
  if (visualization === "events") return "events";
  return "measurements";
}

// Starting points for a new Widget: each opens the query builder filled in.
export const templates = [
  {
    id: "fleet-map",
    label: "Live map of a fleet",
    says: "Where each Device is now, and where it went in the last 2 minutes.",
    fields: { title: "Fleet map", visualization: "map", text: "locations\n| range last 2m" },
  },
  {
    id: "metric-over-time",
    label: "One Metric over time",
    says: "A Metric's average every 5 minutes, one line per Device.",
    fields: {
      title: "Temperature over time",
      visualization: "line",
      text: "measurements\n| where metric == temperature\n| range last 6h\n| rollup avg every 5m by device",
    },
  },
  {
    id: "latest-value",
    label: "Latest value",
    says: "The last value of a Metric in the past hour, per Device.",
    fields: {
      title: "Latest temperature",
      visualization: "stat",
      text: "measurements\n| where metric == temperature\n| range last 1h\n| rollup last every all by device",
    },
  },
  {
    id: "recent-events",
    label: "Recent events",
    says: "Every Event of the last 24 hours, newest first.",
    fields: { title: "Recent events", visualization: "events", text: "events\n| range last 24h" },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  says: string;
  fields: { title: string; visualization: Visualization; text: string };
}[];

// visualizationOf reads a saved Widget's visualization; one this app
// doesn't know (saved by another client) draws as a table.
export function visualizationOf(saved: string): Visualization {
  return visualizations.find((one) => one.id === saved)?.id ?? "table";
}

// The grid Widgets sit on: 12 columns of rows this tall, in pixels.
export const gridColumns = 12;
export const gridRowHeight = 72;

// WidgetLayout is a Widget's place on the grid, in cells.
export type WidgetLayout = { x: number; y: number; width: number; height: number };

// WidgetDraft is a Widget as the editor holds it. `key` tells Widgets
// apart while editing (titles may repeat); it is never saved.
export type WidgetDraft = {
  key: string;
  title: string;
  visualization: Visualization;
  text: string;
  // The JSON form Ridr filled in when the Widget was saved; undefined for
  // a Widget added or changed since, until it is saved.
  understood?: Query;
  layout: WidgetLayout;
};

let nextKey = 0;
export function newWidgetKey(): string {
  nextKey += 1;
  return `widget-${nextKey}`;
}

// draftsOf turns a Dashboard's saved Widgets into drafts.
export function draftsOf(widgets: readonly Widget[]): WidgetDraft[] {
  return widgets.map((widget) => ({
    key: newWidgetKey(),
    title: widget.title,
    visualization: visualizationOf(widget.visualization),
    text: widget.query?.text ?? "",
    understood: widget.query?.query,
    layout: {
      x: widget.layout?.x ?? 0,
      y: widget.layout?.y ?? 0,
      width: Math.max(widget.layout?.width ?? 1, 1),
      height: Math.max(widget.layout?.height ?? 1, 1),
    },
  }));
}

// widgetsOf turns drafts into the Widgets a save sends: the text only,
// which Ridr compiles and fills the JSON form from.
export function widgetsOf(drafts: readonly WidgetDraft[]) {
  return drafts.map((draft) => ({
    title: draft.title,
    visualization: draft.visualization,
    query: { text: draft.text },
    layout: { ...draft.layout },
  }));
}

// The size a new Widget starts at, by what it draws.
const startSize: Record<Visualization, Pick<WidgetLayout, "width" | "height">> = {
  line: { width: 6, height: 4 },
  stat: { width: 3, height: 2 },
  table: { width: 6, height: 4 },
  map: { width: 6, height: 5 },
  events: { width: 4, height: 4 },
};

// placeNew finds a place for a new Widget: beside the last row's Widgets
// when it fits, else below everything.
export function placeNew(drafts: readonly WidgetDraft[], visualization: Visualization): WidgetLayout {
  const size = startSize[visualization];
  const bottom = Math.max(0, ...drafts.map((d) => d.layout.y + d.layout.height));
  const lastRowY = Math.max(0, ...drafts.map((d) => d.layout.y));
  const lastRow = drafts.filter((d) => d.layout.y === lastRowY);
  const right = Math.max(0, ...lastRow.map((d) => d.layout.x + d.layout.width));
  if (drafts.length > 0 && right + size.width <= gridColumns) {
    return { x: right, y: lastRowY, ...size };
  }
  return { x: 0, y: bottom, ...size };
}

// Ridr's limits on a Dashboard, checked before sending.
export const nameLimit = 200;
export const widgetLimit = 100;

// nameProblem says what is wrong with a Dashboard name, or null.
export function nameProblem(name: string): string | null {
  if (name.trim() === "") return "Give the Dashboard a name.";
  if ([...name].length > nameLimit) return `A name is at most ${nameLimit} characters.`;
  return null;
}

// widgetsProblem says what is wrong with a Dashboard's Widgets, or null.
export function widgetsProblem(drafts: readonly WidgetDraft[]): string | null {
  if (drafts.length > widgetLimit) return `A Dashboard holds at most ${widgetLimit} widgets.`;
  return null;
}

// widgetIndexOf reads which Widget a save's QueryProblem is about, from
// its path ("widgets[2].query.text"), or null when it names none.
export function widgetIndexOf(problem: QueryProblem | null): number | null {
  const match = problem ? /^widgets\[(\d+)\]\.query/.exec(problem.path) : null;
  return match ? Number(match[1]) : null;
}
