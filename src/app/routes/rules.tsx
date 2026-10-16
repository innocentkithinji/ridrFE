import { RuleService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { NewRuleScreen } from "@/features/rules/components/new-rule-screen";
import { RuleDetailScreen } from "@/features/rules/components/rule-detail-screen";
import { RulesScreen } from "@/features/rules/components/rules-screen";
import { permissionOf } from "@/lib/me";

export const rulesPath = "/rules";

export const newRulePath = "/rules/new";

export const ruleDetailPath = "/rules/:ruleId";

export const rulesPermission = permissionOf(RuleService.method.listRules);

export function RulesRoute() {
  return (
    <RequirePermission permission={rulesPermission} what="Rules">
      <RulesScreen />
    </RequirePermission>
  );
}

export function NewRuleRoute() {
  return (
    <RequirePermission permission={permissionOf(RuleService.method.createRule)} what="creating Rules">
      <NewRuleScreen />
    </RequirePermission>
  );
}

export function RuleDetailRoute() {
  const { ruleId = "" } = useParams();
  return (
    <RequirePermission permission={permissionOf(RuleService.method.getRule)} what="Rules">
      {/* Keyed so moving between Rules starts each one afresh. */}
      <RuleDetailScreen key={ruleId} ruleId={ruleId} />
    </RequirePermission>
  );
}
