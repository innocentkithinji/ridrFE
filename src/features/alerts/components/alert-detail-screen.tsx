import { AlertService, type Alert } from "@ridr/web";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { QueryView } from "@/components/states";
import { useAlertAmongNewest } from "@/features/alerts/api/get-alert";
import { AlertActions } from "@/features/alerts/components/alert-actions";
import { AlertReadings } from "@/features/alerts/components/alert-readings";
import { AlertStateBadge } from "@/features/alerts/components/alert-state";
import { Deliveries } from "@/features/alerts/components/deliveries-table";
import { formatTime, formatValue } from "@/lib/format";
import { Can } from "@/lib/me";

// AlertDetailScreen is /alerts/:alertId. There is no GetAlert, so it
// finds the Alert among the newest 1000.
export function AlertDetailScreen({ alertId }: { alertId: string }) {
  const alert = useAlertAmongNewest(alertId);
  return (
    <section className="space-y-6">
      <Link
        to="/alerts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Alerts
      </Link>
      <QueryView
        query={alert}
        what="the Alert"
        // Also what a scoped user sees for an Asset outside their Scope.
        empty="This Alert doesn't exist, or isn't yours to see."
      >
        {(found) => <AlertSections alert={found} />}
      </QueryView>
    </section>
  );
}

function AlertSections({ alert }: { alert: Alert }) {
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {alert.ruleName}: {alert.asset}
        </h1>
        {alert.silenceId && (
          <p className="text-muted-foreground text-sm">
            Fired during a Silence; nobody was notified then.
          </p>
        )}
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <Fact term="State">
          <span className="inline-flex flex-wrap items-center gap-3">
            <AlertStateBadge state={alert.state} />
            <AlertActions alert={alert} />
          </span>
        </Fact>
        <Fact term="Value">{formatValue(alert.value, alert.unit)}</Fact>
        <Fact term="Fired">{formatTime(alert.firedAt)}</Fact>
        <Fact term="Acknowledged">{byWhom(formatTime(alert.acknowledgedAt), alert.acknowledgedBy)}</Fact>
        <Fact term="Resolved">{byWhom(formatTime(alert.resolvedAt), alert.resolvedBy)}</Fact>
      </dl>
      <Can method={AlertService.method.listDeliveries}>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Deliveries</h2>
          <Deliveries alertId={alert.id} />
        </section>
      </Can>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Live Readings</h2>
        <AlertReadings alert={alert} />
      </section>
    </>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function byWhom(when: string, who: string): string {
  return who ? `${when} by ${who}` : when;
}
