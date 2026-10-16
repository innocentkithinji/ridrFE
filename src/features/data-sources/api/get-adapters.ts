import { useQuery } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";

// useAdapters lists every Adapter, retired ones included. Cached by
// method key.
export function useAdapters() {
  return useQuery(AdapterService.method.listAdapters, {});
}

// useAdapter finds one Adapter among them: there is no GetAdapter.
export function useAdapter(adapterId: string) {
  return useQuery(
    AdapterService.method.listAdapters,
    {},
    { select: (answer) => answer.adapters.find((a) => a.id === adapterId) ?? null },
  );
}
