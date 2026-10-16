import { useQuery } from "@connectrpc/connect-query";
import { RuleService } from "@ridr/web";

// useRule loads one Rule. One outside the user's Scope reads as
// NotFound. (The list, which Contact groups share, is useRules in
// @/lib/api/rules.)
export function useRule(ruleId: string) {
  return useQuery(RuleService.method.getRule, { ruleId });
}
