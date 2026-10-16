import { useQuery } from "@connectrpc/connect-query";
import { AlertService } from "@ridr/web";
import { alertsPollMs } from "@/lib/api/alerts";

// The most Alerts ListAlerts returns; older ones can't be opened.
const newestAlerts = 1000;

// useAlertAmongNewest finds one Alert. There is no GetAlert procedure, so
// it looks in the newest Alerts; data is undefined when it isn't there.
export function useAlertAmongNewest(alertId: string) {
  return useQuery(
    AlertService.method.listAlerts,
    { limit: newestAlerts },
    {
      refetchInterval: alertsPollMs,
      select: (answer) => answer.alerts.find((a) => a.id === alertId),
    },
  );
}
