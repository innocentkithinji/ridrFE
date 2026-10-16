import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateMqttBridge } from "@/features/data-sources/api/create-mqtt-bridge";
import {
  bridgeError,
  brokerUrlHint,
  topicFilterHint,
  type BridgeError,
} from "@/features/data-sources/bridge-errors";
import { Field } from "@/features/data-sources/components/section";
import { adapterPath } from "@/features/data-sources/paths";

// CreateMqttBridgeForm creates a bridge that subscribes to a broker
// elsewhere, then opens its Adapter page to watch it connect. The
// password lives in this form only, until it is sent.
export function CreateMqttBridgeForm() {
  const create = useCreateMqttBridge();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [error, setError] = useState<BridgeError | null>(null);
  const errorFor = (field: BridgeError["field"]) => (error?.field === field ? error.message : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const answer = await create.mutateAsync({
        name: name.trim(),
        brokerUrl: brokerUrl.trim(),
        username,
        password,
        topicFilter: topicFilter.trim(),
      });
      setPassword("");
      await navigate(adapterPath(answer.bridge?.adapter?.id ?? ""));
    } catch (e) {
      setError(bridgeError(e));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Name" htmlFor="bridge-name" error={errorFor("name")}>
        <Input
          id="bridge-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="City bus feed"
        />
      </Field>
      <Field
        label="Broker URL"
        htmlFor="bridge-broker-url"
        hint={brokerUrlHint}
        error={errorFor("brokerUrl")}
      >
        <Input
          id="bridge-broker-url"
          required
          value={brokerUrl}
          onChange={(e) => setBrokerUrl(e.target.value)}
          placeholder="mqtts://mqtt.example.com:8883"
          className="font-mono"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username" htmlFor="bridge-username" hint="If the broker needs one.">
          <Input
            id="bridge-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="bridge-password"
          hint="If the broker needs one. It is never shown again."
        >
          <Input
            id="bridge-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <Field
        label="Topic filter"
        htmlFor="bridge-topic-filter"
        hint={topicFilterHint}
        error={errorFor("topicFilter")}
      >
        <Input
          id="bridge-topic-filter"
          required
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          placeholder="hfp/v2/journey/#"
          className="font-mono"
        />
      </Field>
      {error?.field === "form" && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}
      <Button type="submit" disabled={create.isPending}>
        Create bridge
      </Button>
    </form>
  );
}
