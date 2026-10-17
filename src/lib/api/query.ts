import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";
import { textQuery } from "@/lib/use-live-query";

// useExplainQuery returns how Ridr understood a Query's text: its JSON
// form, with the defaults filled in. Cheap and needs no data. Explore
// shows it; a Dashboard Widget being edited plans its refresh from it.
export function useExplainQuery(text: string, options: { enabled: boolean }) {
  return useQuery(QueryService.method.explainQuery, textQuery(text), {
    enabled: options.enabled && text !== "",
  });
}

// One row per Device that reported a Measurement in the last day. Ridr
// has no list of Devices, so pickers offer these (with the Unclaimed
// ones) and still take any Device ID typed.
export const recentDevicesQuery = "measurements | range last 24h | rollup count every all by device";

// useRecentDevices names the Devices that reported in the last day.
export function useRecentDevices(options: { enabled: boolean }) {
  return useQuery(QueryService.method.runQuery, textQuery(recentDevicesQuery), {
    enabled: options.enabled,
    staleTime: 5 * 60_000,
    select: (answer) => answer.rows.map((row) => row.deviceId),
  });
}
