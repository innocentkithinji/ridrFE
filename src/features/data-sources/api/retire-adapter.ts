import { useMutation } from "@connectrpc/connect-query";
import { AdapterService } from "@ridr/web";
import {
  adapterServiceKey,
  connectorServiceKey,
  useInvalidate,
} from "@/features/data-sources/api/keys";

// useRetireAdapter retires an Adapter and revokes its keys. It may have
// been a Connector, so every Adapter and Connector query reloads.
export function useRetireAdapter() {
  return useMutation(AdapterService.method.retireAdapter, {
    onSuccess: useInvalidate(adapterServiceKey, connectorServiceKey),
  });
}
