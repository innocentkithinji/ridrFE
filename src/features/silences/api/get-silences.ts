import { useQuery } from "@connectrpc/connect-query";
import { AlertService, SilenceService, SilenceState, type ListSilencesResponse } from "@ridr/web";

// A Silence's state is worked out as of the call, so the list is
// reloaded this often while a window may still open or close.
const refreshMs = 60_000;

function stillChanging(data: ListSilencesResponse | undefined): boolean {
  return !!data?.silences.some(
    (silence) => silence.state === SilenceState.PENDING || silence.state === SilenceState.ACTIVE,
  );
}

// useSilences lists pending and active Silences, latest to start first,
// and expired ones too when asked.
export function useSilences(includeExpired: boolean) {
  return useQuery(
    SilenceService.method.listSilences,
    { includeExpired },
    { refetchInterval: (query) => (stillChanging(query.state.data) ? refreshMs : false) },
  );
}

// useHeldBackAlerts lists the Alerts a Silence held back.
export function useHeldBackAlerts(silenceId: string) {
  return useQuery(AlertService.method.listAlerts, { silenceId });
}
