import { lazy } from "react";
import { CatalogService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const CatalogScreen = lazy(() => import("@/features/catalog/components/catalog-screen").then((m) => ({ default: m.CatalogScreen })));

export const catalogPath = "/settings/catalog";

export const catalogPermission = permissionOf(CatalogService.method.listMetrics);

export function CatalogRoute() {
  return (
    <RequirePermission permission={catalogPermission} what="the Catalog">
      <CatalogScreen />
    </RequirePermission>
  );
}
