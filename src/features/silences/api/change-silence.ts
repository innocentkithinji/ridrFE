import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AlertService, SilenceService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

const silenceQueries = createConnectQueryKey({ schema: SilenceService, cardinality: undefined });
const alertQueries = createConnectQueryKey({ schema: AlertService, cardinality: undefined });

// useCreateSilence creates a Silence, then reloads every Silence list.
export function useCreateSilence() {
  const queryClient = useQueryClient();
  return useMutation(SilenceService.method.createSilence, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: silenceQueries }),
  });
}

// useEndSilence ends a Silence now; repeating it is safe. Alerts it held
// back may be notified at once, so Alerts reload too.
export function useEndSilence() {
  const queryClient = useQueryClient();
  return useMutation(SilenceService.method.endSilence, {
    onSuccess: () =>
      Promise.all(
        [silenceQueries, alertQueries].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
