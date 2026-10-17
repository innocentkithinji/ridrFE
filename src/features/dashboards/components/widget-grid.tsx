import ReactGridLayout, { noCompactor, useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { ReactNode } from "react";
import { widgetHandle } from "@/features/dashboards/components/widget-view";
import { gridColumns, gridRowHeight, type WidgetDraft, type WidgetLayout } from "@/features/dashboards/widgets";

// The gap between Widgets, in pixels.
const gap = 12;
// Below this width the grid's 12 columns are too narrow to read, so the
// Widgets stack in one column, in the grid's reading order.
const stackBelow = 640;

type WidgetGridProps = {
  widgets: readonly WidgetDraft[];
  render: (widget: WidgetDraft) => ReactNode;
  // Given in edit mode: Widgets drag by their header and resize from the
  // corner, and each move reports every Widget's new place.
  onMove?: (layouts: Map<string, WidgetLayout>) => void;
};

// WidgetGrid places Widgets on the Dashboard's grid, where their saved
// `layout` puts them: 12 columns, x and y from 0, width and height in
// cells. It wraps react-grid-layout; nothing outside this file knows that.
export function WidgetGrid({ widgets, render, onMove }: WidgetGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const editing = !!onMove;
  const layout: Layout = widgets.map((widget) => ({
    i: widget.key,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.width,
    h: widget.layout.height,
  }));

  return (
    <div ref={containerRef}>
      {mounted && width < stackBelow ? (
        <div className="flex flex-col" style={{ gap }}>
          {widgets.toSorted(byReadingOrder).map((widget) => (
            <div key={widget.key} style={{ height: cellHeight(widget.layout.height) }}>
              {render(widget)}
            </div>
          ))}
        </div>
      ) : (
        mounted && (
          <ReactGridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: gridColumns, rowHeight: gridRowHeight, margin: [gap, gap], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, handle: `.${widgetHandle}`, cancel: "button" }}
            resizeConfig={{ enabled: editing }}
            // Viewing shows the saved layout exactly; editing packs
            // Widgets upward as they move, as people expect.
            compactor={editing ? verticalCompactor : noCompactor}
            onLayoutChange={(next) => onMove?.(layoutsOf(next))}
          >
            {widgets.map((widget) => (
              <div key={widget.key}>{render(widget)}</div>
            ))}
          </ReactGridLayout>
        )
      )}
    </div>
  );
}

function cellHeight(rows: number): number {
  return rows * gridRowHeight + (rows - 1) * gap;
}

function byReadingOrder(a: WidgetDraft, b: WidgetDraft): number {
  return a.layout.y - b.layout.y || a.layout.x - b.layout.x;
}

function layoutsOf(layout: Layout): Map<string, WidgetLayout> {
  return new Map(layout.map((item) => [item.i, { x: item.x, y: item.y, width: item.w, height: item.h }]));
}
