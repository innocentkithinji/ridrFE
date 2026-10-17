import { lazy } from "react";
import { RegistryService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const AssetDetailScreen = lazy(() => import("@/features/assets/components/asset-detail-screen").then((m) => ({ default: m.AssetDetailScreen })));

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
