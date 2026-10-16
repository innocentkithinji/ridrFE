import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useAsset loads one Asset with every Assignment it has had, oldest
// first. An Asset outside the user's Scope reads as NotFound.
export function useAsset(assetId: string) {
  return useQuery(RegistryService.method.getAsset, { assetId });
}
