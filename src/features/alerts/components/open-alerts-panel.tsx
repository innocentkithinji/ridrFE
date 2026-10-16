import { AlertService } from "@ridr/web";
import { Link } from "react-router";
import { QueryView } from "@/components/states";
import { openStates, useAlerts } from "@/lib/api/alerts";
import { AlertsTable } from "@/features/alerts/components/alerts-table";
import { useCan } from "@/lib/me";

type OpenAlertsPanelProps = {
  // Only this Asset's open Alerts, under every name it had; all when empty.
  assetId?: string;
  // The panel's heading.
  title?: string;
};

// OpenAlertsPanel lists open Alerts newest first, polling every 15 s, for
// screens beside the inbox (Home, an Asset's detail). It shows nothing to
// users who may not list Alerts.
export function OpenAlertsPanel({ assetId = "", title = "Open Alerts" }: OpenAlertsPanelProps) {
  if (!useCan(AlertService.method.listAlerts)) {
    return null;
  }
  return <OpenAlerts assetId={assetId} title={title} />;
}

function OpenAlerts({ assetId, title }: Required<OpenAlertsPanelProps>) {
  const alerts = useAlerts({ states: openStates, assetId });
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link to="/alerts" className="text-muted-foreground hover:text-foreground text-sm">
          All Alerts
        </Link>
      </div>
      <QueryView
        query={alerts}
        what="open Alerts"
        empty="No open Alerts."
        isEmpty={(answer) => answer.alerts.length === 0}
      >
        {(answer) => <AlertsTable alerts={answer.alerts} label={title} />}
      </QueryView>
    </section>
  );
}
