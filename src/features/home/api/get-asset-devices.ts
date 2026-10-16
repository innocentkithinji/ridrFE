import { createQueryOptions, useTransport } from "@connectrpc/connect-query";
import { RegistryService, type Asset } from "@ridr/web";
import { useQueries } from "@tanstack/react-query";
import { healthRefetchMs } from "@/features/home/api/polling";

// AssetDevice is a Device reporting for an Asset now.
export type AssetDevice = { deviceId: string; asset: Asset };

// useAssetDevices loads each Asset (one GetAsset per Asset, cached as
// useAsset caches it) and lists the Devices of its open Assignments.
// `pending` counts the Assets still loading; an Asset the user can't
// read is skipped.
export function useAssetDevices(assets: readonly Asset[], enabled: boolean) {
  const transport = useTransport();
  return useQueries({
    queries: assets.map((asset) => ({
      ...createQueryOptions(RegistryService.method.getAsset, { assetId: asset.id }, { transport }),
      enabled,
      refetchInterval: healthRefetchMs,
    })),
    combine: (results) => ({
      pending: enabled ? results.filter((r) => r.isPending).length : assets.length,
      devices: results.flatMap((result, i): AssetDevice[] =>
        (result.data?.assignments ?? [])
          .filter((assignment) => !assignment.endsAt)
          .map((assignment) => ({ deviceId: assignment.deviceId, asset: assets[i] })),
      ),
    }),
  });
}
