import { AdapterService, CatalogService, QueryService, RegistryService, type Unit } from "@ridr/web";
import { useMemo } from "react";
import { useAdapters } from "@/lib/api/adapters";
import { sortMetrics, useMetrics, useUnits } from "@/lib/api/catalog";
import { useRecentDevices } from "@/lib/api/query";
import { useAssets, useControlledKeys, useUnclaimedDevices, vocabularyStaleTime } from "@/lib/api/registry";
import { useCan } from "@/lib/me";

// What the builder's pickers offer, from the lists the user may read. A
// list the user can't read is empty, and its picker takes typed values.
export type BuilderLists = {
  metrics: string[];
  assets: string[];
  devices: string[];
  adapters: { id: string; name: string }[];
  attributeKeys: string[];
  // The values a Controlled key allows, or undefined for a free key.
  allowedValuesOf: (key: string) => string[] | undefined;
  // The values Assets hold for a free key.
  attributeValuesOf: (key: string) => string[];
  // The Units of a Metric's Quantity kind.
  unitsOf: (metric: string) => Unit[];
  quantityKindOf: (metric: string) => string;
  // Whether the Metric and Unit lists have loaded (or can't be read).
  catalogReady: boolean;
};

export function useBuilderLists(): BuilderLists {
  const canMetrics = useCan(CatalogService.method.listMetrics);
  const canUnits = useCan(CatalogService.method.listUnits);
  const canAssets = useCan(RegistryService.method.listAssets);
  const canKeys = useCan(RegistryService.method.listControlledKeys);
  const canUnclaimed = useCan(RegistryService.method.listUnclaimedDevices);
  const canAdapters = useCan(AdapterService.method.listAdapters);
  const canQuery = useCan(QueryService.method.runQuery);

  const metrics = useMetrics({ enabled: canMetrics });
  const units = useUnits({ enabled: canUnits });
  const assets = useAssets({ enabled: canAssets, staleTime: vocabularyStaleTime });
  const keys = useControlledKeys({ enabled: canKeys });
  const unclaimed = useUnclaimedDevices({ enabled: canUnclaimed });
  const recent = useRecentDevices({ enabled: canQuery });
  const adapters = useAdapters({ enabled: canAdapters });

  return useMemo(() => {
    const metricList = sortMetrics(metrics.data?.metrics ?? []);
    const assetList = assets.data?.assets ?? [];
    const controlled = keys.data?.controlledKeys ?? [];
    const kindOf = (metric: string) => metricList.find((one) => one.name === metric)?.quantityKind ?? "";
    return {
      metrics: metricList.map((metric) => metric.name),
      assets: assetList.map((asset) => asset.name).toSorted((a, b) => a.localeCompare(b)),
      devices: [
        ...new Set([...(recent.data ?? []), ...(unclaimed.data?.devices ?? []).map((device) => device.deviceId)]),
      ].toSorted(),
      adapters: (adapters.data?.adapters ?? [])
        .filter((adapter) => !adapter.retiredAt)
        .map(({ id, name }) => ({ id, name }))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
      attributeKeys: [
        ...new Set([...controlled.map((one) => one.key), ...assetList.flatMap((asset) => Object.keys(asset.attributes))]),
      ].toSorted(),
      allowedValuesOf: (key) => controlled.find((one) => one.key === key)?.allowedValues,
      attributeValuesOf: (key) =>
        [...new Set(assetList.map((asset) => asset.attributes[key]).filter((value) => value !== undefined))].toSorted(),
      unitsOf: (metric) => {
        const kind = kindOf(metric);
        return kind ? (units.data?.units ?? []).filter((unit) => unit.quantityKind === kind) : [];
      },
      quantityKindOf: kindOf,
      catalogReady: (!canMetrics || !metrics.isPending) && (!canUnits || !units.isPending),
    };
  }, [metrics.data, metrics.isPending, units.data, units.isPending, assets.data, keys.data, unclaimed.data, recent.data, adapters.data, canMetrics, canUnits]);
}
