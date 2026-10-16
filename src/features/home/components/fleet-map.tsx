import { TrackMap } from "@/components/map/track-map";
import { locationTracks } from "@/components/map/tracks";
import { LiveStatusBadge } from "@/components/live-status";
import { ErrorState, PermissionDenied } from "@/components/states";
import { useLiveQuery } from "@/lib/use-live-query";

// Where the fleet is now. Locations can't be rolled up and a Query over
// 10,000 Readings is refused, so the range stays short: two minutes of a
// busy fleet is plenty for "where is it now".
export const fleetQuery = "locations | range last 2m";

// FleetMap shows where each Device is now, moving as Locations arrive.
// While the Live query reopens it keeps the pins, marked stale.
export function FleetMap() {
  const live = useLiveQuery(fleetQuery);
  const tracks = live.data ? locationTracks(live.data.readings) : [];
  return (
    <section aria-label="Fleet map" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Fleet</h2>
        <LiveStatusBadge status={live.status} />
      </div>
      <FleetMapBody live={live} tracks={tracks} />
    </section>
  );
}

type FleetMapBodyProps = {
  live: ReturnType<typeof useLiveQuery>;
  tracks: ReturnType<typeof locationTracks>;
};

function FleetMapBody({ live, tracks }: FleetMapBodyProps) {
  if (live.status === "denied") return <PermissionDenied what="the fleet's Locations" />;
  if (live.status === "failed") return <ErrorState error={live.error} />;
  const empty = live.data !== undefined && tracks.length === 0;
  return (
    <div className="relative">
      <TrackMap
        tracks={tracks}
        label="Fleet now"
        show="latest"
        stale={live.status === "reconnecting"}
        height={420}
      />
      {empty && (
        <p className="bg-background/80 text-muted-foreground absolute inset-x-0 top-4 mx-auto w-fit rounded-md px-3 py-1 text-sm">
          No positions in the last 2 minutes.
        </p>
      )}
    </div>
  );
}
