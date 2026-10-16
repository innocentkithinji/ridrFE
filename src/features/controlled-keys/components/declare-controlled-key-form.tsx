import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeclareControlledKey } from "@/features/controlled-keys/api/change-controlled-keys";
import { FormError } from "@/components/form-error";
import { parseValues } from "@/features/controlled-keys/components/parse-values";

// DeclareControlledKeyForm makes an Attribute key controlled, with the
// values Assets may have for it.
export function DeclareControlledKeyForm() {
  const id = useId();
  const declare = useDeclareControlledKey();
  const [key, setKey] = useState("");
  const [values, setValues] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    declare.mutate(
      { key: key.trim(), allowedValues: parseValues(values) },
      {
        onSuccess: () => {
          setKey("");
          setValues("");
        },
      },
    );
  }

  const errorId = `${id}-error`;
  const invalid = declare.isError || undefined;
  return (
    <form
      aria-labelledby={`${id}-title`}
      onSubmit={submit}
      className="space-y-3 rounded-lg border p-4"
    >
      <h2 id={`${id}-title`} className="font-semibold">
        Declare a Controlled key
      </h2>
      <p className="text-muted-foreground text-sm">
        A Controlled key can't be un-controlled later. Values are case-sensitive.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <label className="space-y-1 text-sm">
          <span>Key</span>
          <Input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="site"
            aria-invalid={invalid}
            aria-describedby={declare.isError ? errorId : undefined}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Allowed values</span>
          <Input
            value={values}
            onChange={(event) => setValues(event.target.value)}
            placeholder="nairobi, mombasa"
            aria-invalid={invalid}
            aria-describedby={declare.isError ? errorId : undefined}
          />
        </label>
        <Button type="submit" disabled={declare.isPending}>
          Declare
        </Button>
      </div>
      <FormError id={errorId} error={declare.error} />
    </form>
  );
}
