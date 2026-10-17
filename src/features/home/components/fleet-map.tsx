import { useState } from "react";
import { TrackMap } from "@/components/map/track-map";
import { locationTracks } from "@/components/map/tracks";
import { LiveSwitch } from "@/components/live-status";
import { ErrorState, PermissionDenied } from "@/components/states";
import { useLiveQuery } from "@/lib/use-live-query";

// Where the fleet is now. Locations can't be rolled up and a Query over
// 10,000 Readings is refused, so the range stays short: two minutes of a
// busy fleet is plenty for "where is it now".
export const fleetQuery = "locations | range last 2m";

// FleetMap shows where each Device is now, moving as Locations arrive.
// While the Live query reopens it keeps the pins, marked stale. Paused,
// it closes the Live query and holds still on the last positions.
export function FleetMap() {
  const [liveWanted, setLiveWanted] = useState(true);
  const live = useLiveQuery(fleetQuery, { enabled: liveWanted });
  const tracks = live.data ? locationTracks(live.data.readings) : [];
  return (
    <section aria-label="Fleet map" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Fleet</h2>
        <LiveSwitch on={liveWanted} onChange={setLiveWanted} status={live.status} />
      </div>
      <FleetMapBody live={live} tracks={tracks} moving={liveWanted} />
    </section>
  );
}

type FleetMapBodyProps = {
  live: ReturnType<typeof useLiveQuery>;
  tracks: ReturnType<typeof locationTracks>;
  moving: boolean;
};

function FleetMapBody({ live, tracks, moving }: FleetMapBodyProps) {
  if (live.status === "denied") return <PermissionDenied what="the fleet's Locations" />;
  if (live.status === "failed") return <ErrorState error={live.error} />;
  const empty = live.data !== undefined && tracks.length === 0;
  return (
    <div className="relative">
      <TrackMap
        tracks={tracks}
        label="Fleet now"
        show="latest"
        stale={moving && live.status === "reconnecting"}
        live={moving}
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
