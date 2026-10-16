import { RegistryService, type ControlledKey } from "@ridr/web";
import { X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { useRemoveAllowedValues } from "@/features/controlled-keys/api/change-controlled-keys";
import { assetCount, type ValueUsage } from "@/features/controlled-keys/api/get-value-usage";
import { AddValuesForm } from "@/features/controlled-keys/components/add-values-form";
import { FormError } from "@/features/controlled-keys/components/form-error";
import { Can, useCan } from "@/lib/me";
import { cn } from "@/lib/utils";

type ControlledKeyCardProps = {
  controlledKey: ControlledKey;
  // Undefined while loading, or when the user may not list Assets.
  usage: ValueUsage | undefined;
};

// ControlledKeyCard shows one Controlled key's allowed values, as the
// server holds them, with how many Assets hold each. Admins add and
// remove values here.
export function ControlledKeyCard({ controlledKey, usage }: ControlledKeyCardProps) {
  const id = useId();
  const counts = usage?.get(controlledKey.key);
  const canRemove = useCan(RegistryService.method.removeAllowedValues);
  const remove = useRemoveAllowedValues();
  const removing = remove.variables?.values?.[0];
  const removingCount = removing === undefined ? 0 : (counts?.get(removing) ?? 0);

  return (
    <section aria-labelledby={`${id}-key`} className="space-y-3 rounded-lg border p-4">
      <h2 id={`${id}-key`} className="font-mono font-semibold">
        {controlledKey.key}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {controlledKey.allowedValues.map((value) => (
          <li
            key={value}
            className={cn(
              "bg-muted flex items-center rounded-md py-0.5 pl-2 font-mono text-sm",
              canRemove ? "pr-1" : "pr-2",
            )}
          >
            {value}
            {usage && (
              <span className="text-muted-foreground ml-2 font-sans text-xs">
                {assetCount(counts?.get(value) ?? 0)}
              </span>
            )}
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="ml-1"
                aria-label={`Remove ${value}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate({ key: controlledKey.key, values: [value] })}
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <FormError id={`${id}-remove-error`} error={remove.error}>
        {removingCount > 0 && ` ${assetCount(removingCount)} still hold ${removing}.`}
      </FormError>
      <Can method={RegistryService.method.addAllowedValues}>
        <AddValuesForm controlledKey={controlledKey.key} />
      </Can>
    </section>
  );
}
