/// <reference types="google.maps" />
import type { Layer } from "@deck.gl/core";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { PathLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import {
  fitMaxZoom,
  fitPadding,
  looks,
  rgb,
  start,
  trackColor,
  type MapCanvasProps,
  type Theme,
} from "@/components/map/canvas";
import { googleMaps } from "@/components/map/google-config";
import type { TrackShow } from "@/components/map/track-layers";
import { latestOf, wrapLongitude, type GeoPoint, type GeoPolygon, type Track } from "@/components/map/tracks";
import { labelLayer, labelMinZoom, pickVehicle, runVehicles } from "@/components/map/vehicle-layers";

// GoogleCanvas is TrackMap's base map when the app is configured for
// Google Maps (ADR 0003): a vector map, in its own chunk with the deck.gl
// layers that draw Tracks and an area over it. Past tiltZoom it tilts into
// 3D, where Google draws buildings; zooming back out flattens it.
//
// Google bills each map it makes, so maps are reused: one that unmounts
// waits in a small pool, and the next canvas in the same theme takes it
// instead of making another. React's development double mount, moving
// between screens and Dashboards re-rendering all reuse a map. Google
// can't change a live map's colour scheme, so a new theme is the one
// change that makes a map.

if (googleMaps) setOptions({ key: googleMaps.key, v: "weekly" });

const libraries = Promise.all([importLibrary("core"), importLibrary("maps"), importLibrary("marker")]);

const tiltZoom = 17;
const tiltDegrees = 60;

// pool holds the maps no canvas shows now, at most poolSize of them.
type Pooled = { map: google.maps.Map; element: HTMLDivElement; theme: Theme };
const pool: Pooled[] = [];
const poolSize = 4;

async function takeMap(theme: Theme): Promise<Pooled & { reused: boolean }> {
  const [{ ColorScheme }, { Map, RenderingType }] = await libraries;
  const index = pool.findIndex((pooled) => pooled.theme === theme);
  if (index >= 0) {
    const [pooled] = pool.splice(index, 1);
    pooled.map.moveCamera({
      center: { lat: start.latitude, lng: start.longitude },
      zoom: start.zoom,
      tilt: 0,
      heading: 0,
    });
    return { ...pooled, reused: true };
  }
  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";
  const map = new Map(element, {
    mapId: googleMaps?.mapId,
    renderingType: RenderingType.VECTOR,
    colorScheme: theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT,
    center: { lat: start.latitude, lng: start.longitude },
    zoom: start.zoom,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    // Scrolling zooms, as on the keyless map, rather than asking for Ctrl.
    gestureHandling: "greedy",
  });
  return { map, element, theme, reused: false };
}

function releaseMap(pooled: Pooled) {
  pooled.element.remove();
  if (pool.length < poolSize) pool.push({ map: pooled.map, element: pooled.element, theme: pooled.theme });
}

// A key Google refuses (wrong, or not allowed on this site) is reported
// here rather than as an error of the map.
const authFailures = new Set<() => void>();
(window as { gm_authFailure?: () => void }).gm_authFailure = () => {
  for (const failed of authFailures) failed();
};

type View = { map: google.maps.Map; overlay: GoogleMapsOverlay; theme: Theme };

export default function GoogleCanvas(props: MapCanvasProps) {
  const { tracks, show, stale, area, theme, height, onArea, drawing, vehicles } = props;
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);
  // What the map's own events need, which happen outside React.
  const current = useRef(props);
  useEffect(() => {
    current.current = props;
  });
  // The Tracks the view was last fitted for, so live appends don't move a
  // view the user has panned.
  const fitted = useRef(new Set<string>());
  // Fits the view to points, once the map is made.
  const fitView = useRef<((points: { latitude: number; longitude: number }[]) => void) | undefined>(undefined);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let taken: Pooled | undefined;
    let overlay: GoogleMapsOverlay | undefined;
    const listeners: google.maps.MapsEventListener[] = [];
    const fail = () => {
      setFailed(true);
      current.current.onReady(true);
    };
    authFailures.add(fail);
    current.current.onReady(false);
    fitted.current = new Set();

    Promise.all([takeMap(theme), libraries])
      .then(([pooled, [{ event }]]) => {
        if (cancelled) {
          releaseMap(pooled);
          return;
        }
        taken = pooled;
        const { map } = pooled;
        element.append(pooled.element);
        // Drawn on deck.gl's own canvas over the map, which follows it as it
        // tilts and turns; drawn into Google's canvas (interleaved) nothing
        // showed.
        overlay = new GoogleMapsOverlay({ interleaved: false, layers: [] });
        overlay.setMap(map);

        // Fitting zooms the map, which must not tilt it on the way.
        let fitting = false;
        let tilted = false;
        listeners.push(
          map.addListener("zoom_changed", () => {
            if (fitting) return;
            const zoom = map.getZoom() ?? 0;
            if (zoom >= tiltZoom && !tilted) {
              tilted = true;
              map.setTilt(tiltDegrees);
            } else if (zoom < tiltZoom && tilted) {
              tilted = false;
              map.setTilt(0);
            }
          }),
          map.addListener("idle", () => current.current.onReady(true)),
          map.addListener("click", (clicked: google.maps.MapMouseEvent) => {
            const now = current.current;
            if (now.drawing && now.onArea && clicked.latLng) {
              now.onArea([...(now.area ?? []), [wrapLongitude(clicked.latLng.lng()), clicked.latLng.lat()]]);
            } else if (now.vehicles && clicked.domEvent instanceof MouseEvent) {
              const box = pooled.element.getBoundingClientRect();
              if (overlay) {
                now.vehicles.onSelect(
                  pickVehicle(overlay, clicked.domEvent.clientX - box.left, clicked.domEvent.clientY - box.top),
                );
              }
            }
          }),
        );
        const fit = (points: { latitude: number; longitude: number }[]) => {
          if (points.length === 0) return;
          const bounds = new google.maps.LatLngBounds();
          for (const point of points) bounds.extend({ lat: point.latitude, lng: point.longitude });
          fitting = true;
          map.fitBounds(bounds, fitPadding);
          event.addListenerOnce(map, "idle", () => {
            if ((map.getZoom() ?? 0) > fitMaxZoom) map.setZoom(fitMaxZoom);
            fitting = false;
          });
        };
        fitView.current = fit;

        // With no Tracks to fit, open on the area, as a saved geofence.
        const now = current.current;
        if (now.area && now.area.length > 0 && !now.tracks.some((track) => track.points.length > 0)) {
          fit(now.area.map(([longitude, latitude]) => ({ latitude, longitude })));
        }
        // A reused map may already have its tiles, so it won't go idle.
        if (pooled.reused) requestAnimationFrame(() => current.current.onReady(true));
        setView({ map, overlay, theme });
      })
      .catch(fail);

    return () => {
      cancelled = true;
      authFailures.delete(fail);
      for (const listener of listeners) listener.remove();
      fitView.current = undefined;
      overlay?.setMap(null);
      overlay?.finalize();
      if (taken) releaseMap(taken);
      setView(null);
    };
  }, [theme]);

  // Fit the view to the Tracks when it first has some, and again only
  // when none of the Tracks it showed remains (a different Query).
  useEffect(() => {
    if (!view) return;
    const shown = tracks.filter((track) => track.points.length > 0);
    if (shown.length === 0) return;
    const fresh = fitted.current.size === 0 || !shown.some((track) => fitted.current.has(track.id));
    fitted.current = new Set(shown.map((track) => track.id));
    if (fresh) fitView.current?.(shown.flatMap((track) => track.points));
  }, [view, tracks]);

  // A corner being dragged redraws the area before it is reported.
  const [dragged, setDragged] = useState<GeoPolygon | null>(null);

  // The Tracks and area, under any vehicles drawn each frame.
  const base = useRef<Layer[]>([]);
  const animated = !!vehicles;
  // Track labels show from labelMinZoom in, as vehicles' do.
  const [labelled, setLabelled] = useState(false);
  useEffect(() => {
    if (!view) return;
    const zoomed = () => setLabelled((view.map.getZoom() ?? 0) >= labelMinZoom);
    zoomed();
    const listener = view.map.addListener("zoom_changed", zoomed);
    return () => listener.remove();
  }, [view]);
  useEffect(() => {
    if (!view) return;
    base.current = trackDeckLayers(tracks, show, stale, dragged ?? area, view.theme, animated, labelled);
    view.overlay.setProps({ layers: base.current });
  }, [view, tracks, show, stale, area, dragged, animated, labelled]);

  useEffect(() => {
    if (!view || !animated) return;
    return runVehicles(
      () => current.current,
      () => view.map.getZoom() ?? 0,
      (drawn) => view.overlay.setProps({ layers: [...base.current, ...drawn] }),
    );
  }, [view, animated]);

  // While drawing, clicks add corners rather than zoom.
  useEffect(() => {
    view?.map.setOptions({ draggableCursor: drawing ? "crosshair" : null, disableDoubleClickZoom: drawing });
  }, [view, drawing]);

  const editable = !!onArea;

  // Each corner of an area the user may change is a marker: a button
  // named for assistive tech and tests, draggable once drawing is done.
  useEffect(() => {
    if (!view || !editable || !area) return;
    let cancelled = false;
    let corners: google.maps.marker.AdvancedMarkerElement[] = [];
    void libraries.then(([, , { AdvancedMarkerElement }]) => {
      if (cancelled) return;
      corners = area.map((corner, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.setAttribute("aria-label", `Corner ${index + 1}`);
        element.className = "size-3.5 rounded-full border-2 border-white shadow";
        element.style.background = looks[theme].area;
        element.style.cursor = drawing ? "crosshair" : "move";
        return new AdvancedMarkerElement({
          map: view.map,
          position: { lat: corner[1], lng: corner[0] },
          content: element,
          gmpDraggable: !drawing,
          anchorLeft: "-50%",
          anchorTop: "-50%",
        });
      });
      const moved = (): GeoPolygon => corners.map((marker) => positionOf(marker));
      for (const marker of corners) {
        marker.addListener("drag", () => setDragged(moved()));
        marker.addListener("dragend", () => {
          setDragged(null);
          current.current.onArea?.(moved());
        });
      }
    });
    return () => {
      cancelled = true;
      for (const marker of corners) marker.map = null;
    };
  }, [view, area, editable, drawing, theme]);

  return (
    <div style={{ height }} className="relative w-full overflow-hidden rounded-md border">
      <div ref={host} className="size-full" />
      {failed && (
        <p role="alert" className="bg-background/90 absolute inset-0 flex items-center justify-center p-4 text-sm">
          Google Maps couldn't load. Check the API key, that it allows this site, and the Map ID.
        </p>
      )}
    </div>
  );
}

