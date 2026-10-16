import { useQuery } from "@connectrpc/connect-query";
import { RuleService } from "@ridr/web";

// useRules lists every Rule, disabled ones included, to show which Rules
// notify each Contact group.
export function useRules(options: { enabled: boolean }) {
  return useQuery(RuleService.method.listRules, {}, options);
}
