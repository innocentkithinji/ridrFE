import { useQuery } from "@connectrpc/connect-query";
import { AlertService, AlertState } from "@ridr/web";

// Live queries carry Readings only, so every Alerts query polls to stay
// current.
export const alertsPollMs = 15_000;

// Alerts in these states need someone's attention.
export const openStates = [AlertState.FIRING, AlertState.ACKNOWLEDGED];

type AlertsRequest = { states?: AlertState[]; assetId?: string; ruleId?: string };

// useAlerts lists Alerts newest first: in `states` (every state when
// empty), of one Asset under every name it had, or raised by one Rule.
// The server returns only Alerts of Assets in the user's Scope. The
// Alerts inbox, an Asset's and a Rule's Alerts share it.
export function useAlerts(request: AlertsRequest, options: { enabled?: boolean } = {}) {
  return useQuery(AlertService.method.listAlerts, request, {
    refetchInterval: alertsPollMs,
    enabled: options.enabled,
  });
}
