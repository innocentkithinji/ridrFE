import type { RunQueryResponse } from "@ridr/web";
import type { ReactNode } from "react";
import { measurementSeries, rollupSeries } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { TrackMap } from "@/components/map/track-map";
import { locationTracks } from "@/components/map/tracks";
import { AnswerTable } from "@/components/answer-table";

// ResultView is one way Explore draws a Query's answer. The switcher
// offers every view whose `shows` accepts the answer, in this order, and
// opens the first unless the URL names another. Add a view by adding an
// entry to resultViews.
export type ResultView = {
  // Kept in the URL as `view`, so a shared link opens on the same view.
  id: string;
  label: string;
  shows: (answer: RunQueryResponse) => boolean;
  render: (answer: RunQueryResponse) => ReactNode;
};

const chartView: ResultView = {
  id: "chart",
  label: "Chart",
  shows: (answer) => seriesOf(answer).length > 0,
  render: (answer) => <TimeSeriesChart series={seriesOf(answer)} label="Query answer chart" />,
};

const mapView: ResultView = {
  id: "map",
  label: "Map",
  shows: (answer) => answer.readings.some((reading) => reading.kind.case === "location"),
  render: (answer) => (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Locations aren't rolled up: the map draws every Location in the range, so keep the range short. A few
        minutes of a busy fleet is plenty for where it is now.
      </p>
      <TrackMap tracks={locationTracks(answer.readings)} label="Query answer map" />
    </div>
  ),
};

const tableView: ResultView = {
  id: "table",
  label: "Table",
  shows: () => true,
  render: (answer) => <AnswerTable answer={answer} />,
};

export const resultViews: ResultView[] = [chartView, mapView, tableView];

// seriesOf turns an answer into lines: rollup rows over their buckets,
// or Measurement Readings over device time.
function seriesOf(answer: RunQueryResponse) {
  return answer.rows.length > 0 ? rollupSeries(answer.rows) : measurementSeries(answer.readings);
}

// viewsFor lists the views that can draw answer.
export function viewsFor(answer: RunQueryResponse, views: readonly ResultView[] = resultViews) {
  return views.filter((view) => view.shows(answer));
}
