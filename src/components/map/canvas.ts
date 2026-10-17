import { palette } from "@/components/charts/palette";
import type { TrackLook, TrackShow } from "@/components/map/track-layers";
import type { GeoPolygon, Track } from "@/components/map/tracks";

// What either base map's canvas is given by TrackMap. The canvas modules
// (MapLibre with OpenFreeMap, or Google Maps) each load in their own
// chunk; TrackMap picks one by configuration and nothing else knows
// which map draws.

export type MapCanvasProps = {
  tracks: readonly Track[];
  show: TrackShow;
  stale: boolean;
  area: GeoPolygon | null;
  theme: "light" | "dark";
  height: number;
  // Set when the user may change the area: its corners drag, and while
  // drawing each click on the map adds one. Each change is sent here.
  onArea?: (polygon: GeoPolygon) => void;
  drawing: boolean;
  // Called with false while the base map or its tiles load, true once the
  // map has drawn.
  onReady: (ready: boolean) => void;
};

export const looks: Record<"light" | "dark", TrackLook> = {
  light: { colors: palette.light, fleet: palette.light[0], area: palette.light[1], text: "#1f1f1d", halo: "#ffffff" },
  dark: { colors: palette.dark, fleet: palette.dark[0], area: palette.dark[1], text: "#e8e7e1", halo: "#0c0c0c" },
};

// Where a map opens before it has anything to show: Helsinki.
export const start = { longitude: 24.94, latitude: 60.17, zoom: 9 };

// Fitting a view to Tracks or an area never zooms in closer than this.
export const fitMaxZoom = 14;
export const fitPadding = 48;

// trackColor is the colour a Track is drawn in: its own while there are
// few enough Tracks, the fleet colour when there are more.
export function trackColor(look: TrackLook, index: number, count: number): string {
  return count <= look.colors.length ? look.colors[index] : look.fleet;
}
