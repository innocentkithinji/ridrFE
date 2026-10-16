import { CatalogService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import { permissionOf } from "@/lib/me";

export const catalogPath = "/settings/catalog";

export const catalogPermission = permissionOf(CatalogService.method.listMetrics);

export function CatalogRoute() {
  return (
    <RequirePermission permission={catalogPermission} what="the Catalog">
      <CatalogScreen />
    </RequirePermission>
  );
}
