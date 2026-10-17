import { Code, ConnectError } from "@connectrpc/connect";
import { fieldErrorId } from "@/features/data-sources/components/section";
import { messageFor } from "@/lib/errors";

// A field of the MQTT bridge form.
export type BridgeField = "name" | "brokerUrl" | "topicFilter" | "form";

export type BridgeError = { field: BridgeField; message: string };

// bridgeError places a refusal beside the field it is about. Ridr refuses
// with InvalidArgument and a message naming what's wrong: the Adapter's
// name, the topic filter, or else the broker URL (scheme, path, host and
// port, credentials, address, certificate). Anything else goes under the
// form.
export function bridgeError(error: unknown): BridgeError {
  const refusal = ConnectError.from(error);
  const message = messageFor(refusal);
  if (refusal.code !== Code.InvalidArgument) return { field: "form", message };
  if (refusal.rawMessage.startsWith("invalid adapter:")) return { field: "name", message };
  if (/topic filter/i.test(refusal.rawMessage)) return { field: "topicFilter", message };
  return { field: "brokerUrl", message };
}

export const brokerUrlHint =
  "mqtt:// or tcp:// (plain), mqtts://, ssl:// or tls:// (encrypted), ws:// or wss:// (websockets), with a host and a port, as in mqtts://mqtt.example.com:8883. Only ws and wss have a path, such as /mqtt. No credentials in the URL. Encrypted brokers need a certificate from a public authority, and private addresses are refused unless this Ridr allows them.";

export const topicFilterHint = "One MQTT 3.1.1 topic filter, as in hfp/v2/journey/#.";

// invalidProps marks a control invalid and described by its error while
// the error is about its field.
export function invalidProps(error: BridgeError | null, field: BridgeField, id: string) {
  return error?.field === field
    ? { "aria-invalid": true, "aria-describedby": fieldErrorId(id) }
    : {};
}
