import { lazy } from "react";
import { DashboardService } from "@ridr/web";
import { useParams, useSearchParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const DashboardScreen = lazy(() => import("@/features/dashboards/components/dashboard-screen").then((m) => ({ default: m.DashboardScreen })));
const DashboardsScreen = lazy(() => import("@/features/dashboards/components/dashboards-screen").then((m) => ({ default: m.DashboardsScreen })));

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
