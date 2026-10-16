import { useQuery } from "@connectrpc/connect-query";
import { RegistryService } from "@ridr/web";

// Devices appear on their first Reading, so the list refetches while open.
const refetchMs = 60_000;

// useUnclaimedDevices loads the Devices no Asset claims, oldest first.
export function useUnclaimedDevices() {
  return useQuery(RegistryService.method.listUnclaimedDevices, {}, { refetchInterval: refetchMs });
}
