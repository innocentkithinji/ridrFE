import { create, type DescMessage, type DescMethodUnary, type MessageInitShape, type MessageShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { createQueryOptions, useTransport } from "@connectrpc/connect-query";
import { useQuery } from "@tanstack/react-query";

type Options = { enabled?: boolean; refetchInterval?: number; retry?: boolean };

// useQueryWhereNotFoundIsEmpty runs a query whose NotFound is a state,
// not an error (no Mapping yet, no Measurements yet): NotFound answers
// the method's empty response as data. Held as an error with no data, a
// background refetch would put the query back to pending, and the screen
// would swap what it shows (an editor someone is typing in) for Loading.
// Cached under the same key as connect-query's useQuery, so invalidations
// and setQueryData by method key still reach it.
export function useQueryWhereNotFoundIsEmpty<I extends DescMessage, O extends DescMessage>(
  method: DescMethodUnary<I, O>,
  input: MessageInitShape<I>,
  options: Options = {},
) {
  const transport = useTransport();
  const base = createQueryOptions(method, input, { transport });
  return useQuery({
    ...base,
    ...options,
    queryFn: async (context): Promise<MessageShape<O>> => {
      try {
        return await base.queryFn(context);
      } catch (error) {
        if (ConnectError.from(error).code === Code.NotFound) return create(method.output);
        throw error;
      }
    },
  });
}
