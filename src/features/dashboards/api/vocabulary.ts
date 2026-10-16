import { useQuery } from "@connectrpc/connect-query";
import { CatalogService, RegistryService } from "@ridr/web";

// The Catalog and the registry change rarely while someone writes a
// Widget's Query, so the editor's words stay fresh for 5 minutes.
const vocabularyStaleTime = 5 * 60_000;

// useMetrics lists the Metric names the Widget editor completes.
export function useMetrics(options: { enabled: boolean }) {
  return useQuery(CatalogService.method.listMetrics, {}, { staleTime: vocabularyStaleTime, ...options });
}

// useAssets lists the Asset names the Widget editor completes.
export function useAssets(options: { enabled: boolean }) {
  return useQuery(RegistryService.method.listAssets, {}, { staleTime: vocabularyStaleTime, ...options });
}
