import { keepPreviousData } from "@tanstack/react-query";
import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";
import { textQuery } from "@/lib/use-live-query";

type RunOptions = {
  // Rerun this often, in ms, as a rollup whose range ends now does.
  refetchInterval?: number | false;
};

// useRunQuery answers a Query written as text, once there is text: the
// screen passes the text the user ran, never the one being typed. Its cache entry is the
// one a Live query of the same text writes, so a screen can switch to
// streaming without losing the answer. While a new text loads, the last
// answer stays (isPlaceholderData) so the screen can dim it.
export function useRunQuery(text: string, options: RunOptions) {
  return useQuery(QueryService.method.runQuery, textQuery(text), {
    enabled: text !== "",
    refetchInterval: options.refetchInterval,
    placeholderData: keepPreviousData,
  });
}
