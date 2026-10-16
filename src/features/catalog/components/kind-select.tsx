import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type KindSelectProps = Omit<ComponentProps<"select">, "children"> & {
  // The Quantity kinds to offer: the distinct kinds of ListUnits.
  kinds: string[];
};

// KindSelect picks one of the Quantity kinds Ridr knows.
export function KindSelect({ kinds, className, ...props }: KindSelectProps) {
  return (
    <select
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3",
        className,
      )}
      {...props}
    >
      <option value="" disabled>
        Choose a kind
      </option>
      {kinds.map((kind) => (
        <option key={kind} value={kind}>
          {kind}
        </option>
      ))}
    </select>
  );
}
