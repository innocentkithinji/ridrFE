import { useQuery } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";

// The default and the most Raw payloads one request returns.
export const defaultRawPayloadLimit = 100;
export const maxRawPayloadLimit = 1000;

// useRawPayloads lists a Connector's newest Raw payloads, newest first:
// with onlyProblems, only those that made no Readings or whose Readings
// were refused. Cached by method key and request. Nothing polls: call
// refetch for fresh payloads.
export function useRawPayloads(
  adapterId: string,
  onlyProblems: boolean,
  limit: number = defaultRawPayloadLimit,
) {
  return useQuery(ConnectorService.method.listRawPayloads, { adapterId, onlyProblems, limit });
}

// useNewestRawPayload is the Connector's newest Raw payload, or
// undefined once loaded when it has received none: the Mapping editor's
// default sample and the source of its topic levels.
export function useNewestRawPayload(adapterId: string) {
  return useQuery(
    ConnectorService.method.listRawPayloads,
    { adapterId, onlyProblems: false, limit: 1 },
    { select: (data) => data.rawPayloads[0] },
  );
}
