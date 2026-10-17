import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { palette } from "@/components/charts/palette";
import type { Mode, Playback, Vehicle } from "@/components/map/playback";

// The deck.gl layers that draw a Playback's vehicles, on either base map:
// a top-down silhouette per mode turned to its heading, its label, and
// for the selected vehicle a ring and the trail it has left.

export type VehicleLook = "light" | "dark";

export const vehicleLayerId = "ridr-vehicles";

const iconPx = 30;

// Each mode's colour, from the chart palette so maps and charts agree.
function modeColor(mode: Mode | null, look: VehicleLook): string {
  const colors = palette[look];
  switch (mode) {
    case "rail":
      return colors[6];
    case "tram":
      return colors[3];
    case "subway":
      return colors[7];
    case "bus":
      return colors[2];
    case "ferry":
      return colors[0];
    default:
      return look === "dark" ? "#e8e7e1" : "#1f1f1d";
  }
}

// Plan views, nose toward the top, in a 64-unit box centred on 0,0. Each
// mode has its own outline, so it reads by shape as well as colour: a bus
// short and blunt, a tram long and slim with articulation joints, a metro
// car squared off, a train with a tapered nose, a ferry a hull with a bow.
// Without a mode, an arrow.
const bodies: Record<Mode | "vehicle", { outline: string; detail?: string }> = {
  bus: { outline: "M-11,-20 Q-11,-23 0,-23 Q11,-23 11,-20 L11,20 Q11,23 0,23 Q-11,23 -11,20 Z", detail: "M-7,-16 L7,-16" },
  tram: { outline: "M-7,-27 Q-7,-29 0,-29 Q7,-29 7,-27 L7,27 Q7,29 0,29 Q-7,29 -7,27 Z", detail: "M-7,-9 L7,-9 M-7,9 L7,9" },
  subway: { outline: "M-9,-28 L9,-28 L9,28 L-9,28 Z", detail: "M-9,-22 L9,-22" },
  rail: { outline: "M-8,-18 Q-7,-29 0,-30 Q7,-29 8,-18 L8,29 L-8,29 Z", detail: "M-6,-17 L6,-17" },
  ferry: { outline: "M0,-28 C9,-19 12,-9 12,2 L12,25 L-12,25 L-12,2 C-12,-9 -9,-19 0,-28 Z", detail: "M-8,8 L8,8" },
  vehicle: { outline: "M0,-24 L16,20 L0,11 L-16,20 Z" },
};

function iconUrl(mode: Mode | null, look: VehicleLook): string {
  const body = bodies[mode ?? "vehicle"];
  const edge = look === "dark" ? "#0c0c0c" : "#ffffff";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-32 -32 64 64">` +
    `<path d="${body.outline}" fill="${modeColor(mode, look)}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>` +
    (body.detail ? `<path d="${body.detail}" stroke="${edge}" stroke-width="2" stroke-linecap="round" fill="none"/>` : "") +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const at = (vehicle: Vehicle): [number, number] => [vehicle.longitude, vehicle.latitude];

// Labels show from this zoom in, where vehicles stand apart; further out
// a fleet's labels would pile up. The selected vehicle's always shows.
export const labelMinZoom = 12;

// vehicleLayers draws vehicles as sampled on frame number `frame`; the
// same vehicles array with a new frame redraws only where they are.
export function vehicleLayers(
  playback: Playback,
  vehicles: readonly Vehicle[],
  frame: number,
  selected: string | null,
  look: VehicleLook,
  zoom: number,
): Layer[] {
  const chosen = selected ? playback.current(selected) : undefined;
  const labelled = zoom >= labelMinZoom ? vehicles : chosen ? [chosen] : [];
  const text = rgb(look === "dark" ? "#e8e7e1" : "#1f1f1d");
  const halo = rgb(look === "dark" ? "#0c0c0c" : "#ffffff");
  return [
    new PathLayer<{ path: [number, number][] }>({
      id: "ridr-vehicle-trail",
      data: chosen ? [{ path: playback.trail(chosen.id).map((point) => [point.longitude, point.latitude]) }] : [],
      getPath: (d) => d.path,
      getColor: [...rgb(modeColor(chosen?.mode ?? null, look)), 220],
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
      getLineColor: [...rgb(modeColor(chosen?.mode ?? null, look)), 255],
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
      getIcon: (vehicle) => ({
        id: `${vehicle.mode ?? "vehicle"}-${look}`,
        url: iconUrl(vehicle.mode, look),
        width: 64,
        height: 64,
      }),
      getColor: (vehicle) => [255, 255, 255, vehicle.motion === "no-fix" ? 110 : 255],
      updateTriggers: { getPosition: frame, getAngle: frame, getColor: frame, getIcon: frame },
    }),
    new TextLayer<Vehicle>({
      id: "ridr-vehicle-label",
      data: labelled,
      getPosition: at,
      getText: (vehicle) => vehicle.label,
      characterSet: "auto",
      fontFamily: "Geist Variable, system-ui, sans-serif",
      getSize: 11,
      getColor: text,
      getPixelOffset: [0, iconPx * 0.6],
      getAlignmentBaseline: "top",
      fontSettings: { sdf: true },
      outlineWidth: 2,
      outlineColor: [...halo, 255],
      updateTriggers: { getPosition: frame },
    }),
  ];
}

// layersForVehicles samples a map's vehicles for one frame and draws them.
export function layersForVehicles(
  { playback, glide, selected }: { playback: Playback; glide: boolean; selected: string | null },
  frame: number,
  look: VehicleLook,
  zoom: number,
): Layer[] {
  return vehicleLayers(playback, playback.sample(Date.now(), glide), frame, selected, look, zoom);
}
