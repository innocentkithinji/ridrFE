import type { MqttBridge } from "@ridr/web";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateMqttBridge } from "@/features/data-sources/api/update-mqtt-bridge";
import {
  bridgeError,
  brokerUrlHint,
  invalidProps,
  topicFilterHint,
  type BridgeError,
} from "@/features/data-sources/bridge-errors";
import { Field } from "@/features/data-sources/components/section";

// What to do with the password Ridr holds but never shows.
type PasswordChange = "keep" | "set" | "remove";

const passwordChoices: { value: PasswordChange; label: string }[] = [
  { value: "keep", label: "Keep the password" },
  { value: "set", label: "Set a new password" },
  { value: "remove", label: "Remove the password" },
];

type EditProps = { bridge: MqttBridge; onDone: () => void };

// EditMqttBridgeForm changes a bridge's broker, username, password and
// topic filter. The password is sent unset to keep it and "" to remove
// it.
export function EditMqttBridgeForm({ bridge, onDone }: EditProps) {
  const update = useUpdateMqttBridge();
  const adapterId = bridge.adapter?.id ?? "";
  const [brokerUrl, setBrokerUrl] = useState(bridge.brokerUrl);
  const [username, setUsername] = useState(bridge.username);
  const [topicFilter, setTopicFilter] = useState(bridge.topicFilter);
  const [passwordChange, setPasswordChange] = useState<PasswordChange>("keep");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<BridgeError | null>(null);
  const errorFor = (field: BridgeError["field"]) => (error?.field === field ? error.message : null);
  const invalid = (field: BridgeError["field"], id: string) => invalidProps(error, field, id);
  const id = (field: string) => `edit-bridge-${field}-${adapterId}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        adapterId,
        brokerUrl: brokerUrl.trim(),
        username,
        topicFilter: topicFilter.trim(),
        password: { keep: undefined, set: password, remove: "" }[passwordChange],
      });
      setPassword("");
      onDone();
    } catch (e) {
      setError(bridgeError(e));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 border-t pt-4">
      <Field
        label="Broker URL"
        htmlFor={id("broker-url")}
        hint={brokerUrlHint}
        error={errorFor("brokerUrl")}
      >
        <Input
          id={id("broker-url")}
          {...invalid("brokerUrl", id("broker-url"))}
          required
          value={brokerUrl}
          onChange={(e) => setBrokerUrl(e.target.value)}
          className="font-mono"
        />
      </Field>
      <Field label="Username" htmlFor={id("username")} hint="Empty when the broker needs none.">
        <Input
          id={id("username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Password{" "}
          <span className="text-muted-foreground font-normal">
            ({bridge.hasPassword ? "one is set" : "none set"})
          </span>
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {passwordChoices.map((choice) => (
            <label key={choice.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id("password-change")}
                value={choice.value}
                checked={passwordChange === choice.value}
                onChange={() => setPasswordChange(choice.value)}
              />
              {choice.label}
            </label>
          ))}
        </div>
        {passwordChange === "set" && (
          <Field label="New password" htmlFor={id("password")} hint="It is never shown again.">
            <Input
              id={id("password")}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}
      </fieldset>
      <Field
        label="Topic filter"
        htmlFor={id("topic-filter")}
        hint={topicFilterHint}
        error={errorFor("topicFilter")}
      >
        <Input
          id={id("topic-filter")}
          {...invalid("topicFilter", id("topic-filter"))}
          required
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="font-mono"
        />
      </Field>
      {error?.field === "form" && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
