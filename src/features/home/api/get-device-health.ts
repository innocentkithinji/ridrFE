import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";
import { healthRefetchMs } from "@/features/home/api/polling";

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
