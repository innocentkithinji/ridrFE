import { RegistryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { AssetsScreen } from "@/features/assets/components/assets-screen";
import { permissionOf } from "@/lib/me";

export const assetsPermission = permissionOf(RegistryService.method.listAssets);

export function AssetsRoute() {
  return (
    <RequirePermission permission={assetsPermission} what="Assets">
      <AssetsScreen />
    </RequirePermission>
  );
}
