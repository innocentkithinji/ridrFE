import { lazy, Suspense, useState } from "react";
import type { TrackShow } from "@/components/map/track-layers";
import { latestOf, positionText, type GeoPolygon, type Track } from "@/components/map/tracks";
import { useTheme } from "@/lib/theme";

// TrackMap draws Tracks on a map of the world, in the app's light or dark
// theme, with a list of where each Track is now for assistive tech and
// for reading exact positions.
//
// Appending is cheap: pass new `tracks` arrays as positions arrive and the
// map sends only the Tracks that changed; it never rebuilds. It fits its
// view to the Tracks when it first has some, and again only when none of
// the Tracks it showed remains (a different Query), so live appends don't
// move a view the user has panned.
//
// The map library loads in its own chunk the first time a TrackMap
// renders; screens without a map never load it.

export type TrackMapProps = {
  tracks: readonly Track[];
  // Names the figure for assistive tech, as in "Fleet now".
  label: string;
  // "tracks" draws each Track's path and where it is now; "latest" only
  // where each is now, as Home's fleet map does.
  show?: TrackShow;
  // Dims the positions, as when a Live query is reopening and they may be
  // out of date.
  stale?: boolean;
  // An area drawn over the Tracks, such as a Rule's geofence.
  area?: MapArea;
  height?: number;
};

// MapArea is a polygon on the map. Read-only for now: Rules (#26) will
// pass `onChange` to let the user draw a polygon, or drag its corners,
// and hear each change.
export type MapArea = {
  polygon: GeoPolygon | null;
  onChange?: (polygon: GeoPolygon | null) => void;
};

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

export function TrackMap({ tracks, label, show = "tracks", stale = false, area, height = 360 }: TrackMapProps) {
  const { resolved: theme } = useTheme();
  const [ready, setReady] = useState(false);
  const [listed, setListed] = useState(false);

  return (
    <figure aria-label={label} aria-busy={!ready} className="flex flex-col gap-2">
      <Suspense fallback={<div style={{ height }} className="bg-muted w-full animate-pulse rounded-md border" />}>
        <MapCanvas
          tracks={tracks}
          show={show}
          stale={stale}
          area={area?.polygon ?? null}
          theme={theme}
          height={height}
          onReady={setReady}
        />
      </Suspense>
      <details className="text-sm" onToggle={(event) => setListed(event.currentTarget.open)}>
        <summary className="text-muted-foreground cursor-pointer">Show as list</summary>
        {listed && <LatestList tracks={tracks} />}
      </details>
    </figure>
  );
}

// LatestList is where each Track is now, newest first.
function LatestList({ tracks }: { tracks: readonly Track[] }) {
  const latest = tracks
    .flatMap((track) => {
      const now = latestOf(track);
      return now ? [{ track, now }] : [];
    })
    .toSorted((a, b) => b.now.time - a.now.time);
  return (
    <ul aria-label="Latest positions" className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
      {latest.map(({ track, now }) => (
        <li key={track.id} className="flex flex-wrap gap-x-3 tabular-nums">
          <span className="font-medium">{track.label}</span>
          <span>{positionText(now)}</span>
          <time dateTime={new Date(now.time).toISOString()} className="text-muted-foreground">
            {new Date(now.time).toLocaleTimeString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
