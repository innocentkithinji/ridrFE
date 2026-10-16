import { RuleService, type Rule } from "@ridr/web";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useRules } from "@/lib/api/rules";
import { kindOf, selectorText } from "@/features/rules/components/rule-draft";
import { RuleStateBadge } from "@/features/rules/components/rule-state";
import { ScopeNote } from "@/features/rules/components/scope-note";
import { Can, useCan } from "@/lib/me";

// RulesScreen is /rules: every Rule by name, disabled ones included,
// with its kind, selector and state.
export function RulesScreen() {
  const rules = useRules();
  const canCreate = useCan(RuleService.method.createRule);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
        <Can method={RuleService.method.createRule}>
          <CreateLink />
        </Can>
      </header>
      <ScopeNote />
      <QueryView
        query={rules}
        what="Rules"
        isEmpty={(answer) => answer.rules.length === 0}
        empty={
          <span className="flex flex-col items-center gap-3">
            No Rules yet. Rules raise Alerts when Readings break them.
            {canCreate && <CreateLink />}
          </span>
        }
      >
        {(answer) => <RulesTable rules={answer.rules} />}
      </QueryView>
    </section>
  );
}

function CreateLink() {
  return (
    <Button asChild>
      <Link to="/rules/new">
        <Plus aria-hidden /> Create
      </Link>
    </Button>
  );
}

function RulesTable({ rules }: { rules: Rule[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label="Rules" className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Watches</th>
            <th className="px-3 py-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-t">
              <td className="px-3 py-2">
                <Link to={`/rules/${rule.id}`} className="font-medium hover:underline">
                  {rule.name}
                </Link>
              </td>
              <td className="px-3 py-2">{kindOf(rule)}</td>
              <td className="px-3 py-2 break-all">{selectorText(rule.selector)}</td>
              <td className="px-3 py-2">
                <RuleStateBadge rule={rule} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
