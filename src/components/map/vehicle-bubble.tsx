import { LocateFixed, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Mode, Motion, Playback, Vehicle } from "@/components/map/playback";
import { positionText } from "@/components/map/tracks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// VehicleBubble tells about the vehicle selected on a live map, in a
// bubble the map keeps pinned above it: its name, what it is and is
// doing, how fast it goes, its Tags (a train's line and route), when it
// last reported and where it is shown now. It reads the Playback a few
// times a second rather than on every frame. Key it by the vehicle's id,
// so selecting another starts afresh.

// What the bubble calls each Mode.
const modeNames: Record<Mode, string> = {
  rail: "Train",
  tram: "Tram",
  subway: "Metro",
  bus: "Bus",
  ferry: "Ferry",
};

// How the bubble says each Motion, as on a departures board.
const motionWords: Record<Motion, string> = {
  "en-route": "EN ROUTE",
  stopped: "STOPPED",
  "no-fix": "NO FIX",
  waiting: "WAITING",
};

const refreshMs = 250;

type VehicleBubbleProps = {
  playback: Playback;
  id: string;
  // Whether the map keeps the vehicle in view as it moves.
  following: boolean;
  onFollowing: (following: boolean) => void;
  onClose: () => void;
};

export function VehicleBubble({ playback, id, following, onFollowing, onClose }: VehicleBubbleProps) {
  const [vehicle, setVehicle] = useState<Vehicle | undefined>(() => copy(playback.current(id)));
  useEffect(() => {
    const timer = setInterval(() => setVehicle(copy(playback.current(id))), refreshMs);
    return () => clearInterval(timer);
  }, [playback, id]);
  if (!vehicle) return null;
  // The mode Tag is shown as the Mode.
  const tags = Object.entries(vehicle.tags).filter(([key]) => key !== "mode");

  return (
    <section
      aria-label="Selected vehicle"
      className="bg-card text-card-foreground relative mb-4 w-64 rounded-md border p-2.5 text-xs shadow-lg"
    >
      <header className="mb-1.5 flex items-center gap-1">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{vehicle.label}</h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Follow"
          aria-pressed={following}
          title={following ? "Following: the map keeps it in view" : "Follow it"}
          className={cn(following && "text-emerald-600")}
          onClick={() => onFollowing(!following)}
        >
          <LocateFixed />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Mode</dt>
        <dd>{vehicle.mode ? modeNames[vehicle.mode] : "Vehicle"}</dd>
        <dt className="text-muted-foreground">Motion</dt>
        <dd className="font-medium tracking-wide">{motionWords[vehicle.motion]}</dd>
        <dt className="text-muted-foreground">Speed</dt>
        <dd className="tabular-nums">{vehicle.speed === null ? "—" : `${Math.round(vehicle.speed * 3.6)} km/h`}</dd>
        {tags.map(([key, value]) => (
          <Fact key={key} term={key} value={value} />
        ))}
        <dt className="text-muted-foreground">Last report</dt>
        <dd>
          <time dateTime={new Date(vehicle.reportedAt).toISOString()}>
            {new Date(vehicle.reportedAt).toLocaleTimeString()}
          </time>
        </dd>
        <dt className="text-muted-foreground">Position</dt>
        <dd className="tabular-nums">{positionText(vehicle)}</dd>
      </dl>
      {/* The bubble's point, toward the vehicle. */}
      <span
        aria-hidden
        className="bg-card absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b"
      />
    </section>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="truncate">{value}</dd>
    </>
  );
}

function copy(vehicle: Vehicle | undefined): Vehicle | undefined {
  return vehicle && { ...vehicle };
}
