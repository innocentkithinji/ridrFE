import type { GeoPoint, Track } from "@/components/map/tracks";

// Playback turns Tracks that grow as Locations arrive into vehicles that
// move smoothly: each vehicle is shown a little in the past, so there is a reported Location either
// side of the time shown and it can glide between two real reports
// instead of guessing ahead. It knows nothing of maps; a map asks it
// where every vehicle is on each frame it draws.

// Mode is what kind of vehicle a Track is, from its `mode` Tag.
export type Mode = "rail" | "tram" | "subway" | "bus" | "ferry";

// Motion is what a vehicle is known to be doing:
//   en-route  its Locations either side of now, or its last two, differ
//   stopped   two Locations in a row at one place
//   no-fix    nothing reported for noFixAfterMs
//   waiting   too little to tell yet
export type Motion = "en-route" | "stopped" | "no-fix" | "waiting";

// Vehicle is where a vehicle is shown now, and what it is doing.
export type Vehicle = {
  id: string;
  label: string;
  mode: Mode | null;
  longitude: number;
  latitude: number;
  // Degrees clockwise from north, or null before it has moved enough to
  // tell.
  heading: number | null;
  motion: Motion;
  // When its newest Location was reported, in milliseconds since the epoch.
  reportedAt: number;
};

// The fastest each mode could plausibly go, in m/s. A Location further
// from the last than that is placed rather than glided to.
const ceilings: Record<Mode | "unknown", number> = {
  rail: 111, // ~400 km/h
  tram: 28, // ~100 km/h
  subway: 42, // ~150 km/h
  bus: 36, // ~130 km/h
  ferry: 25, // ~90 km/h
  unknown: 56, // ~200 km/h
};

const noFixAfterMs = 90_000;
// A vehicle further behind than this jumps to its newest Location rather
// than crawl through a backlog.
const backlogMs = 90_000;
const minDelayMs = 2_000;
const maxDelayMs = 120_000;
// Under this many metres a step's direction is noise: the last is held.
const headingMinTravelM = 12;
// Locations this close count as one place: GPS wanders a little even
// when a vehicle is still.
const stillWithinM = 2;
// How fast the drawn heading may turn, so vehicles sweep round curves.
const turnDegreesPerSecond = 120;
// The most time one look may turn for, so a long pause isn't banked
// into one sudden turn.
const turnStepMaxS = 0.25;
const keepFixes = 128;
const keepMs = 15 * 60_000;
const keepSamples = 32;
const recentIntervals = 8;

type Entry = {
  id: string;
  label: string;
  mode: Mode | null;
  fixes: GeoPoint[];
  // How long Locations took to arrive after they were reported.
  lags: number[];
  // Whether the first Locations (history, not arrivals) have been taken.
  seeded: boolean;
  shownAt: number;
  heading: number | null;
  headingAt: number;
  // The course into the Location last asked about, by its time, as
  // finding it can look back through many Locations.
  course?: { into: number; value: number | null };
  last?: Vehicle;
};

export class Playback {
  private entries = new Map<string, Entry>();
  // What sample returns: the same array and the same Vehicle objects,
  // moved on, until a vehicle comes or goes, so a map redraws only their
  // positions and headings each frame.
  private vehicles: Vehicle[] = [];
  private changed = true;

