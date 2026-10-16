import { ConnectError } from "@connectrpc/connect";
import { TriangleAlert } from "lucide-react";
import { useState, type ComponentType, type FormEvent } from "react";
import { Link } from "react-router";
import { SecretDialog, type Secret } from "@/components/secret-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateHostedMqttConnector } from "@/features/data-sources/api/create-hosted-mqtt-connector";
import { useCreateWebhookConnector } from "@/features/data-sources/api/create-webhook-connector";
import { Field } from "@/features/data-sources/components/section";
import { adapterPath } from "@/features/data-sources/paths";
import { rememberWebhookUrl } from "@/features/data-sources/webhook-urls";
import { messageFor } from "@/lib/errors";

// A connector just created: its Adapter and the secrets to show once.
type Created = { adapterId: string; name: string; secrets: Secret[]; topic?: string };

// WebhookConnectorForm creates a Webhook connector and shows its URL,
// which holds its Ingest key, once.
export function WebhookConnectorForm() {
  const create = useCreateWebhookConnector();
  return (
    <ConnectorForm
      placeholder="The Things Stack"
      secretTitle="Webhook URL issued"
      explain={WebhookExplain}
      create={async (name) => {
        const answer = await create.mutateAsync({ name });
        create.reset();
        const adapterId = answer.adapter?.id ?? "";
        rememberWebhookUrl(adapterId, answer.url, answer.ingestKey?.plaintext ?? "");
        return {
          adapterId,
          name: answer.adapter?.name ?? name,
          secrets: [{ label: "Webhook URL", value: answer.url }],
        };
      }}
      pending={create.isPending}
    />
  );
}

// HostedMqttConnectorForm creates a Hosted MQTT connector and shows how
// devices connect to it once: broker URL, username, topic and password.
export function HostedMqttConnectorForm() {
  const create = useCreateHostedMqttConnector();
  return (
    <ConnectorForm
      placeholder="Cold room loggers"
      secretTitle="Hosted MQTT connector created"
      explain={HostedMqttExplain}
      create={async (name) => {
        const answer = await create.mutateAsync({ name });
        create.reset();
        return {
          adapterId: answer.adapter?.id ?? "",
          name: answer.adapter?.name ?? name,
          topic: answer.topic,
          secrets: [
            { label: "Topic", value: answer.topic },
            { label: "Broker URL", value: answer.brokerUrl },
            { label: "Username", value: answer.username },
            { label: "Password", value: answer.ingestKey?.plaintext ?? "" },
          ],
        };
      }}
      pending={create.isPending}
    />
  );
}

function WebhookExplain({ created }: { created: Created }) {
  return <>Give the vendor cloud this URL for {created.name}: it POSTs payloads to it.</>;
}

function HostedMqttExplain({ created }: { created: Created }) {
  return (
    <>
      Devices for {created.name} connect with MQTT 3.1.1 using these.
      <TopicWarning topic={created.topic ?? ""} />
    </>
  );
}

function TopicWarning({ topic }: { topic: string }) {
  return (
    <span
      role="note"
      className="border-amber-500/50 text-foreground mt-3 flex gap-2 rounded-lg border bg-amber-500/10 p-2"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <span>
        Publish only to <code className="font-mono font-semibold">{topic}</code> or a topic below
        it, such as <code className="font-mono">{topic}/fridge-3</code>. The broker drops
        publishes to any other topic without telling the device.
      </span>
    </span>
  );
}

type ConnectorFormProps = {
  placeholder: string;
  secretTitle: string;
  // Says what the secrets are for.
  explain: ComponentType<{ created: Created }>;
  // Creates the connector; rejects with the server's error.
  create: (name: string) => Promise<Created>;
  pending: boolean;
};

// ConnectorForm names a new connector, creates it and shows its secrets
// once. They live in this component's state only, dropped on "Done".
function ConnectorForm(props: ConnectorFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [showing, setShowing] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setCreated(await props.create(name.trim()));
      setShowing(true);
    } catch (e) {
      setError(messageFor(ConnectError.from(e)));
    }
  }

  if (created && !showing) {
    return (
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span>
          <strong>{created.name}</strong> is created. Give it a Mapping so its payloads make
          Readings.
        </span>
        <Button size="sm" variant="outline" asChild>
          <Link to={adapterPath(created.adapterId)}>Open {created.name}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Name" htmlFor="connector-name" error={error}>
        <Input
          id="connector-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={props.placeholder}
        />
      </Field>
      <Button type="submit" disabled={props.pending}>
        Create
      </Button>
      <SecretDialog
        title={props.secretTitle}
        secrets={created && showing ? created.secrets : null}
        onDone={() => {
          setShowing(false);
          setCreated((c) => c && { ...c, secrets: [] });
        }}
      >
        {created && <props.explain created={created} />}
      </SecretDialog>
    </form>
  );
}