// positionOf is where a marker is now, as an area's corner.
function positionOf(marker: google.maps.marker.AdvancedMarkerElement): [longitude: number, latitude: number] {
  const position = marker.position;
  if (!position) return [0, 0];
  if (position instanceof google.maps.LatLng) return [wrapLongitude(position.lng()), position.lat()];
  return [wrapLongitude(position.lng), position.lat];
}

type Shown = { track: Track; now: GeoPoint; color: [number, number, number] };

// trackDeckLayers draws an area, then each Track's path, where it is now and
// its label, as MapLibre's TrackLayers does. Labels show only when
// `labelled` (zoomed in), so a whole fleet's don't pile up. With vehicles,
// which a live map draws moving instead, the latest positions and labels
// are left out.
function trackDeckLayers(
  tracks: readonly Track[],
  show: TrackShow,
  stale: boolean,
  area: GeoPolygon | null,
  theme: Theme,
  vehicles: boolean,
  labelled: boolean,
): Layer[] {
  const look = looks[theme];
  const shown: Shown[] = tracks.flatMap((track, index) => {
    const now = latestOf(track);
    return now ? [{ track, now, color: rgb(trackColor(look, index, tracks.length)) }] : [];
  });
  const where = (d: Shown): [number, number] => [d.now.longitude, d.now.latitude];
  const areaColor = rgb(look.area);
  const halo = rgb(look.halo);
  return [
    new PolygonLayer<GeoPolygon>({
      id: "ridr-area",
      data: area && area.length >= 3 ? [area] : [],
      getPolygon: (polygon) => polygon,
      getFillColor: [...areaColor, 31],
      getLineColor: areaColor,
      lineWidthUnits: "pixels",
      getLineWidth: 2,
    }),
    new PathLayer<Shown>({
      id: "ridr-tracks",
      data: shown,
      visible: show === "tracks",
      getPath: (d) => d.track.points.map((point): [number, number] => [point.longitude, point.latitude]),
      getColor: (d) => [...d.color, stale ? 77 : 204],
      widthUnits: "pixels",
      getWidth: 2.5,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getColor: [stale] },
    }),
    new ScatterplotLayer<Shown>({
      id: "ridr-latest",
      data: shown,
      visible: !vehicles,
      getPosition: where,
      radiusUnits: "pixels",
      getRadius: 5,
      getFillColor: (d) => [...d.color, stale ? 102 : 255],
      stroked: true,
      getLineColor: halo,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      updateTriggers: { getFillColor: [stale] },
    }),
    labelLayer<Shown>({
      id: "ridr-latest-label",
      data: shown,
      visible: !vehicles && labelled,
      getPosition: where,
      getText: (d) => d.track.label,
      offset: 9,
      theme,
    }),
  ];
}