  // ingest takes the Tracks as they are now: Locations newer than a
  // vehicle's newest are added, and vehicles whose Track has gone are
  // dropped. Locations that arrive after the first ingest are timed, to
  // learn how far behind live the vehicle must be shown.
  ingest(tracks: readonly Track[], arrivedAt = Date.now()) {
    const seen = new Set<string>();
    for (const track of tracks) {
      seen.add(track.id);
      let entry = this.entries.get(track.id);
      if (!entry) {
        entry = {
          id: track.id,
          label: track.label,
          mode: null,
          fixes: [],
          lags: [],
          seeded: false,
          shownAt: Number.NaN,
          heading: null,
          headingAt: Number.NaN,
        };
        this.entries.set(track.id, entry);
        this.changed = true;
      }
      entry.label = track.label;
      entry.mode = modeOf(track.mode);
      const newest = entry.fixes.at(-1)?.time ?? -Infinity;
      for (const point of track.points) {
        if (point.time <= newest) continue;
        entry.fixes.push(point);
        if (entry.seeded) push(entry.lags, Math.max(0, arrivedAt - point.time), keepSamples);
      }
      entry.seeded = true;
      const oldest = (entry.fixes.at(-1)?.time ?? 0) - keepMs;
      while (entry.fixes.length > keepFixes || (entry.fixes.length > 2 && entry.fixes[0].time < oldest)) {
        entry.fixes.shift();
      }
    }
    for (const id of this.entries.keys()) {
      if (seen.has(id)) continue;
      this.entries.delete(id);
      this.changed = true;
    }
  }

  // sample moves every vehicle on to now and says where each is. With
  // glide false (reduced motion) vehicles step from Location to Location.
  sample(now = Date.now(), glide = true): readonly Vehicle[] {
    for (const entry of this.entries.values()) {
      const first = !entry.last;
      sampleEntry(entry, now, glide);
      if (first && entry.last) this.changed = true;
    }
    if (this.changed) {
      this.vehicles = [...this.entries.values()].flatMap((entry) => (entry.last ? [entry.last] : []));
      this.changed = false;
    }
    return this.vehicles;
  }

  // current is where a vehicle was at the last sample.
  current(id: string): Vehicle | undefined {
    return this.entries.get(id)?.last;
  }

  // travelled is the way a vehicle has come, oldest first, up to where
  // it is shown now.
  travelled(id: string): GeoPoint[] {
    const entry = this.entries.get(id);
    if (!entry?.last) return [];
    const passed = entry.fixes.filter((fix) => fix.time <= entry.shownAt);
    return [...passed, { time: entry.shownAt, latitude: entry.last.latitude, longitude: entry.last.longitude }];
  }
}

function sampleEntry(entry: Entry, now: number, glide: boolean) {
  const { fixes } = entry;
  const newest = fixes.at(-1);
  if (!newest) return;

  // Shown time only moves forward, so a vehicle never steps back.
  const target = now - delayOf(entry);
  if (!Number.isFinite(entry.shownAt)) entry.shownAt = target;
  else if (target - entry.shownAt > backlogMs) entry.shownAt = Math.max(target, newest.time);
  else entry.shownAt = Math.max(entry.shownAt, target);
  const shownAt = entry.shownAt;

  let index = -1;
  for (let i = fixes.length - 1; i >= 0; i--) {
    if (fixes[i].time <= shownAt) {
      index = i;
      break;
    }
  }

  let place: { latitude: number; longitude: number } = fixes[0];
  let motion: Motion = "waiting";
  let course: number | null = null;
  if (index >= 0) {
    const from = fixes[index];
    const to = fixes[index + 1];
    place = from;
    if (to) {
      const metres = distanceM(from, to);
      const seconds = (to.time - from.time) / 1000;
      motion = metres <= stillWithinM ? "stopped" : "en-route";
      course = courseInto(entry, index + 1);
      if (glide && plausible(entry.mode, metres, seconds)) {
        const fraction = (shownAt - from.time) / (to.time - from.time);
        place = {
          latitude: from.latitude + (to.latitude - from.latitude) * fraction,
          longitude: from.longitude + (to.longitude - from.longitude) * fraction,
        };
      }
    } else if (index > 0) {
      // Past its newest Location, waiting for the next: as its last step.
      motion = distanceM(fixes[index - 1], from) <= stillWithinM ? "stopped" : "en-route";
      course = courseInto(entry, index);
    }
  }
  if (now - newest.time > noFixAfterMs) motion = "no-fix";

  entry.heading = turn(entry, course, now, glide);
  entry.headingAt = now;
  const vehicle: Vehicle = {
    id: entry.id,
    label: entry.label,
    mode: entry.mode,
    latitude: place.latitude,
    longitude: place.longitude,
    heading: entry.heading,
    motion,
    reportedAt: newest.time,
  };
  if (entry.last) Object.assign(entry.last, vehicle);
  else entry.last = vehicle;
}

