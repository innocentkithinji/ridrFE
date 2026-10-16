import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AlertService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

// Every AlertService query: an Alert's state shows in lists, the detail
// and its Deliveries.
const alertQueries = createConnectQueryKey({ schema: AlertService, cardinality: undefined });

// useAcknowledgeAlert records that the user has taken an Alert on, which
// stops its repeat notifications.
export function useAcknowledgeAlert() {
  return useMutation(AlertService.method.acknowledgeAlert, { onSuccess: useReloadAlerts() });
}

// useResolveAlert closes an open Alert by hand.
export function useResolveAlert() {
  return useMutation(AlertService.method.resolveAlert, { onSuccess: useReloadAlerts() });
}

// useReloadAlerts returns a callback refetching every AlertService query.
function useReloadAlerts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: alertQueries });
}
