import { AlertService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { AlertDetailScreen } from "@/features/alerts/components/alert-detail-screen";
import { AlertsScreen } from "@/features/alerts/components/alerts-screen";
import { permissionOf } from "@/lib/me";

export const alertsPath = "/alerts";

export const alertDetailPath = "/alerts/:alertId";

export const alertsPermission = permissionOf(AlertService.method.listAlerts);

export function AlertsRoute() {
  return (
    <RequirePermission permission={alertsPermission} what="Alerts">
      <AlertsScreen />
    </RequirePermission>
  );
}

export function AlertDetailRoute() {
  const { alertId = "" } = useParams();
  return (
    <RequirePermission permission={alertsPermission} what="Alerts">
      <AlertDetailScreen key={alertId} alertId={alertId} />
    </RequirePermission>
  );
}
