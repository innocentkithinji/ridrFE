import { Map as MapLibre, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef, useState } from "react";
import { palette } from "@/components/charts/palette";
import { TrackLayers, type TrackLook, type TrackShow } from "@/components/map/track-layers";
import type { GeoPolygon, Track } from "@/components/map/tracks";

// MapCanvas is the MapLibre half of TrackMap, in its own chunk because
// MapLibre is large: only screens that show a map load it. Nothing outside
// src/components/map knows MapLibre is used.

setWorkerUrl(workerUrl);

// OpenFreeMap's vector tiles need no key. Positron and Dark are quiet
// base maps, so Tracks stand out on them.
const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

const looks: Record<"light" | "dark", TrackLook> = {
  light: { colors: palette.light, fleet: palette.light[0], area: palette.light[1], text: "#1f1f1d", halo: "#ffffff" },
  dark: { colors: palette.dark, fleet: palette.dark[0], area: palette.dark[1], text: "#e8e7e1", halo: "#0c0c0c" },
};

// Where the map opens before it has anything to show: Helsinki.
const start = { center: [24.94, 60.17] as [number, number], zoom: 9 };

export type MapCanvasProps = {
  tracks: readonly Track[];
  show: TrackShow;
  stale: boolean;
  area: GeoPolygon | null;
  theme: "light" | "dark";
  height: number;
  // Called with false while the base map or its tiles load, true once the
  // map has drawn.
  onReady: (ready: boolean) => void;
};

export default function MapCanvas({ tracks, show, stale, area, theme, height, onReady }: MapCanvasProps) {
  const target = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<{ map: MapLibre; layers: TrackLayers; theme: "light" | "dark" } | null>(null);
  // What to draw when a style finishes loading, which happens outside React.
  const current = useRef({ tracks, show, stale, area, theme, onReady });
  useEffect(() => {
    current.current = { tracks, show, stale, area, theme, onReady };
  });

  // Make the map once; a new theme swaps its style below.
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const first = current.current.theme;
    const map = new MapLibre({
      container: element,
      style: styles[first],
      ...start,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const trackLayers = new TrackLayers(map);
    map.on("style.load", () => {
      const now = current.current;
      trackLayers.install(looks[now.theme]);
      trackLayers.show(now.show, now.stale);
      trackLayers.area(now.area);
      trackLayers.update(now.tracks, looks[now.theme]);
      setLayers({ map, layers: trackLayers, theme: now.theme });
    });
    map.on("idle", () => current.current.onReady(true));
    // Follow the box, not only the window: sidebars and grids resize it.
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(element);
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!layers || layers.theme === theme) return;
    onReady(false);
    layers.map.setStyle(styles[theme], { diff: false });
  }, [layers, theme, onReady]);

  useEffect(() => {
    if (layers?.theme === theme) layers.layers.update(tracks, looks[theme]);
  }, [layers, tracks, theme]);

  useEffect(() => {
    if (layers?.theme === theme) layers.layers.show(show, stale);
  }, [layers, show, stale, theme]);

  useEffect(() => {
    if (layers?.theme === theme) layers.layers.area(area);
  }, [layers, area, theme]);

  return <div ref={target} style={{ height }} className="w-full overflow-hidden rounded-md border" />;
}
