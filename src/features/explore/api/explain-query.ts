import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";
import { textQuery } from "@/lib/use-live-query";

// useExplainQuery returns how Ridr understood a Query's text: its JSON
// form, with the defaults filled in. Cheap and needs no data.
export function useExplainQuery(text: string, options: { enabled: boolean }) {
  return useQuery(QueryService.method.explainQuery, textQuery(text), {
    enabled: options.enabled && text !== "",
  });
}
