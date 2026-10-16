import { useQuery } from "@connectrpc/connect-query";
import { AlertService } from "@ridr/web";

// useAlerts lists an Asset's Alerts, newest first, under whatever names
// the Asset had when they fired. (The Alerts feature has its own; the
// two share a cache entry, so a later merge can keep one.)
export function useAlerts({ assetId }: { assetId: string }, options: { enabled?: boolean } = {}) {
  return useQuery(AlertService.method.listAlerts, { assetId }, { enabled: options.enabled });
}
