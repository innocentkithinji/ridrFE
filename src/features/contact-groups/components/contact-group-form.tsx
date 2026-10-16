import { Code, ConnectError } from "@connectrpc/connect";
import { Channel, type Contact, type ContactGroup } from "@ridr/web";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addressPlaceholder,
  addressProblem,
} from "@/features/contact-groups/components/address";
import { channelLabel, channels } from "@/features/contact-groups/components/channels";
import { messageFor } from "@/lib/errors";

// One Contact as the form holds it; key keeps rows stable as they change.
type ContactRow = { key: number; channel: Channel; address: string };

// What the form sends: the request fields shared by create and update.
export type ContactGroupDraft = {
  name: string;
  contacts: { channel: Channel; address: string }[];
};

type ContactGroupFormProps = {
  // The group being edited; none for a new one.
  group?: ContactGroup;
  // Sends the draft and returns the saved group, whose webhook Contacts
  // may carry newly issued signing secrets.
  save: (draft: ContactGroupDraft) => Promise<ContactGroup | undefined>;
  onSaved: (saved: ContactGroup | undefined) => void;
  onCancel: () => void;
};

// ContactGroupForm edits a Contact group's name and Contacts, checking
// each address for its Channel before sending.
export function ContactGroupForm({ group, save, onSaved, onCancel }: ContactGroupFormProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [rows, setRows] = useState<ContactRow[]>(() => (group?.contacts ?? []).map(toRow));
  const [problems, setProblems] = useState<Record<number, string>>({});
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const id = useId();

  function change(key: number, patch: Partial<ContactRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setProblems((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<number, string> = {};
    for (const row of rows) {
      const problem = addressProblem(row.channel, row.address);
      if (problem) {
        found[row.key] = problem;
      }
    }
    const missingName = name.trim() === "" ? "Enter a name." : undefined;
    setProblems(found);
    setNameError(missingName);
    setFormError(undefined);
    if (missingName || Object.keys(found).length > 0) {
      return;
    }
    setSaving(true);
    try {
      const saved = await save({
        name: name.trim(),
        contacts: rows.map((row) => ({ channel: row.channel, address: row.address.trim() })),
      });
      onSaved(saved);
    } catch (error) {
      const refusal = ConnectError.from(error);
      if (refusal.code === Code.AlreadyExists) {
        setNameError(messageFor(refusal));
      } else {
        setFormError(messageFor(refusal));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id={`${id}-name`} label="Name" error={nameError}>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(undefined);
          }}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          maxLength={200}
          autoFocus
        />
      </Field>

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No Contacts yet. Rules notifying this group will reach nobody.
          </p>
        )}
        {rows.map((row, index) => {
          const rowId = `${id}-contact-${row.key}`;
          const problem = problems[row.key];
          return (
            <fieldset key={row.key} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">Contact {index + 1}</legend>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove Contact ${index + 1}`}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                <Field id={`${rowId}-channel`} label="Channel">
                  <select
                    id={`${rowId}-channel`}
                    value={row.channel}
                    onChange={(event) => change(row.key, { channel: Number(event.target.value) })}
                    className="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
                  >
                    {channels.map((channel) => (
                      <option key={channel} value={channel}>
                        {channelLabel(channel)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={`${rowId}-address`} label="Address" error={problem}>
                  <Input
                    id={`${rowId}-address`}
                    value={row.address}
                    placeholder={addressPlaceholder(row.channel)}
                    onChange={(event) => change(row.key, { address: event.target.value })}
                    aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? `${rowId}-address-error` : undefined}
                  />
                </Field>
              </div>
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((current) => [...current, newRow(current)])}
        >
          <Plus /> Add Contact
        </Button>
      </div>

      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = { id: string; label: string; error?: string; children: ReactNode };

// Field labels a control and shows its error beside it.
function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

let nextKey = 0;

function toRow(contact: Contact): ContactRow {
  return { key: nextKey++, channel: contact.channel, address: contact.address };
}

function newRow(current: ContactRow[]): ContactRow {
  // A new row starts on the Channel of the one above, as lists often
  // hold several addresses of one kind.
  const channel = current.at(-1)?.channel ?? Channel.EMAIL;
  return { key: nextKey++, channel, address: "" };
}
