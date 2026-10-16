import { lazy, Suspense, useId, useState } from "react";
import type { TrackShow } from "@/components/map/track-layers";
import {
  crossesAntimeridian,
  latestOf,
  positionText,
  type GeoPolygon,
  type Track,
} from "@/components/map/tracks";
import { Button } from "@/components/ui/button";
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

// MapArea is a polygon on the map. With `onChange` the user may change
// it: "Draw area" starts a new one, each click on the map adding a
// corner; once finished its corners drag; its corners can also be typed
// as text. Each change is sent to onChange. An area crossing the 180°
// meridian is drawn but explained as one Ridr refuses.
export type MapArea = {
  polygon: GeoPolygon | null;
  onChange?: (polygon: GeoPolygon | null) => void;
};

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

export function TrackMap({ tracks, label, show = "tracks", stale = false, area, height = 360 }: TrackMapProps) {
  const { resolved: theme } = useTheme();
  const [ready, setReady] = useState(false);
  const [listed, setListed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const onChange = area?.onChange;

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
          onArea={onChange}
          drawing={drawing}
        />
      </Suspense>
      {onChange && (
        <AreaControls
          polygon={area.polygon}
          onChange={onChange}
          drawing={drawing}
          onDrawing={setDrawing}
        />
      )}
      {area?.polygon && crossesAntimeridian(area.polygon) && (
        <p role="alert" className="text-destructive text-sm">
          This area crosses the 180° meridian, which Ridr can't watch. Draw it on one side.
        </p>
      )}
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

type AreaControlsProps = {
  polygon: GeoPolygon | null;
  onChange: (polygon: GeoPolygon | null) => void;
  drawing: boolean;
  onDrawing: (drawing: boolean) => void;
};

// AreaControls draws a new area, clears it, and edits its corners as
// text, for keyboards and exact positions.
function AreaControls({ polygon, onChange, drawing, onDrawing }: AreaControlsProps) {
  const corners = polygon?.length ?? 0;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {drawing ? (
          <Button type="button" size="sm" disabled={corners < 3} onClick={() => onDrawing(false)}>
            Finish
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onChange(null);
              onDrawing(true);
            }}
          >
            Draw area
          </Button>
        )}
        {corners > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange(null);
              onDrawing(false);
            }}
          >
            Clear
          </Button>
        )}
        <span className="text-muted-foreground" aria-live="polite">
          {drawing
            ? `Click the map to add corners (${corners} so far), then Finish.`
            : corners > 0
              ? `${corners} corners. Drag a corner to move it.`
              : "No area yet."}
        </span>
      </div>
      <details>
        <summary className="text-muted-foreground cursor-pointer">Edit corners as text</summary>
        <CornersText polygon={polygon} onChange={onChange} />
      </details>
    </div>
  );
}

// cornersText writes corners one per line as "latitude, longitude".
function cornersText(polygon: GeoPolygon | null): string {
  return (polygon ?? []).map(([longitude, latitude]) => `${round(latitude)}, ${round(longitude)}`).join("\n");
}

function round(degrees: number): number {
  return Math.round(degrees * 1e5) / 1e5;
}

// parseCorners reads "latitude, longitude" lines, or undefined when one
// isn't a position on the Earth.
function parseCorners(text: string): GeoPolygon | null | undefined {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return null;
  const polygon: GeoPolygon = [];
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim());
    const [latitude, longitude] = parts.map(Number);
    if (parts.length !== 2 || parts.some((part) => part === "")) return undefined;
    if (!(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) return undefined;
    polygon.push([longitude, latitude]);
  }
  return polygon;
}

function CornersText({ polygon, onChange }: { polygon: GeoPolygon | null; onChange: (polygon: GeoPolygon | null) => void }) {
  const id = useId();
  const [text, setText] = useState(() => cornersText(polygon));
  const [shown, setShown] = useState(polygon);
  // A change from the map (a click or a drag) replaces the text; text
  // being typed stays as typed.
  if (shown !== polygon) {
    setShown(polygon);
    if (cornersText(parseCorners(text) ?? null) !== cornersText(polygon)) setText(cornersText(polygon));
  }
  const invalid = parseCorners(text) === undefined;
  return (
    <div className="mt-2 space-y-1">
      <label htmlFor={id} className="font-medium">
        Corners
      </label>
      <textarea
        id={id}
        rows={5}
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseCorners(event.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
        className="border-input bg-background w-full rounded-lg border px-2 py-1 font-mono text-sm aria-invalid:border-destructive"
      />
      <p id={`${id}-hint`} className={invalid ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
        One corner per line, as latitude, longitude in degrees.
      </p>
    </div>
  );
}
