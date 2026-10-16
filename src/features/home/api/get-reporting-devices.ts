import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";
import { textQuery } from "@/lib/use-live-query";
import { healthRefetchMs } from "@/lib/api/registry";

// One row per Device with a Measurement in the last 15 minutes: the same
// line GetDeviceHealth draws between live and silent.
export const reportingDevicesQuery = "measurements | range last 15m | rollup count every all by device";

// useReportingDevices tells which Devices are live, by Device ID.
export function useReportingDevices(options: { enabled?: boolean } = {}) {
  return useQuery(QueryService.method.runQuery, textQuery(reportingDevicesQuery), {
    refetchInterval: healthRefetchMs,
    enabled: options.enabled,
    select: (answer) => new Set(answer.rows.map((row) => row.deviceId)),
  });
}
