import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";
import { useCan } from "@/lib/me";

// ValueUsage counts the Assets holding each value of each key:
// usage.get(key)?.get(value). Values are case-sensitive.
export type ValueUsage = Map<string, Map<string, number>>;

// useValueUsage counts, from ListAssets, how many Assets hold each
// attribute value, so the user knows which values can be removed. A
// scoped user's counts cover only the Assets in their Scope. Without the
// ListAssets Permission it loads nothing and returns undefined.
export function useValueUsage(): ValueUsage | undefined {
  const canList = useCan(RegistryService.method.listAssets);
  const assets = useQuery(RegistryService.method.listAssets, {}, { enabled: canList });
  if (!assets.data) {
    return undefined;
  }
  const usage: ValueUsage = new Map();
  for (const asset of assets.data.assets) {
    for (const [key, value] of Object.entries(asset.attributes)) {
      const values = usage.get(key) ?? new Map<string, number>();
      values.set(value, (values.get(value) ?? 0) + 1);
      usage.set(key, values);
    }
  }
  return usage;
}

// assetCount says how many Assets hold a value, as "1 Asset" or "3 Assets".
export function assetCount(count: number): string {
  return count === 1 ? "1 Asset" : `${count} Assets`;
}
