import { createConnectQueryKey, useQuery } from "@connectrpc/connect-query";
import { CatalogService, type Metric } from "@ridr/web";

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
// Explore, Rules, Data sources and the Mapping editor reuse it.
export function useMetrics() {
  return useQuery(CatalogService.method.listMetrics, {}, { staleTime: catalogStaleTime });
}

// sortMetrics puts built-in Metrics first, then the Organisation's, each
// by name.
export function sortMetrics(metrics: readonly Metric[]): Metric[] {
  return metrics.toSorted(
    (a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name),
  );
}
