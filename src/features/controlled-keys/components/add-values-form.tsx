import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddAllowedValues } from "@/features/controlled-keys/api/change-controlled-keys";
import { FormError } from "@/components/form-error";
import { parseValues } from "@/features/controlled-keys/components/parse-values";

// AddValuesForm allows more values for one Controlled key.
export function AddValuesForm({ controlledKey }: { controlledKey: string }) {
  const id = useId();
  const add = useAddAllowedValues();
  const [values, setValues] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate(
      { key: controlledKey, values: parseValues(values) },
      { onSuccess: () => setValues("") },
    );
  }

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex items-end gap-2">
        <label className="flex-1 space-y-1 text-sm">
          <span>Add values</span>
          <Input
            value={values}
            onChange={(event) => setValues(event.target.value)}
            placeholder="comma-separated"
            aria-invalid={add.isError || undefined}
            aria-describedby={add.isError ? `${hintId} ${errorId}` : hintId}
          />
        </label>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          Add
        </Button>
      </div>
      <p id={hintId} className="text-muted-foreground text-xs">
        Values can't be renamed: add the new value, move Assets to it, then remove the old.
      </p>
      <FormError id={errorId} error={add.error} />
    </form>
  );
}
