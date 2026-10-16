import { useQuery } from "@connectrpc/connect-query";
import { QueryService, RegistryService } from "@ridr/web";

// A Device's health and latest Reading refetch this often while shown.
const refreshMs = 60_000;

// useDeviceHealth tells whether a Device is live, silent or never seen.
export function useDeviceHealth(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery(
    RegistryService.method.getDeviceHealth,
    { deviceId },
    { refetchInterval: refreshMs, enabled: options.enabled },
  );
}

// useLatestReading loads a Device's newest Measurement by device time;
// it fails with NotFound for a Device with no Measurement.
export function useLatestReading(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery(
    QueryService.method.getLatestReading,
    { deviceId },
    { refetchInterval: refreshMs, enabled: options.enabled },
  );
}
