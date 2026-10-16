import { skipToken, useQuery } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import { useMemo } from "react";
import { useCan } from "@/lib/me";

// useAdapterNames maps each Adapter's ID to its name, or is empty when
// the user may not list Adapters.
export function useAdapterNames(): Map<string, string> {
  const canList = useCan(AdapterService.method.listAdapters);
  const adapters = useQuery(AdapterService.method.listAdapters, canList ? {} : skipToken);
  return useMemo(
    () => new Map((adapters.data?.adapters ?? []).map((adapter) => [adapter.id, adapter.name])),
    [adapters.data],
  );
}
