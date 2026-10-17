import { useQuery } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import { useMemo } from "react";
import { useCan } from "@/lib/me";

// useAdapters lists every Adapter, retired ones included.
export function useAdapters(options: { enabled?: boolean } = {}) {
  return useQuery(AdapterService.method.listAdapters, {}, options);
}

// useAdapter finds one Adapter among them: there is no GetAdapter.
export function useAdapter(adapterId: string) {
  return useQuery(
    AdapterService.method.listAdapters,
    {},
    { select: (answer) => answer.adapters.find((a) => a.id === adapterId) ?? null },
  );
}

// useAdapterNames maps each Adapter's ID to its name, or is empty when
// the user may not list Adapters.
export function useAdapterNames(): Map<string, string> {
  const adapters = useAdapters({ enabled: useCan(AdapterService.method.listAdapters) });
  return useMemo(
    () => new Map((adapters.data?.adapters ?? []).map((adapter) => [adapter.id, adapter.name])),
    [adapters.data],
  );
}
