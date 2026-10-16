import { ConnectorService, type RawPayload } from "@ridr/web";
import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { QueryView } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  defaultRawPayloadLimit,
  maxRawPayloadLimit,
  useRawPayloads,
} from "@/features/data-sources/api/get-raw-payloads";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { When } from "@/features/data-sources/components/format";
import { Section } from "@/features/data-sources/components/section";
import { decodeBody } from "@/features/data-sources/raw-payload";
import { useCan } from "@/lib/me";

// How many of the newest payloads one may ask for.
const limits = [10, 50, defaultRawPayloadLimit, 500, maxRawPayloadLimit];

// RawPayloadsSection lists the payloads a Connector received, newest
// first, as Ridr kept them: decoded body, topic, the Mapping version that
// read them and the problem when they made no Readings. It is for
// admins, on Adapters that aren't retired, and refreshes only on demand.
export function RawPayloadsSection({ adapter, retired }: AdapterSectionProps) {
  const canList = useCan(ConnectorService.method.listRawPayloads);
  if (!canList || retired) return null;
  return <RawPayloads adapterId={adapter.id} />;
}

function RawPayloads({ adapterId }: { adapterId: string }) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [limit, setLimit] = useState(defaultRawPayloadLimit);
  const payloads = useRawPayloads(adapterId, onlyProblems, limit);
  const limitId = useId();

  return (
    <Section
      title="Raw payloads"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void payloads.refetch()}
          disabled={payloads.isFetching}
        >
          <RefreshCw className={payloads.isFetching ? "animate-spin" : undefined} aria-hidden />
          Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label htmlFor={limitId} className="flex items-center gap-2">
          Newest
          <select
            id={limitId}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
          >
            {limits.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
          />
          Problems only
        </label>
      </div>
      <QueryView
        query={payloads}
        what="Raw payloads"
        isEmpty={(data) => data.rawPayloads.length === 0}
        empty={onlyProblems ? "No payloads with problems." : "No payloads received yet."}
      >
        {(data) => (
          <ol className="space-y-3">
            {data.rawPayloads.map((payload) => (
              <RawPayloadItem key={payload.id} payload={payload} />
            ))}
          </ol>
        )}
      </QueryView>
    </Section>
  );
}

function RawPayloadItem({ payload }: { payload: RawPayload }) {
  const body = decodeBody(payload.body);
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <When at={payload.receivedTime} />
        {payload.topic && (
          <span>
            Topic <code className="text-foreground font-mono">{payload.topic}</code>
          </span>
        )}
        <span>
          {payload.mappingVersion > 0
            ? `Mapping version ${payload.mappingVersion}`
            : "No Mapping"}
        </span>
        {!body.json && <Badge variant="outline">Text</Badge>}
      </div>
      {payload.problem && (
        <p className="text-destructive text-sm">
          <span className="font-medium">Problem:</span> {payload.problem}
        </p>
      )}
      <pre className="bg-muted/50 max-h-80 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap break-all">
        {body.text}
      </pre>
    </li>
  );
}
