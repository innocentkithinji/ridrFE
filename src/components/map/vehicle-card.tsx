import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Mode, Motion, Playback, Vehicle } from "@/components/map/playback";
import { positionText } from "@/components/map/tracks";
import { Button } from "@/components/ui/button";

// VehicleCard tells about the vehicle selected on a live map: what it is,
// what it's doing, when it last reported and where it is shown now. It
// reads the Playback a few times a second rather than on every frame.
// Key it by the vehicle's id, so selecting another starts afresh.

// What the card calls each Mode.
const modeNames: Record<Mode, string> = {
  rail: "Train",
  tram: "Tram",
  subway: "Metro",
  bus: "Bus",
  ferry: "Ferry",
};

// How the card says each Motion, as on a departures board.
const motionWords: Record<Motion, string> = {
  "en-route": "EN ROUTE",
  stopped: "STOPPED",
  "no-fix": "NO FIX",
  waiting: "WAITING",
};

const refreshMs = 250;

type VehicleCardProps = { playback: Playback; id: string; onClose: () => void };

export function VehicleCard({ playback, id, onClose }: VehicleCardProps) {
  const [vehicle, setVehicle] = useState<Vehicle | undefined>(() => copy(playback.current(id)));
  useEffect(() => {
    const timer = setInterval(() => setVehicle(copy(playback.current(id))), refreshMs);
    return () => clearInterval(timer);
  }, [playback, id]);
  if (!vehicle) return null;

  return (
    <section
      aria-label="Selected vehicle"
      className="bg-card absolute top-2 left-2 z-10 w-64 rounded-md border p-3 text-sm shadow-md"
    >
      <header className="mb-2 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-medium">{vehicle.label}</h3>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Mode</dt>
        <dd>{vehicle.mode ? modeNames[vehicle.mode] : "Vehicle"}</dd>
        <dt className="text-muted-foreground">Motion</dt>
        <dd className="font-medium tracking-wide">{motionWords[vehicle.motion]}</dd>
        <dt className="text-muted-foreground">Last report</dt>
        <dd>
          <time dateTime={new Date(vehicle.reportedAt).toISOString()}>
            {new Date(vehicle.reportedAt).toLocaleTimeString()}
          </time>
        </dd>
        <dt className="text-muted-foreground">Position</dt>
        <dd className="tabular-nums">{positionText(vehicle)}</dd>
      </dl>
    </section>
  );
}

function copy(vehicle: Vehicle | undefined): Vehicle | undefined {
  return vehicle && { ...vehicle };
}
