import { ConnectorService } from "@ridr/web";
import { useId, useState, type FormEvent } from "react";
import { FormError } from "@/components/form-error";
import { ErrorState, Loading } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  maxRetentionDays,
  minRetentionDays,
  useRawPayloadRetention,
  useSetRawPayloadRetention,
} from "@/features/data-sources/api/raw-payload-retention";
import { Section } from "@/features/data-sources/components/section";
import { useCan } from "@/lib/me";

// RetentionSection shows how long the Organisation keeps Raw payloads,
// which bounds how far back Reprocessing reaches; admins change it.
export function RetentionSection() {
  const canGet = useCan(ConnectorService.method.getRawPayloadRetention);
  if (!canGet) return null;
  return <Retention />;
}

function Retention() {
  const retention = useRawPayloadRetention();
  const canSet = useCan(ConnectorService.method.setRawPayloadRetention);
  return (
    <Section title="Raw payload retention">
      {retention.isPending ? (
        <Loading what="retention" />
      ) : retention.error ? (
        <ErrorState error={retention.error} />
      ) : canSet ? (
        <RetentionForm days={retention.data.days} />
      ) : (
        <p className="text-sm">
          Raw payloads are kept for {retention.data.days} days, for every data source.
        </p>
      )}
    </Section>
  );
}

function RetentionForm({ days }: { days: number }) {
  const [value, setValue] = useState(String(days));
  const [problem, setProblem] = useState<string | null>(null);
  const setRetention = useSetRawPayloadRetention();
  const id = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(value);
    if (!Number.isInteger(n) || n < minRetentionDays || n > maxRetentionDays) {
      setProblem(`Days must be a whole number from ${minRetentionDays} to ${maxRetentionDays}.`);
      return;
    }
    setProblem(null);
    setRetention.mutate({ days: n });
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <p className="text-muted-foreground text-sm">
        How long every data source's Raw payloads are kept. Only payloads still kept can be
        reprocessed.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium">
            Days
          </label>
          <Input
            id={id}
            type="number"
            min={minRetentionDays}
            max={maxRetentionDays}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setRetention.reset();
            }}
            aria-invalid={!!problem}
            aria-describedby={problem ? `${id}-error` : undefined}
            className="w-28"
          />
        </div>
        <Button type="submit" disabled={setRetention.isPending}>
          Save
        </Button>
      </div>
      {problem && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      )}
      <FormError id={`${id}-error`} error={setRetention.error} />
      {setRetention.isSuccess && (
        <p role="status" className="text-sm">
          Saved. Kept for {setRetention.variables.days} days.
        </p>
      )}
    </form>
  );
}
