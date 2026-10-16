import { DashboardService } from "@ridr/web";
import { useParams, useSearchParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { DashboardScreen } from "@/features/dashboards/components/dashboard-screen";
import { DashboardsScreen } from "@/features/dashboards/components/dashboards-screen";
import { permissionOf } from "@/lib/me";

export const dashboardsPath = "/dashboards";

export const dashboardPath = "/dashboards/:dashboardId";

export const dashboardsPermission = permissionOf(DashboardService.method.listDashboards);

export function DashboardsRoute() {
  return (
    <RequirePermission permission={dashboardsPermission} what="Dashboards">
      <DashboardsScreen />
    </RequirePermission>
  );
}

export function DashboardRoute() {
  const { dashboardId = "" } = useParams();
  // ?version=N opens an earlier version read-only; anything else, the latest.
  const version = Number.parseInt(useSearchParams()[0].get("version") ?? "", 10);
  return (
    <RequirePermission permission={permissionOf(DashboardService.method.getDashboard)} what="Dashboards">
      <DashboardScreen key={dashboardId} dashboardId={dashboardId} version={version > 0 ? version : 0} />
    </RequirePermission>
  );
}
