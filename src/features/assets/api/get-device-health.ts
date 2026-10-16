import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// useDeviceHealth tells whether a Device is live, silent or never seen,
// refetching every 60 s.
export function useDeviceHealth(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery(
    RegistryService.method.getDeviceHealth,
    { deviceId },
    { refetchInterval: 60_000, enabled: options.enabled },
  );
}
