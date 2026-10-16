import { useQuery } from "@connectrpc/connect-query";
import { AlertService, RuleService } from "@ridr/web";

// Live queries carry Readings only, so a Rule's Alerts poll, as the
// Alerts inbox does.
const alertsPollMs = 15_000;

// useRules lists every Rule by name, disabled ones included. A scoped
// user gets only Rules whose selector lies inside their Scope.
export function useRules() {
  return useQuery(RuleService.method.listRules, {});
}

// useRule loads one Rule. One outside the user's Scope reads as
// NotFound.
export function useRule(ruleId: string) {
  return useQuery(RuleService.method.getRule, { ruleId });
}

// useRuleAlerts lists the Alerts a Rule raised, newest first.
export function useRuleAlerts(ruleId: string, options: { enabled: boolean }) {
  return useQuery(
    AlertService.method.listAlerts,
    { ruleId },
    { refetchInterval: alertsPollMs, enabled: options.enabled },
  );
}
