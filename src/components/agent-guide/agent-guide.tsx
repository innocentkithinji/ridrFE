import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/config/env";
import { CodeBlock, Placeholder } from "@/components/agent-guide/code-block";
import { examples } from "@/components/agent-guide/examples";
import { placeholders, type GuideValues } from "@/components/agent-guide/fill";

type AgentGuideProps = {
  // The Adapter the Agent sends for. Left out, the guide shows a
  // placeholder.
  adapterId?: string;
  // A newly issued Ingest key for that Adapter. Left out, the guide shows
  // a placeholder.
  ingestKey?: string;
};

// AgentGuide tells anyone how to build an Agent with the Ridr SDK in Go,
// Python or TypeScript. It calls nothing: the public guide shows
// placeholders, and a screen that has just registered an Adapter passes
// its ID and Ingest key to fill them in.
export function AgentGuide({ adapterId, ingestKey }: AgentGuideProps) {
  const values: GuideValues = { ridrUrl: env.apiUrl, adapterId, ingestKey };
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Build an Agent</h1>
        <p className="text-muted-foreground">
          An Agent is an Adapter you run yourself, for example on a site gateway, that pushes
          Readings to Ridr. The Ridr SDK queues them in memory, sends them in batches, keeps them
          while Ridr is out of reach and slows down when Ridr asks it to.
        </p>
      </header>

      <ol className="list-decimal space-y-4 pl-5">
        <Step title="Register an Adapter">
          An admin registers one under Settings → Data sources → New, choosing{" "}
          <em>Adapter (for an Agent)</em>. Every Reading the Agent sends is traced back to it.
          <Value label="Adapter ID" value={adapterId} placeholder={placeholders.ADAPTER_ID} />
        </Step>
        <Step title="Use an Ingest key">
          Issue an Ingest key for the Adapter. It lets the Agent send data and nothing else: it can
          never read data, and it can be narrowed to particular Devices. Ridr shows it once, so
          keep it somewhere safe.
          <Value label="Ingest key" value={ingestKey} placeholder={placeholders.INGEST_KEY} />
        </Step>
        <Step title="Declare a Manifest">
          List the metrics the Agent sends and the unit of each. The SDK publishes the Manifest
          before the first batch; a change (say, new firmware) becomes a new version, and each
          Reading records the version it arrived under. A Measurement may still give its own unit.
        </Step>
        <Step title="Send Readings">
          Queue the three kinds of Reading from anywhere in your program:{" "}
          <strong>Measurements</strong> (a numeric value of a metric, such as 4.2 °C),{" "}
          <strong>Locations</strong> (a position) and <strong>Events</strong> (something that
          happened, such as a door opening). Tags such as <code>route=46</code> describe the
          circumstances. Flush once more before the Agent exits.
        </Step>
      </ol>

      <Tabs defaultValue={examples[0].language}>
        <TabsList aria-label="SDK language">
          {examples.map((example) => (
            <TabsTrigger key={example.language} value={example.language}>
              {example.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {examples.map((example) => (
          <TabsContent key={example.language} value={example.language} className="space-y-4">
            <section className="space-y-2">
              <h2 className="text-sm font-medium">Install</h2>
              <CodeBlock text={example.install} values={values} copyLabel="Copy" />
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-medium">Example</h2>
              <CodeBlock text={example.code} values={values} copyLabel="Copy example" />
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </article>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="space-y-1">
      <h2 className="font-medium">{title}</h2>
      <div className="text-muted-foreground space-y-2 text-sm">{children}</div>
    </li>
  );
}

// Value shows a value the Agent needs, or its placeholder.
function Value(props: { label: string; value?: string; placeholder: string }) {
  return (
    <p>
      {props.label}:{" "}
      {props.value ? (
        <code className="text-foreground font-mono">{props.value}</code>
      ) : (
        <Placeholder>
          <span className="font-mono">{props.placeholder}</span>
        </Placeholder>
      )}
    </p>
  );
}
