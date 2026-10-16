import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";

// useLatestReading loads a Device's newest Measurement, refetching every
// 60 s. It is NotFound for a Device with no Measurement.
export function useLatestReading(deviceId: string) {
  return useQuery(
    QueryService.method.getLatestReading,
    { deviceId },
    { refetchInterval: 60_000, retry: false },
  );
}
