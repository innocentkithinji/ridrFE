import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { palette } from "@/components/charts/palette";
import { looks, rgb, type MapVehicles, type Theme } from "@/components/map/canvas";
import type { Mode, Playback, Vehicle } from "@/components/map/playback";

// The deck.gl layers that draw a Playback's vehicles, on either base map:
// a top-down silhouette per Mode turned to its heading, its label, and
// for the selected vehicle a ring and the way it has come.

const vehicleLayerId = "ridr-vehicles";

const iconPx = 30;

// Labels show from this zoom in, where vehicles stand apart; further out
// a fleet's labels would pile up. The selected vehicle's always shows.
export const labelMinZoom = 12;

// How each Mode is drawn: its colour, from the chart palette so maps and
// charts agree, and a plan view, nose toward the top, in a 64-unit box
// centred on 0,0. Each outline differs, so a Mode reads by shape as well
// as colour: a bus short and blunt, a tram long and slim with
// articulation joints, a metro car squared off, a train with a tapered
// nose, a ferry a hull with a bow. Without a Mode, an arrow in the
// theme's text colour.
const drawn: Record<Mode, { slot: number; outline: string; detail: string }> & {
  vehicle: { outline: string };
} = {
  bus: {
    slot: 2,
    outline: "M-11,-20 Q-11,-23 0,-23 Q11,-23 11,-20 L11,20 Q11,23 0,23 Q-11,23 -11,20 Z",
    detail: "M-7,-16 L7,-16",
  },
  tram: {
    slot: 3,
    outline: "M-7,-27 Q-7,-29 0,-29 Q7,-29 7,-27 L7,27 Q7,29 0,29 Q-7,29 -7,27 Z",
    detail: "M-7,-9 L7,-9 M-7,9 L7,9",
  },
  subway: { slot: 7, outline: "M-9,-28 L9,-28 L9,28 L-9,28 Z", detail: "M-9,-22 L9,-22" },
  rail: { slot: 6, outline: "M-8,-18 Q-7,-29 0,-30 Q7,-29 8,-18 L8,29 L-8,29 Z", detail: "M-6,-17 L6,-17" },
  ferry: {
    slot: 0,
    outline: "M0,-28 C9,-19 12,-9 12,2 L12,25 L-12,25 L-12,2 C-12,-9 -9,-19 0,-28 Z",
    detail: "M-8,8 L8,8",
  },
  vehicle: { outline: "M0,-24 L16,20 L0,11 L-16,20 Z" },
};

function modeColor(mode: Mode | null, theme: Theme): string {
  return mode ? palette[theme][drawn[mode].slot] : looks[theme].text;
}

type Icon = { id: string; url: string; width: number; height: number };

// Icons are made once per Mode and theme, not on every frame.
const icons = new Map<string, Icon>();

function iconOf(mode: Mode | null, theme: Theme): Icon {
  const id = `${mode ?? "vehicle"}-${theme}`;
  let icon = icons.get(id);
  if (!icon) {
    const outline = mode ? drawn[mode].outline : drawn.vehicle.outline;
    const detail = mode ? drawn[mode].detail : undefined;
    const edge = looks[theme].halo;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-32 -32 64 64">` +
      `<path d="${outline}" fill="${modeColor(mode, theme)}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>` +
      (detail ? `<path d="${detail}" stroke="${edge}" stroke-width="2" stroke-linecap="round" fill="none"/>` : "") +
      `</svg>`;
    icon = { id, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: 64, height: 64 };
    icons.set(id, icon);
  }
  return icon;
}

const at = (vehicle: Vehicle): [number, number] => [vehicle.longitude, vehicle.latitude];

