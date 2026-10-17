import type { ReprocessRawPayloadsResponse } from "@ridr/web";
import { ConnectorService } from "@ridr/web";
import { RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useReprocessRawPayloads } from "@/features/data-sources/api/reprocess-raw-payloads";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { reprocessingAnchor } from "@/features/data-sources/components/mapping-section";
import { Section } from "@/features/data-sources/components/section";
import {
  lastDay,
  windowTimes,
  WindowFields,
  type Window,
} from "@/features/data-sources/components/window-fields";
import { useCan } from "@/lib/me";

// ReprocessingSection lets an admin rebuild a Connector's Readings from
// the Raw payloads received in a window, with the current Mapping. For
// admins, on Adapters that aren't retired.
export function ReprocessingSection({ adapter, retired }: AdapterSectionProps) {
  const canReprocess = useCan(ConnectorService.method.reprocessRawPayloads);
  if (!canReprocess || retired) return null;
  return <Reprocessing adapterId={adapter.id} />;
}

function Reprocessing({ adapterId }: { adapterId: string }) {
  const [window, setWindow] = useState<Window>(lastDay);
  const [problem, setProblem] = useState<string | null>(null);
  const reprocess = useReprocessRawPayloads();

  function submit(event: FormEvent) {
    event.preventDefault();
    const times = windowTimes(window);
    setProblem(times.problem ?? null);
    if (times.problem !== undefined) return;
    reprocess.mutate({ adapterId, from: times.from, to: times.to });
  }

  return (
    <Section title="Reprocessing" id={reprocessingAnchor}>
      <p className="text-muted-foreground text-sm">
        Rebuild the Readings of the payloads received in a window with the current Mapping,
        replacing the ones they made before. Only payloads still kept can be reprocessed, and
        rebuilt Readings never raise Alerts. A long window takes a while.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <WindowFields value={window} onChange={setWindow} disabled={reprocess.isPending} />
        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
        <FormError id="reprocess-error" error={reprocess.error} />
        <Button type="submit" disabled={reprocess.isPending}>
          <RefreshCw className={reprocess.isPending ? "animate-spin" : undefined} aria-hidden />
          {reprocess.isPending ? "Reprocessing…" : "Reprocess"}
        </Button>
      </form>
      {reprocess.data && <Counts answer={reprocess.data} />}
    </Section>
  );
}

const plural = (n: bigint, one: string, many: string) => `${n} ${n === 1n ? one : many}`;

function Counts({ answer }: { answer: ReprocessRawPayloadsResponse }) {
  return (
    <p role="status" className="rounded-lg border p-3 text-sm">
      {plural(answer.reprocessed, "payload", "payloads")} reprocessed with Mapping version{" "}
      {answer.mappingVersion}: {plural(answer.readings, "Reading", "Readings")} rebuilt,{" "}
      {plural(answer.problems, "problem", "problems")}.
    </p>
  );
}
