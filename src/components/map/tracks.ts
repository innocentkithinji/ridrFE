import { timestampMs } from "@bufbuild/protobuf/wkt";
import type { Reading } from "@ridr/web";

// Track is where one thing has been: its positions oldest first, the last
// being where it is now. The map knows nothing of Readings or Queries, so
// anything with times and positions can feed it.
export type Track = {
  // Stable across updates: the map keeps a Track's colour, and appends to
  // it, by its id.
  id: string;
  // What the map and its list call it.
  label: string;
  points: GeoPoint[];
};

// GeoPoint is one position at a time, in milliseconds since the epoch.
export type GeoPoint = { time: number; latitude: number; longitude: number };

// GeoPolygon is an area's outline: [longitude, latitude] corners in order,
// without repeating the first at the end.
export type GeoPolygon = [longitude: number, latitude: number][];

// locationTracks splits a Query's Readings into one Track per Device, in
// the order each first appears, placed at device time as Queries place
// them. Measurements and Events are skipped. A Reading names its Device,
// not its Asset; an Asset's Query (`where asset == …`) gives its Devices.
export function locationTracks(readings: readonly Reading[]): Track[] {
  const byId = new Map<string, Track>();
  for (const reading of readings) {
    if (reading.kind.case !== "location" || !reading.deviceTime) continue;
    const { latitude, longitude } = reading.kind.value;
    const id = `${reading.adapterId}\u0000${reading.deviceId}`;
    let track = byId.get(id);
    if (!track) {
      track = { id, label: reading.deviceId, points: [] };
      byId.set(id, track);
    }
    track.points.push({ time: timestampMs(reading.deviceTime), latitude, longitude });
  }
  return [...byId.values()];
}

// latestOf is where a Track is now.
export function latestOf(track: Track): GeoPoint | undefined {
  return track.points.at(-1);
}

// positionText writes a position as people read it: "60.1480° N, 24.9148° E".
export function positionText({ latitude, longitude }: Pick<GeoPoint, "latitude" | "longitude">): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}`;
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;
  return `${lat}, ${lng}`;
}
