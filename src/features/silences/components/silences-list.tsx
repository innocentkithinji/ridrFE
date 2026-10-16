import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import { AlertService, AlertState, SilenceService, SilenceState, type Silence } from "@ridr/web";
import { useMemo } from "react";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAssets } from "@/features/assets/api/get-assets";
import { useEndSilence } from "@/features/silences/api/change-silence";
import { useHeldBackAlerts } from "@/features/silences/api/get-silences";
import { refusalMessage } from "@/features/silences/refusal";
import { holdsEvery } from "@/lib/attributes";
import { Can } from "@/lib/me";

const stateLabels: Record<SilenceState, string> = {
  [SilenceState.UNSPECIFIED]: "Unknown",
  [SilenceState.PENDING]: "Pending",
  [SilenceState.ACTIVE]: "Active",
  [SilenceState.EXPIRED]: "Expired",
};

const alertStateLabels: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "Unknown",
  [AlertState.FIRING]: "Firing",
  [AlertState.ACKNOWLEDGED]: "Acknowledged",
  [AlertState.RESOLVED]: "Resolved",
};

function timeOf(ts: Timestamp | undefined): string {
  return ts ? timestampDate(ts).toLocaleString() : "–";
}

// SilencesList shows each Silence with its selector, the Assets it
// covers, its window, comment, creator and state.
export function SilencesList({ silences }: { silences: Silence[] }) {
  return (
    <ul aria-label="Silences" className="space-y-3">
      {silences.map((silence) => (
        <SilenceItem key={silence.id} silence={silence} />
      ))}
    </ul>
  );
}

function SilenceItem({ silence }: { silence: Silence }) {
  const pairs = Object.entries(silence.selector).toSorted(([a], [b]) => a.localeCompare(b));
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <ul aria-label="Selector" className="flex flex-wrap gap-1.5">
            {pairs.map(([key, value]) => (
              <li key={key} className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                {key}={value}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            Starts {timeOf(silence.startsAt)} · Ends {timeOf(silence.endsAt)}
          </p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
          {stateLabels[silence.state]}
        </span>
      </div>
      {silence.comment && <p className="text-sm">{silence.comment}</p>}
      <p className="text-muted-foreground text-xs">by {silence.createdBy}</p>
      <CoveredAssets selector={silence.selector} />
      {silence.state !== SilenceState.EXPIRED && (
        <Can method={SilenceService.method.endSilence}>
          <EndEarly silenceId={silence.id} />
        </Can>
      )}
      <Can method={AlertService.method.listAlerts}>
        <HeldBackAlerts silenceId={silence.id} />
      </Can>
    </li>
  );
}

// CoveredAssets names the Assets the user can see that the selector
// covers now.
function CoveredAssets({ selector }: { selector: Record<string, string> }) {
  const assets = useAssets();
  const covered = useMemo(
    () => (assets.data?.assets ?? []).filter((asset) => holdsEvery(asset.attributes, selector)),
    [assets.data, selector],
  );
  if (!assets.data) {
    return null;
  }
  if (covered.length === 0) {
    return <p className="text-muted-foreground text-sm">Covers no Assets now.</p>;
  }
  const names = covered.map((asset) => asset.name).toSorted((a, b) => a.localeCompare(b));
  const shown = names.slice(0, 5).join(", ");
  return (
    <p className="text-sm">
      Covers {shown}
      {names.length > 5 && ` and ${names.length - 5} more`}
    </p>
  );
}

function EndEarly({ silenceId }: { silenceId: string }) {
  const end = useEndSilence();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={end.isPending}
        onClick={() => end.mutate({ silenceId })}
      >
        End early
      </Button>
      {end.error && (
        <p role="alert" className="text-destructive text-sm">
          {refusalMessage(end.error)}
        </p>
      )}
    </div>
  );
}

function HeldBackAlerts({ silenceId }: { silenceId: string }) {
  const alerts = useHeldBackAlerts(silenceId);
  return (
    <section aria-label="Held-back Alerts" className="space-y-1">
      <h3 className="text-sm font-medium">Held-back Alerts</h3>
      <QueryView
        query={alerts}
        what="held-back Alerts"
        isEmpty={(data) => data.alerts.length === 0}
        empty="No Alerts held back."
      >
        {(data) => (
          <ul className="space-y-1 text-sm">
            {data.alerts.map((alert) => (
              <li key={alert.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{alert.ruleName}</span>
                <span>{alert.asset}</span>
                <span className="text-muted-foreground">
                  {alertStateLabels[alert.state]} since {timeOf(alert.firedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </section>
  );
}
