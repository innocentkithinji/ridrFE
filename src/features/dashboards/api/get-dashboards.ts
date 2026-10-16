import { useQuery } from "@connectrpc/connect-query";
import { DashboardService } from "@ridr/web";

// useDashboards lists the user's own Dashboards and every shared one, at
// their latest versions and without Widgets.
export function useDashboards() {
  return useQuery(DashboardService.method.listDashboards, {});
}

// useDashboard reads one Dashboard with its Widgets: version 0 is the
// latest, any other an earlier version (shown read-only, #22).
export function useDashboard(dashboardId: string, version = 0) {
  return useQuery(DashboardService.method.getDashboard, { dashboardId, version });
}