function courseInto(entry: Entry, to: number): number | null {
  const into = entry.fixes[to].time;
  if (entry.course?.into !== into) entry.course = { into, value: courseTo(entry.fixes, to) };
  return entry.course.value;
}

// courseTo is the direction a vehicle came into fixes[to] from: from the
// latest earlier Location at least headingMinTravelM away, so a slow
// vehicle's many short steps still add up to a heading. Null when it
// hasn't come that far.
function courseTo(fixes: readonly GeoPoint[], to: number): number | null {
  for (let i = to - 1; i >= 0; i--) {
    if (distanceM(fixes[i], fixes[to]) >= headingMinTravelM) return courseBetween(fixes[i], fixes[to]);
  }
  return null;
}

// delayOf is how far behind now a vehicle is shown: long enough that its
// next Location has usually arrived, from how late its Locations arrive
// and how often they come. The usual gap between Locations is the median
// of the last few, so one long silence doesn't hold every vehicle back.
function delayOf(entry: Entry): number {
  const intervals: number[] = [];
  const { fixes } = entry;
  for (let i = Math.max(1, fixes.length - recentIntervals); i < fixes.length; i++) {
    intervals.push(fixes[i].time - fixes[i - 1].time);
  }
  const lag = entry.lags.length > 0 ? percentile(entry.lags, 0.9) : 1_000;
  const interval = intervals.length > 0 ? percentile(intervals, 0.5) : 1_000;
  return Math.min(maxDelayMs, Math.max(minDelayMs, lag + interval + 500));
}

// turn moves the drawn heading toward course at a limited rate, holding
// it when there is no course to turn to.
function turn(entry: Entry, course: number | null, now: number, glide: boolean): number | null {
  if (course === null) return entry.heading;
  if (entry.heading === null || !glide || !Number.isFinite(entry.headingAt)) return course;
  const seconds = Math.min(turnStepMaxS, Math.max(0, (now - entry.headingAt) / 1000));
  const allowed = turnDegreesPerSecond * seconds;
  const delta = ((course - entry.heading + 540) % 360) - 180;
  if (Math.abs(delta) <= allowed) return course;
  return (entry.heading + Math.sign(delta) * allowed + 360) % 360;
}

function plausible(mode: Mode | null, metres: number, seconds: number): boolean {
  const ceiling = ceilings[mode ?? "unknown"];
  // Under a second apart, clock resolution swamps the speed.
  if (seconds < 1) return metres <= ceiling;
  return metres / seconds <= ceiling;
}

// modeOf reads a `mode` Tag, accepting the usual names for each mode.
function modeOf(tag: string | undefined): Mode | null {
  switch (tag?.trim().toLowerCase()) {
    case "rail":
    case "train":
      return "rail";
    case "tram":
    case "streetcar":
    case "light_rail":
      return "tram";
    case "subway":
    case "metro":
      return "subway";
    case "bus":
      return "bus";
    case "ferry":
      return "ferry";
    default:
      return null;
  }
}

const metresPerDegree = 111_320;

// distanceM is metres between two positions, flat-earth: exact to well
// under a metre over the distances between a vehicle's reports.
function distanceM(a: Place, b: Place): number {
  const north = (b.latitude - a.latitude) * metresPerDegree;
  const east = (b.longitude - a.longitude) * metresPerDegree * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
}

function courseBetween(a: Place, b: Place): number {
  const north = b.latitude - a.latitude;
  const east = (b.longitude - a.longitude) * Math.cos((a.latitude * Math.PI) / 180);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

type Place = { latitude: number; longitude: number };

function percentile(values: readonly number[], rank: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
}

function push(values: number[], value: number, keep: number) {
  values.push(value);
  if (values.length > keep) values.shift();
}
