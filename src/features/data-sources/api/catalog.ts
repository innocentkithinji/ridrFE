import { useQuery } from "@connectrpc/connect-query";
import { CatalogService } from "@ridr/web";

// The Catalog changes rarely while someone writes a Mapping, so its lists
// stay fresh for 5 minutes.
const catalogStaleTime = 5 * 60_000;

// useMetrics lists the Metrics a Mapping may name.
export function useMetrics() {
  return useQuery(CatalogService.method.listMetrics, {}, { staleTime: catalogStaleTime });
}

// useUnits lists every Unit, each with its Quantity kind.
export function useUnits() {
  return useQuery(CatalogService.method.listUnits, {}, { staleTime: catalogStaleTime });
}
