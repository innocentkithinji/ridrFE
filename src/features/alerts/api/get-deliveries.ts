import { useQuery } from "@connectrpc/connect-query";
import { AlertService } from "@ridr/web";
import { alertsPollMs } from "@/features/alerts/api/polling";

// useDeliveries lists every notification of an Alert, oldest first.
export function useDeliveries(alertId: string) {
  return useQuery(
    AlertService.method.listDeliveries,
    { alertId },
    { refetchInterval: alertsPollMs },
  );
}
