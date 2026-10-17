import { QueryService } from "@ridr/web";
import { useQueryWhereNotFoundIsEmpty } from "@/lib/api/expected-not-found";

// useLatestReading loads a Device's newest Measurement, refetching every
// 60 s. A Device with no Measurement answers NotFound, held as data with
// no `reading` ("No Measurements yet.").
export function useLatestReading(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQueryWhereNotFoundIsEmpty(
    QueryService.method.getLatestReading,
    { deviceId },
    { refetchInterval: 60_000, retry: false, enabled: options.enabled },
  );
}
