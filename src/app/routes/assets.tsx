import { lazy } from "react";
import { RegistryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const AssetsScreen = lazy(() => import("@/features/assets/components/assets-screen").then((m) => ({ default: m.AssetsScreen })));

export const assetsPath = "/assets";

export const assetsPermission = permissionOf(RegistryService.method.listAssets);

export function AssetsRoute() {
  return (
    <RequirePermission permission={assetsPermission} what="Assets">
      <AssetsScreen />
    </RequirePermission>
  );
}
