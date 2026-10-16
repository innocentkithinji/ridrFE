import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// Device health changes on a 15-minute scale, and Devices appear on their
// first Reading, so health and the Unclaimed list refetch this often;
// faster polling only adds load.
export const healthRefetchMs = 60_000;

// Query editors (Explore, Dashboard Widgets) complete Asset names; the
// registry changes rarely while someone writes a Query, so their list
// stays fresh this long.
export const vocabularyStaleTime = 5 * 60_000;

// useAssets loads every Asset the user may see, by name. Ridr sends them
// all at once; screens filter and sort in the browser. Home, Assets,
// Explore, Dashboards, Rules, Silences and Controlled keys share it.
export function useAssets(options: { enabled?: boolean; staleTime?: number } = {}) {
  return useQuery(RegistryService.method.listAssets, {}, options);
}

// useDeviceHealth tells whether a Device is live, silent or never seen,
// counting every Reading, with its exact last seen. NEVER_SEEN for a
// Device outside the user's Scope.
export function useDeviceHealth(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery(
    RegistryService.method.getDeviceHealth,
    { deviceId },
    { refetchInterval: healthRefetchMs, enabled: options.enabled },
  );
}

// useUnclaimedDevices loads the Devices no Asset claims, oldest first,
// each with its health and last seen. Always empty for a scoped user.
export function useUnclaimedDevices(options: { enabled?: boolean } = {}) {
  return useQuery(
    RegistryService.method.listUnclaimedDevices,
    {},
    { refetchInterval: healthRefetchMs, enabled: options.enabled },
  );
}

// useControlledKeys lists every Controlled key with its sorted allowed
// values. Pickers across the app (Assets, Silences, Rules, Team) reuse it.
export function useControlledKeys() {
  return useQuery(RegistryService.method.listControlledKeys, {});
}
