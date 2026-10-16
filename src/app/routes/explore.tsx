import { QueryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { ExploreScreen } from "@/features/explore/components/explore-screen";
import { permissionOf } from "@/lib/me";

export const explorePath = "/explore";

export const explorePermission = permissionOf(QueryService.method.runQuery);

// explorePathFor links to Explore opened on a Query, as Assets, Alerts
// and Dashboards do.
export function explorePathFor(text: string): string {
  return `${explorePath}?${new URLSearchParams({ q: text })}`;
}

export function ExploreRoute() {
  return (
    <RequirePermission permission={explorePermission} what="Explore">
      <ExploreScreen />
    </RequirePermission>
  );
}
