import type { Alert } from "@ridr/web";
import { Link } from "react-router";
import { AlertActions } from "@/features/alerts/components/alert-actions";
import { AlertStateBadge } from "@/features/alerts/components/alert-state";
import { formatTime } from "@/lib/format";
import { withUnit } from "@/lib/units";

// AlertsTable lists Alerts one per row, each linking to its detail.
export function AlertsTable({ alerts, label }: { alerts: Alert[]; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={label} className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Asset</th>
            <th className="px-3 py-2 font-medium">Rule</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Fired</th>
            <th className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id} className="border-t">
              <td className="px-3 py-2">
                <AlertStateBadge state={alert.state} />
              </td>
              <td className="px-3 py-2">
                <Link to={`/alerts/${alert.id}`} className="font-medium hover:underline">
                  {alert.asset}
                </Link>
              </td>
              <td className="px-3 py-2">{alert.ruleName}</td>
              <td className="px-3 py-2 tabular-nums">{withUnit(alert.value, alert.unit)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatTime(alert.firedAt)}</td>
              <td className="px-3 py-2 text-right">
                <AlertActions alert={alert} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
