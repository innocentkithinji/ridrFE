import type { Rule } from "@ridr/web";
import { Link } from "react-router";

// RuleLinks lists Rules as links to each Rule's screen, after label.
export function RuleLinks({ rules, label }: { rules: Rule[]; label: string }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label} </span>
      <ul className="inline">
        {rules.map((rule, i) => (
          <li key={rule.id} className="inline">
            {i > 0 && ", "}
            <Link to={`/rules/${rule.id}`} className="text-foreground underline underline-offset-4">
              {rule.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
