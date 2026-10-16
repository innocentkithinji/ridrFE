import { useMutation } from "@connectrpc/connect-query";
import { useQueryClient } from "@tanstack/react-query";
import { CatalogService } from "@ridr/web";
import { metricsKey } from "@/lib/api/catalog";

// useDefineMetric adds a custom Metric, or reviews an unreviewed one by
// giving it a Quantity kind.
export function useDefineMetric() {
  const queryClient = useQueryClient();
  return useMutation(CatalogService.method.defineMetric, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: metricsKey }),
  });
}
