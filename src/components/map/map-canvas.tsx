import { MapboxOverlay } from "@deck.gl/mapbox";
import { LngLatBounds, Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef, useState } from "react";
import { fitMaxZoom, fitPadding, looks, runVehicles, start, type MapCanvasProps } from "@/components/map/canvas";
import { TrackLayers } from "@/components/map/track-layers";
import { wrapLongitude, type GeoPolygon } from "@/components/map/tracks";
import { layersForVehicles, vehicleLayerId } from "@/components/map/vehicle-layers";

// MapCanvas is TrackMap's keyless base map, MapLibre with OpenFreeMap
// tiles, used when the app isn't configured for Google Maps. It is in
// its own chunk because MapLibre is large: only screens that show a map
// load it. Nothing outside src/components/map knows MapLibre is used.

setWorkerUrl(workerUrl);

// OpenFreeMap's vector tiles need no key. Positron and Dark are quiet
// base maps, so Tracks stand out on them.
const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export default function MapCanvas(props: MapCanvasProps) {
  const { tracks, show, stale, area, theme, height, onReady, onArea, drawing, vehicles } = props;
  const target = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<{
    map: MapLibre;
    layers: TrackLayers;
    overlay: MapboxOverlay;
    theme: "light" | "dark";
  } | null>(null);
  // What to draw when a style finishes loading, which happens outside React.
  const current = useRef({ tracks, show, stale, area, theme, onReady, onArea, drawing, vehicles });
  useEffect(() => {
    current.current = { tracks, show, stale, area, theme, onReady, onArea, drawing, vehicles };
  });

  // Make the map once; a new theme swaps its style below.
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const first = current.current.theme;
    const map = new MapLibre({
      container: element,
      style: styles[first],
      center: [start.longitude, start.latitude],
      zoom: start.zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const trackLayers = new TrackLayers(map);
    // Vehicles are deck.gl layers on a canvas over the map's. Not drawn
    // into the map's own canvas, as on the Google map: deck.gl's
    // interleaved mode reads MapLibre internals that MapLibre 6 removed.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    let firstLoad = true;
    map.on("style.load", () => {
      const now = current.current;
      trackLayers.install(looks[now.theme]);
      trackLayers.show(now.show, now.stale, !!now.vehicles);
      trackLayers.area(now.area);
      trackLayers.update(now.tracks, looks[now.theme]);
      // With no Tracks to fit, open on the area, as a saved geofence.
      if (firstLoad && now.area && now.area.length > 0 && !now.tracks.some((track) => track.points.length > 0)) {
        const bounds = new LngLatBounds();
        for (const corner of now.area) bounds.extend(corner);
        map.fitBounds(bounds, { padding: fitPadding, maxZoom: fitMaxZoom, duration: 0 });
      }
      firstLoad = false;
      setLayers({ map, layers: trackLayers, overlay, theme: now.theme });
    });
    map.on("click", (event) => {
      const now = current.current;
      if (now.drawing && now.onArea) {
        now.onArea([...(now.area ?? []), [wrapLongitude(event.lngLat.lng), event.lngLat.lat]]);
      } else if (now.vehicles) {
        const picked = overlay.pickObject({ x: event.point.x, y: event.point.y, radius: 8, layerIds: [vehicleLayerId] });
        now.vehicles.onSelect((picked?.object as { id: string } | undefined)?.id ?? null);
      }
    });
    // Drawn once the style and its tiles are in. Not "idle": a map with
    // moving vehicles redraws every frame and is never idle.
    map.on("idle", () => current.current.onReady(true));
    map.on("render", () => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) current.current.onReady(true);
    });
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

  const animated = !!vehicles;
  useEffect(() => {
    if (layers?.theme === theme) layers.layers.show(show, stale, animated);
  }, [layers, show, stale, theme, animated]);

  useEffect(() => {
    if (!layers || !animated) return;
    const stop = runVehicles(
      () => current.current,
      () => layers.map.getZoom(),
      (drawn) => layers.overlay.setProps({ layers: drawn }),
      layersForVehicles,
    );
    return () => {
      stop();
      layers.overlay.setProps({ layers: [] });
    };
  }, [layers, animated]);

  useEffect(() => {
    if (layers?.theme === theme) layers.layers.area(area);
  }, [layers, area, theme]);

  const editable = !!onArea;

  // While drawing, clicks add corners rather than zoom.
  useEffect(() => {
    if (!layers) return;
    layers.map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (drawing) layers.map.doubleClickZoom.disable();
    else layers.map.doubleClickZoom.enable();
  }, [layers, drawing]);

  // Each corner of an area the user may change is a marker: a button
  // named for assistive tech and tests, draggable once drawing is done.
  // A drag redraws the area as it moves and reports it when dropped.
  useEffect(() => {
    if (!layers || !editable || !area) return;
    const corners = area.map((corner, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.setAttribute("aria-label", `Corner ${index + 1}`);
      element.className = "size-3.5 rounded-full border-2 border-white shadow";
      element.style.background = looks[theme].area;
      element.style.cursor = drawing ? "crosshair" : "move";
      const marker = new Marker({ element, draggable: !drawing }).setLngLat(corner).addTo(layers.map);
      return marker;
    });
    const moved = (): GeoPolygon =>
      corners.map((marker) => {
        const { lng, lat } = marker.getLngLat();
        return [wrapLongitude(lng), lat];
      });
    for (const marker of corners) {
      marker.on("drag", () => layers.layers.area(moved()));
      marker.on("dragend", () => current.current.onArea?.(moved()));
    }
    return () => {
      for (const marker of corners) marker.remove();
    };
  }, [layers, area, editable, drawing, theme]);

  return <div ref={target} style={{ height }} className="w-full overflow-hidden rounded-md border" />;
}
