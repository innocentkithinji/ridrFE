import { AlertState, type Alert } from "@ridr/web";
import { withUnit } from "@/lib/units";
import { QueryView } from "@/components/states";
import { useAlerts } from "@/lib/api/alerts";
import { shownTime } from "@/features/assets/components/time";

const stateLabel: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "Unknown",
  [AlertState.FIRING]: "Firing",
  [AlertState.ACKNOWLEDGED]: "Acknowledged",
  [AlertState.RESOLVED]: "Resolved",
};

const stateTone: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "bg-muted text-muted-foreground",
  [AlertState.FIRING]: "bg-destructive/10 text-destructive",
  [AlertState.ACKNOWLEDGED]: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  [AlertState.RESOLVED]: "bg-muted text-muted-foreground",
};

// AssetAlerts lists the Alerts an Asset's Rules raised, newest first.
export function AssetAlerts({ assetId }: { assetId: string }) {
  const alerts = useAlerts({ assetId });
  return (
    <QueryView
      query={alerts}
      what="Alerts"
      empty="No Alerts for this Asset."
      isEmpty={(data) => data.alerts.length === 0}
    >
      {(data) => (
        <ul className="divide-y">
          {data.alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </QueryView>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
      <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${stateTone[alert.state]}`}>
        {stateLabel[alert.state]}
      </span>
      <span className="font-medium">{alert.ruleName}</span>
      <span className="tabular-nums">{withUnit(alert.value, alert.unit)}</span>
      <span className="text-muted-foreground ml-auto tabular-nums">
        fired {shownTime(alert.firedAt)}
      </span>
    </li>
  );
}