// vehicleLayers draws vehicles as sampled on frame number `frame`; the
// same vehicles array with a new frame redraws only where they are.
function vehicleLayers(
  playback: Playback,
  vehicles: readonly Vehicle[],
  frame: number,
  selected: string | null,
  theme: Theme,
  zoom: number,
): Layer[] {
  const chosen = selected ? playback.current(selected) : undefined;
  const labelled = zoom >= labelMinZoom ? vehicles : chosen ? [chosen] : [];
  const chosenColor = rgb(modeColor(chosen?.mode ?? null, theme));
  return [
    new PathLayer<{ path: [number, number][] }>({
      id: "ridr-vehicle-travelled",
      data: chosen ? [{ path: playback.travelled(chosen.id).map((point) => [point.longitude, point.latitude]) }] : [],
      getPath: (d) => d.path,
      getColor: [...chosenColor, 220],
      widthUnits: "pixels",
      getWidth: 3,
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getPath: frame },
    }),
    new ScatterplotLayer<Vehicle>({
      id: "ridr-vehicle-selected",
      data: chosen ? [chosen] : [],
      getPosition: at,
      radiusUnits: "pixels",
      getRadius: iconPx * 0.65,
      filled: false,
      stroked: true,
      getLineColor: [...chosenColor, 255],
      lineWidthUnits: "pixels",
      getLineWidth: 2.5,
      updateTriggers: { getPosition: frame },
    }),
    new IconLayer<Vehicle>({
      id: vehicleLayerId,
      data: vehicles,
      pickable: true,
      billboard: false,
      sizeUnits: "pixels",
      getSize: iconPx,
      getPosition: at,
      getAngle: (vehicle) => -(vehicle.heading ?? 0),
      getIcon: (vehicle) => iconOf(vehicle.mode, theme),
      getColor: (vehicle) => [255, 255, 255, vehicle.motion === "no-fix" ? 110 : 255],
      updateTriggers: { getPosition: frame, getAngle: frame, getColor: frame, getIcon: frame },
    }),
    labelLayer<Vehicle>({
      id: "ridr-vehicle-label",
      data: labelled,
      getPosition: at,
      getText: (vehicle) => vehicle.label,
      offset: iconPx * 0.6,
      theme,
      updateTriggers: { getPosition: frame },
    }),
  ];
}

// labelLayer draws labels under points in the app's font, haloed so they
// read over any base map; Track and vehicle labels look the same.
export function labelLayer<D>(props: {
  id: string;
  data: readonly D[];
  getPosition: (d: D) => [number, number];
  getText: (d: D) => string;
  offset: number;
  theme: Theme;
  visible?: boolean;
  updateTriggers?: Record<string, unknown>;
}): Layer {
  const { offset, theme, ...rest } = props;
  return new TextLayer<D>({
    ...rest,
    characterSet: "auto",
    fontFamily: "Geist Variable, system-ui, sans-serif",
    getSize: 11,
    getColor: rgb(looks[theme].text),
    getPixelOffset: [0, offset],
    getAlignmentBaseline: "top",
    fontSettings: { sdf: true },
    outlineWidth: 2,
    outlineColor: [...rgb(looks[theme].halo), 255],
  });
}

// pickVehicle is the id of the vehicle drawn at x, y on the map, if any.
export function pickVehicle(
  overlay: { pickObject: (options: { x: number; y: number; radius: number; layerIds: string[] }) => unknown },
  x: number,
  y: number,
): string | null {
  const picked = overlay.pickObject({ x, y, radius: 8, layerIds: [vehicleLayerId] }) as
    | { object?: Vehicle }
    | null;
  return picked?.object?.id ?? null;
}

// runVehicles samples and draws a map's vehicles on every animation
// frame, handing draw the layers for each, until the returned function
// stops it. The browser pauses animation frames in a hidden tab, so a
// hidden map costs nothing.
export function runVehicles(
  get: () => { vehicles?: MapVehicles; theme: Theme },
  zoom: () => number,
  draw: (layers: Layer[]) => void,
): () => void {
  let frame = 0;
  let request = 0;
  const step = () => {
    const { vehicles, theme } = get();
    if (vehicles) {
      const { playback, glide, selected } = vehicles;
      draw(vehicleLayers(playback, playback.sample(Date.now(), glide), frame++, selected, theme, zoom()));
    }
    request = requestAnimationFrame(step);
  };
  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}
