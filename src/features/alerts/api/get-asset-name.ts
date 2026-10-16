import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useAssetName returns an Asset's current name. An Alert keeps the name
// the Asset had when it fired, so a later rename needs this lookup.
export function useAssetName(assetId: string) {
  return useQuery(
    RegistryService.method.getAsset,
    { assetId },
    { select: (answer) => answer.asset?.name },
  );
}
