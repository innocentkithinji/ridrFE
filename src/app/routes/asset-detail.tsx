import { RegistryService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { AssetDetailScreen } from "@/features/assets/components/asset-detail-screen";
import { permissionOf } from "@/lib/me";

export const assetDetailPath = "/assets/:assetId";

export const assetDetailPermission = permissionOf(RegistryService.method.getAsset);

export function AssetDetailRoute() {
  const { assetId = "" } = useParams();
  return (
    <RequirePermission permission={assetDetailPermission} what="this Asset">
      {/* Keyed so moving between Assets starts each one afresh. */}
      <AssetDetailScreen key={assetId} assetId={assetId} />
    </RequirePermission>
  );
}
