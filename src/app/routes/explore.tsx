import { lazy } from "react";
import { QueryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const ExploreScreen = lazy(() => import("@/features/explore/components/explore-screen").then((m) => ({ default: m.ExploreScreen })));

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
