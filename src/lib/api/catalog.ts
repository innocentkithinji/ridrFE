import { createConnectQueryKey, useQuery } from "@connectrpc/connect-query";
import { CatalogService, type Metric, type Unit } from "@ridr/web";

// The Catalog changes rarely, so its lists stay fresh for 5 minutes.
export const catalogStaleTime = 5 * 60_000;

// metricsKey matches the cached ListMetrics, to refetch it after a
// Metric is defined.
export const metricsKey = createConnectQueryKey({
  schema: CatalogService.method.listMetrics,
  cardinality: undefined,
});

// useMetrics lists every Metric: built-in, the Organisation's own, and
// unreviewed names Ridr has seen but not yet given a Quantity kind.
// The Catalog, Explore, Dashboards, Rules and Data sources share it.
export function useMetrics(options: { enabled?: boolean } = {}) {
  return useQuery(
    CatalogService.method.listMetrics,
    {},
    { staleTime: catalogStaleTime, enabled: options.enabled },
  );
}

// useUnits lists every Unit Ridr knows, each with its Quantity kind and
// aliases.
export function useUnits(options: { enabled?: boolean } = {}) {
  return useQuery(
    CatalogService.method.listUnits,
    {},
    { staleTime: catalogStaleTime, enabled: options.enabled },
  );
}

// sortMetrics puts built-in Metrics first, then the Organisation's, each
// by name.
export function sortMetrics(metrics: readonly Metric[]): Metric[] {
  return metrics.toSorted(
    (a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name),
  );
}

// quantityKindsOf names every Quantity kind Ridr knows: the distinct
// kinds of its Units, by name. Offer them wherever a kind is chosen.
export function quantityKindsOf(units: readonly Unit[]): string[] {
  return [...new Set(units.map((unit) => unit.quantityKind))].toSorted();
}

// A Quantity kind and the Units that measure it.
export type QuantityKindUnits = { quantityKind: string; units: Unit[] };

// unitsByQuantityKind groups Units by Quantity kind, kinds by name, Units
// in the order Ridr lists them. Its kinds are every Quantity kind Ridr
// knows.
export function unitsByQuantityKind(units: readonly Unit[]): QuantityKindUnits[] {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) {
    groups.set(unit.quantityKind, [...(groups.get(unit.quantityKind) ?? []), unit]);
  }
  return [...groups]
    .map(([quantityKind, kindUnits]) => ({ quantityKind, units: kindUnits }))
    .toSorted((a, b) => a.quantityKind.localeCompare(b.quantityKind));
}
