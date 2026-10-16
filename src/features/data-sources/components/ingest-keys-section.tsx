import { ConnectError } from "@connectrpc/connect";
import { AdapterService, type IngestKey } from "@ridr/web";
import { useState, type FormEvent } from "react";
import { AgentGuide } from "@/components/agent-guide/agent-guide";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SecretDialog } from "@/components/secret-dialog";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useCreateIngestKey } from "@/features/data-sources/api/create-ingest-key";
import { useIngestKeys } from "@/features/data-sources/api/get-ingest-keys";
import { useRevokeIngestKey } from "@/features/data-sources/api/revoke-ingest-key";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { When } from "@/features/data-sources/components/format";
import { Field, Section } from "@/features/data-sources/components/section";
import { parseDeviceIds } from "@/features/data-sources/devices";
import { webhookUrlFor } from "@/features/data-sources/webhook-urls";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";

// IngestKeysSection lists an Adapter's valid Ingest keys and lets an
// admin issue and revoke them. Without the Permission to list keys it
// isn't shown at all.
export function IngestKeysSection({ adapter, retired }: AdapterSectionProps) {
  const canList = useCan(AdapterService.method.listIngestKeys);
  const canCreate = useCan(AdapterService.method.createIngestKey) && !retired;
  const [issued, setIssued] = useState<string | null>(null);
  const [showingKey, setShowingKey] = useState(false);
  if (!canList) return null;
  // On a Webhook connector, a new key makes a new URL.
  const webhookUrl = issued ? webhookUrlFor(adapter.id, issued) : null;

  return (
    <Section title="Ingest keys">
      <p className="text-muted-foreground text-sm">
        Several keys can be valid at once: to rotate, create a new key, move the Agent to it,
        then revoke the old one.
      </p>
      <KeysList adapterId={adapter.id} retired={retired} />
      {canCreate && (
        <CreateKeyForm
          adapterId={adapter.id}
          onIssued={(plaintext) => {
            setIssued(plaintext);
            setShowingKey(true);
          }}
        />
      )}
      <SecretDialog
        title="Ingest key issued"
        secrets={
          issued && showingKey
            ? [
                { label: "Ingest key", value: issued },
                ...(webhookUrl ? [{ label: "Webhook URL", value: webhookUrl }] : []),
              ]
            : null
        }
        onDone={() => {
          setShowingKey(false);
          if (webhookUrl) setIssued(null);
        }}
      >
        {webhookUrl ? (
          <>The vendor cloud POSTs to {adapter.name} at this new URL, which ends with the key.</>
        ) : (
          <>
            The Agent for {adapter.name} sends with this key as{" "}
            <code>Authorization: Bearer &lt;key&gt;</code>.
          </>
        )}
      </SecretDialog>
      {issued && !showingKey && !webhookUrl && (
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIssued(null)}>
              Hide the Agent guide
            </Button>
          </div>
          <AgentGuide adapterId={adapter.id} ingestKey={issued} />
        </div>
      )}
    </Section>
  );
}

function KeysList({ adapterId, retired }: { adapterId: string; retired: boolean }) {
  const keys = useIngestKeys(adapterId);
  const canRevoke = useCan(AdapterService.method.revokeIngestKey) && !retired;
  const revoke = useRevokeIngestKey();
  return (
    <QueryView
      query={keys}
      what="Ingest keys"
      isEmpty={(data) => valid(data.ingestKeys).length === 0}
      empty="No Ingest keys."
    >
      {(data) => (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Key ID</th>
                <th className="px-3 py-2 font-medium">Devices</th>
                <th className="px-3 py-2 font-medium">Created</th>
                {canRevoke && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {valid(data.ingestKeys).map((key) => (
                <tr key={key.id} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-xs">{key.id}</td>
                  <td className="px-3 py-2">
                    <KeyDevices ingestKey={key} />
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    <When at={key.createdAt} />
                  </td>
                  {canRevoke && (
                    <td className="px-3 py-2 text-right">
                      <ConfirmDialog
                        trigger={
                          <Button variant="destructive" size="sm">
                            Revoke
                          </Button>
                        }
                        title="Revoke this Ingest key?"
                        confirm="Revoke"
                        onConfirm={() => revoke.mutateAsync({ ingestKeyId: key.id })}
                      >
                        Ridr rejects anything sent with it from now on. Agents still using it stop
                        delivering until they move to another key.
                      </ConfirmDialog>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QueryView>
  );
}

// valid keeps the keys not yet revoked: a revoked key is gone for good.
function valid(keys: IngestKey[]): IngestKey[] {
  return keys.filter((k) => k.revokedAt === undefined);
}

function KeyDevices({ ingestKey }: { ingestKey: IngestKey }) {
  if (ingestKey.deviceIds.length === 0) return <>All Devices</>;
  return (
    <div className="space-y-1">
      <p className="font-mono text-xs break-all">{ingestKey.deviceIds.join(", ")}</p>
      <p className="text-muted-foreground text-xs">Can't connect over Hosted MQTT.</p>
    </div>
  );
}

function CreateKeyForm(props: { adapterId: string; onIssued: (plaintext: string) => void }) {
  const create = useCreateIngestKey();
  const [devices, setDevices] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldId = `new-key-devices-${props.adapterId}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const answer = await create.mutateAsync({
        adapterId: props.adapterId,
        deviceIds: parseDeviceIds(devices),
      });
      setDevices("");
      props.onIssued(answer.ingestKey?.plaintext ?? "");
    } catch (e) {
      setError(messageFor(ConnectError.from(e)));
    } finally {
      create.reset();
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 border-t pt-4">
      <Field
        label="Only these Devices (optional)"
        htmlFor={fieldId}
        hint="Device IDs, separated by commas or new lines. Leave empty for every Device. A key narrowed to Devices can't connect over Hosted MQTT."
        error={error}
      >
        <textarea
          id={fieldId}
          value={devices}
          onChange={(e) => setDevices(e.target.value)}
          rows={2}
          className="border-input dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1.5 font-mono text-sm"
        />
      </Field>
      <Button type="submit" size="sm" disabled={create.isPending}>
        Create Ingest key
      </Button>
    </form>
  );
}
