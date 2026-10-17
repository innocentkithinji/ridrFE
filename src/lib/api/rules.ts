import { useQuery } from "@connectrpc/connect-query";
import { RuleService } from "@ridr/web";

// useRules lists every Rule by name, disabled ones included. A scoped
// user gets only Rules whose selector lies inside their Scope. Rules
// lists them; Contact groups show which Rules notify each group.
export function useRules(options: { enabled?: boolean } = {}) {
  return useQuery(RuleService.method.listRules, {}, options);
}
