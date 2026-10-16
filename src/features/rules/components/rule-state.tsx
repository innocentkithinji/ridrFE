import type { Rule } from "@ridr/web";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// RuleStateBadge says whether a Rule is evaluating, or since when it is
// disabled.
export function RuleStateBadge({ rule }: { rule: Rule }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        rule.disabled ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {rule.disabled ? `Disabled since ${formatTime(rule.disabledAt)}` : "Enabled"}
    </span>
  );
}
