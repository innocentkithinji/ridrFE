import { useQuery } from "@connectrpc/connect-query";
import { QueryService } from "@ridr/web";
import { textQuery } from "@/lib/use-live-query";

// useExplainQuery reads a Widget Query's JSON form from its text, for a
// Widget being edited, whose JSON form Ridr hasn't filled in yet.
export function useExplainQuery(text: string, options: { enabled: boolean }) {
  return useQuery(QueryService.method.explainQuery, textQuery(text), {
    enabled: options.enabled && text !== "",
  });
}
