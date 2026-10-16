import { useQuery } from "@connectrpc/connect-query";
import { AlertService, AlertState } from "@ridr/web";
import { alertsPollMs } from "@/features/alerts/api/polling";

// Alerts in these states need someone's attention.
export const openStates = [AlertState.FIRING, AlertState.ACKNOWLEDGED];

// useAlerts lists Alerts in states (every state when empty), newest
// first. The server returns only Alerts of Assets in the user's Scope.
export function useAlerts(states: AlertState[]) {
  return useQuery(AlertService.method.listAlerts, { states }, { refetchInterval: alertsPollMs });
}

// useOpenAlerts lists the open Alerts, of one Asset (under every name it
// had) when assetId is given, newest first.
export function useOpenAlerts(assetId = "") {
  return useQuery(
    AlertService.method.listAlerts,
    { states: openStates, assetId },
    { refetchInterval: alertsPollMs },
  );
}
