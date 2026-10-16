import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";
import { healthRefetchMs } from "@/features/home/api/polling";

// useUnclaimedDevices loads the Devices no Asset claims, each with its
// health and last seen. Always empty for a scoped user.
export function useUnclaimedDevices(options: { enabled?: boolean } = {}) {
  return useQuery(
    RegistryService.method.listUnclaimedDevices,
    {},
    { refetchInterval: healthRefetchMs, enabled: options.enabled },
  );
}
