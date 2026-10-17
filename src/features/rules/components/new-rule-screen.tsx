import { useNavigate } from "react-router";
import { useCreateRule } from "@/features/rules/api/change-rule";
import { newDraft, ruleOf } from "@/features/rules/components/rule-draft";
import { RuleForm } from "@/features/rules/components/rule-form";
import { ScopeNote } from "@/features/rules/components/scope-note";
import { BackToRules } from "@/features/rules/components/back-to-rules";
import { newAttributeRow, type AttributeRow } from "@/lib/attributes";
import { useMe } from "@/lib/me";

// NewRuleScreen is /rules/new: the create form, then the new Rule.
export function NewRuleScreen() {
  const create = useCreateRule();
  const navigate = useNavigate();
  const scopeRows = useScopeRows();
  return (
    <section className="space-y-6">
      <BackToRules />
      <h1 className="text-2xl font-semibold tracking-tight">New Rule</h1>
      <ScopeNote />
      <RuleForm
        initial={newDraft(scopeRows)}
        submitLabel="Create Rule"
        save={async (draft) => {
          const { rule } = await create.mutateAsync({ rule: ruleOf(draft) });
          await navigate(rule ? `/rules/${rule.id}` : "/rules");
        }}
        onCancel={() => void navigate("/rules")}
      />
    </section>
  );
}

// useScopeRows prefills the selector with the user's Scope: a key with
// one allowed value is filled in, a key with several waits for a choice.
function useScopeRows(): AttributeRow[] {
  const conditions = useMe().scope?.conditions ?? [];
  return conditions.map((condition) => ({
    ...newAttributeRow(),
    key: condition.key,
    value: condition.values.length === 1 ? condition.values[0] : "",
  }));
}
