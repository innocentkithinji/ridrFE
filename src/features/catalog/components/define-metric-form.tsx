import { ConnectError } from "@connectrpc/connect";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDefineMetric } from "@/features/catalog/api/define-metric";
import { KindSelect } from "@/features/catalog/components/kind-select";
import { messageFor } from "@/lib/errors";

// DefineMetricForm adds a custom Metric to the Organisation's Catalog.
export function DefineMetricForm({ kinds }: { kinds: string[] }) {
  const ids = useId();
  const [name, setName] = useState("");
  const [quantityKind, setQuantityKind] = useState("");
  const define = useDefineMetric();
  const errorId = `${ids}-error`;

  function submit(event: FormEvent) {
    event.preventDefault();
    define.mutate(
      { name: name.trim(), quantityKind },
      {
        onSuccess: () => {
          setName("");
          setQuantityKind("");
        },
      },
    );
  }

  const error = define.error ? messageFor(ConnectError.from(define.error)) : null;
  return (
    <form
      aria-label="Add a Metric"
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
    >
      <div className="grid gap-1">
        <label htmlFor={`${ids}-name`} className="text-sm font-medium">
          Name
        </label>
        <Input
          id={`${ids}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="tyre_pressure"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-56 font-mono"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-kind`} className="text-sm font-medium">
          Quantity kind
        </label>
        <KindSelect
          id={`${ids}-kind`}
          kinds={kinds}
          value={quantityKind}
          onChange={(event) => setQuantityKind(event.target.value)}
          required
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <Button type="submit" disabled={define.isPending}>
        Add Metric
      </Button>
      {error && (
        <p id={errorId} role="alert" className="text-destructive basis-full text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
