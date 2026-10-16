import { Code, ConnectError } from "@connectrpc/connect";
import { useQuery } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";

// useMapping is a Connector's current Mapping version. Cached by method
// key and request. A Connector without one fails with NotFound: see
// isNoMapping.
export function useMapping(adapterId: string) {
  return useQuery(ConnectorService.method.getMapping, { adapterId });
}

// isNoMapping tells whether GetMapping failed because the Connector has
// no Mapping yet, which is a state, not an error.
export function isNoMapping(error: unknown): boolean {
  return !!error && ConnectError.from(error).code === Code.NotFound;
}
