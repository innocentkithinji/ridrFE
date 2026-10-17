import { ConnectorService } from "@ridr/web";
import { useQueryWhereNotFoundIsEmpty } from "@/lib/api/expected-not-found";

// useMapping is a Connector's current Mapping version. Cached by method
// key and request. A Connector without one answers NotFound, held as data
// with no `mapping` ("no Mapping yet"), so a background refetch never
// swaps the editor for Loading.
export function useMapping(adapterId: string) {
  return useQueryWhereNotFoundIsEmpty(ConnectorService.method.getMapping, { adapterId });
}
