import type { FeatureCollection, LineString, Point } from "geojson";
import { LngLatBounds, type GeoJSONSource, type GeoJSONSourceDiff, type Map as MapLibre } from "maplibre-gl";
import { fitMaxZoom, fitPadding, trackColor } from "@/components/map/canvas";
import { latestOf, type GeoPolygon, type Track } from "@/components/map/tracks";

// The colours one theme draws Tracks in.
export type TrackLook = {
  // A colour per Track while there are this many or fewer.
  colors: readonly string[];
  // Every Track's colour when there are more, as in a whole fleet.
  fleet: string;
  // The area's outline and fill.
  area: string;
  // Labels, and the halo that keeps them readable over the base map.
  text: string;
  halo: string;
};

// What the map shows of each Track: its path and where it is now, or
// only where it is now.
export type TrackShow = "tracks" | "latest";

const ids = {
  tracks: "ridr-tracks",
  latest: "ridr-latest",
  area: "ridr-area",
} as const;

// What a Track looked like when last sent to the map, so an update sends
// only the Tracks that moved.
type Sent = { count: number; last: number; color: string };

const emptyCollection: FeatureCollection = { type: "FeatureCollection", features: [] };

// TrackLayers owns the map's sources and layers for Tracks and an area.
// install adds them to a freshly loaded style; update then sends only
// what changed (a Track's new positions, a new or gone Track) as a diff,
// so live appends never redraw the whole map.
export class TrackLayers {
  private sent = new Map<string, Sent>();
  private readonly map: MapLibre;

  constructor(map: MapLibre) {
    this.map = map;
  }

  // install adds the sources and layers to a newly loaded style (the first,
  // or the other theme's) and draws everything on them afresh.
  install(look: TrackLook) {
    const map = this.map;
    this.sent.clear();
    map.addSource(ids.area, { type: "geojson", data: emptyCollection });
    map.addSource(ids.tracks, { type: "geojson", data: emptyCollection, promoteId: "id" });
    map.addSource(ids.latest, { type: "geojson", data: emptyCollection, promoteId: "id" });
    map.addLayer({
      id: `${ids.area}-fill`,
      type: "fill",
      source: ids.area,
      paint: { "fill-color": look.area, "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: `${ids.area}-line`,
      type: "line",
      source: ids.area,
      paint: { "line-color": look.area, "line-width": 2 },
    });
    map.addLayer({
      id: ids.tracks,
      type: "line",
      source: ids.tracks,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-opacity": 0.8 },
    });
    map.addLayer({
      id: ids.latest,
      type: "circle",
      source: ids.latest,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 5,
        "circle-stroke-color": look.halo,
        "circle-stroke-width": 1.5,
      },
    });
    map.addLayer({
      id: `${ids.latest}-label`,
      type: "symbol",
      source: ids.latest,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.8],
        "text-optional": true,
      },
      paint: { "text-color": look.text, "text-halo-color": look.halo, "text-halo-width": 1.5 },
    });
  }

  // update sends the Tracks that changed since the last update, and fits
  // the view to them when none of the Tracks shown before remains.
  update(tracks: readonly Track[], look: TrackLook) {
    const tracksDiff: Required<Pick<GeoJSONSourceDiff, "add" | "update" | "remove">> = { add: [], update: [], remove: [] };
    const latestDiff: Required<Pick<GeoJSONSourceDiff, "add" | "update" | "remove">> = { add: [], update: [], remove: [] };
    const fresh = this.sent.size === 0 || !tracks.some((track) => this.sent.has(track.id));
    const seen = new Set<string>();

    tracks.forEach((track, index) => {
      const now = latestOf(track);
      if (!now) return;
      seen.add(track.id);
      const color = trackColor(look, index, tracks.length);
      const before = this.sent.get(track.id);
      if (before && before.count === track.points.length && before.last === now.time && before.color === color) {
        return;
      }
      this.sent.set(track.id, { count: track.points.length, last: now.time, color });
      const path = pathOf(track);
      const position: Point = { type: "Point", coordinates: [now.longitude, now.latitude] };
      if (!before) {
        const properties = { id: track.id, label: track.label, color };
        tracksDiff.add.push({ type: "Feature", id: track.id, properties, geometry: path });
        latestDiff.add.push({ type: "Feature", id: track.id, properties, geometry: position });
        return;
      }
      const recolor = before.color === color ? [] : [{ key: "color", value: color }];
      tracksDiff.update.push({ id: track.id, newGeometry: path, addOrUpdateProperties: recolor });
      latestDiff.update.push({ id: track.id, newGeometry: position, addOrUpdateProperties: recolor });
    });
    for (const id of this.sent.keys()) {
      if (seen.has(id)) continue;
      this.sent.delete(id);
      tracksDiff.remove.push(id);
      latestDiff.remove.push(id);
    }

    void this.source(ids.tracks)?.updateData(tracksDiff);
    void this.source(ids.latest)?.updateData(latestDiff);
    if (fresh) this.fit(tracks);
  }

  // show sets whether paths draw, and dims positions that may be out of
  // date (a Live query reopening).
  show(show: TrackShow, stale: boolean) {
    this.map.setLayoutProperty(ids.tracks, "visibility", show === "tracks" ? "visible" : "none");
    this.map.setPaintProperty(ids.tracks, "line-opacity", stale ? 0.3 : 0.8);
    this.map.setPaintProperty(ids.latest, "circle-opacity", stale ? 0.4 : 1);
  }

  // area draws polygon as the map's area, or none.
  area(polygon: GeoPolygon | null) {
    const data: FeatureCollection =
      polygon && polygon.length >= 3
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [[...polygon, polygon[0]]] },
              },
            ],
          }
        : emptyCollection;
    this.source(ids.area)?.setData(data);
  }

  private fit(tracks: readonly Track[]) {
    const bounds = new LngLatBounds();
    for (const track of tracks) {
      for (const point of track.points) bounds.extend([point.longitude, point.latitude]);
    }
    if (bounds.isEmpty()) return;
    this.map.fitBounds(bounds, { padding: fitPadding, maxZoom: fitMaxZoom, duration: 0 });
  }

  private source(id: string) {
    return this.map.getSource<GeoJSONSource>(id);
  }
}

// pathOf is a Track's path; a Track with one position is a path that
// stays put, so it still has a line to extend.
function pathOf(track: Track): LineString {
  const coordinates = track.points.map((point) => [point.longitude, point.latitude]);
  return { type: "LineString", coordinates: coordinates.length === 1 ? [coordinates[0], coordinates[0]] : coordinates };
}
