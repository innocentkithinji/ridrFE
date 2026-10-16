import { ConnectError } from "@connectrpc/connect";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useDefineMetric } from "@/features/catalog/api/define-metric";
import { KindSelect } from "@/features/catalog/components/kind-select";
import { messageFor } from "@/lib/errors";

// ReviewMetric lets an admin review an unreviewed Metric by choosing its
// Quantity kind; Ridr then converts its Readings like any other.
export function ReviewMetric({ name, kinds }: { name: string; kinds: string[] }) {
  const errorId = useId();
  const [choosing, setChoosing] = useState(false);
  const [quantityKind, setQuantityKind] = useState("");
  const define = useDefineMetric();

  if (!choosing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
        Choose kind
      </Button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    define.mutate({ name, quantityKind });
  }

  const error = define.error ? messageFor(ConnectError.from(define.error)) : null;
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <KindSelect
        aria-label={`Quantity kind of ${name}`}
        kinds={kinds}
        value={quantityKind}
        onChange={(event) => setQuantityKind(event.target.value)}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <Button type="submit" size="sm" disabled={define.isPending}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setChoosing(false)}>
        Cancel
      </Button>
      {error && (
        <p id={errorId} role="alert" className="text-destructive basis-full text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
