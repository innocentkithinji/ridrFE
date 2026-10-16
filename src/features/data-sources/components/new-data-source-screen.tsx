import { ConnectError } from "@connectrpc/connect";
import { useState, type ComponentType, type FormEvent } from "react";
import { Link } from "react-router";
import { SecretDialog } from "@/components/secret-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentGuide } from "@/components/agent-guide/agent-guide";
import { CreateMqttBridgeForm } from "@/features/data-sources/components/mqtt-bridge-form";
import { useRegisterAdapter } from "@/features/data-sources/api/register-adapter";
import { Field } from "@/features/data-sources/components/section";
import { parseDeviceIds } from "@/features/data-sources/devices";
import { adapterPath, dataSourcesPath } from "@/features/data-sources/paths";
import { messageFor } from "@/lib/errors";

// A kind of data source an admin can add, with the form that adds it.
// Webhook connectors, Hosted MQTT connectors and MQTT bridges add theirs
// here.
type Kind = { id: string; label: string; description: string; form: ComponentType };

const kinds: Kind[] = [
  {
    id: "agent",
    label: "Adapter (for an Agent)",
    description: "A program you run yourself pushes Readings with the Ridr SDK and an Ingest key.",
    form: RegisterAdapterForm,
  },
  {
    id: "mqtt-bridge",
    label: "MQTT bridge",
    description: "Ridr subscribes to a topic on an MQTT broker elsewhere and keeps what arrives.",
    form: CreateMqttBridgeForm,
  },
];

// NewDataSourceScreen lets an admin choose a kind of data source and
// add one.
export function NewDataSourceScreen() {
  const [kindId, setKindId] = useState(kinds[0].id);
  const kind = kinds.find((k) => k.id === kindId) ?? kinds[0];
  const Form = kind.form;
  return (
    <section className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link to={dataSourcesPath} className="text-muted-foreground text-sm hover:underline">
          ← Data sources
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a data source</h1>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Kind</legend>
        {kinds.map((k) => (
          <label
            key={k.id}
            className="has-checked:border-primary flex cursor-pointer gap-3 rounded-lg border p-3"
          >
            <input
              type="radio"
              name="kind"
              value={k.id}
              checked={k.id === kindId}
              onChange={() => setKindId(k.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{k.label}</span>
              <span className="text-muted-foreground block text-sm">{k.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Form key={kind.id} />
    </section>
  );
}

type Registered = { adapterId: string; name: string; ingestKey: string };

// RegisterAdapterForm registers an Adapter for an Agent, shows its
// Ingest key once, then the Agent guide filled in with it. The key lives
// in this component's state only.
function RegisterAdapterForm() {
  const register = useRegisterAdapter();
  const [name, setName] = useState("");
  const [devices, setDevices] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [showingKey, setShowingKey] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const answer = await register.mutateAsync({
        name: name.trim(),
        deviceIds: parseDeviceIds(devices),
      });
      setRegistered({
        adapterId: answer.adapter?.id ?? "",
        name: answer.adapter?.name ?? name.trim(),
        ingestKey: answer.ingestKey?.plaintext ?? "",
      });
      setShowingKey(true);
    } catch (e) {
      setError(messageFor(ConnectError.from(e)));
    } finally {
      register.reset();
    }
  }

  if (registered && !showingKey) {
    return (
      <div className="space-y-6">
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>
            <strong>{registered.name}</strong> is registered. Build its Agent with the guide below.
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link to={adapterPath(registered.adapterId)}>Open {registered.name}</Link>
          </Button>
        </div>
        <AgentGuide adapterId={registered.adapterId} ingestKey={registered.ingestKey} />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Name" htmlFor="adapter-name" error={error}>
        <Input
          id="adapter-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Depot 3 gateway"
        />
      </Field>
      <Field
        label="Only these Devices (optional)"
        htmlFor="adapter-devices"
        hint="Device IDs, separated by commas or new lines. Leave empty for every Device. A key narrowed to Devices can't connect over Hosted MQTT."
      >
        <textarea
          id="adapter-devices"
          value={devices}
          onChange={(e) => setDevices(e.target.value)}
          rows={2}
          className="border-input dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1.5 font-mono text-sm"
        />
      </Field>
      <Button type="submit" disabled={register.isPending}>
        Register
      </Button>
      <SecretDialog
        title="Ingest key issued"
        secrets={
          registered && showingKey ? [{ label: "Ingest key", value: registered.ingestKey }] : null
        }
        onDone={() => setShowingKey(false)}
      >
        The Agent for {registered?.name} sends with this key as{" "}
        <code>Authorization: Bearer &lt;key&gt;</code>.
      </SecretDialog>
    </form>
  );
}
