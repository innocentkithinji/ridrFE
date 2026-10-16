import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { AuditEntry, Member } from "@ridr/web";
import { RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuditEntries } from "@/features/audit-log/api/use-audit-entries";
import { useMembers } from "@/features/team/api/get-team";
import {
  filtersFrom,
  formatTime,
  fromLocalInput,
  isFiltered,
  knownActions,
  localInput,
  pageSize,
  paramsFrom,
  type AuditFilters,
} from "@/features/audit-log/filters";

// AuditLogScreen lists who changed what, and when, newest first, with
// its filters in the URL.
export function AuditLogScreen() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFrom(params);
  const entries = useAuditEntries(filters);
  const members = useMembers().data?.members ?? [];
  const show = (next: AuditFilters) => setParams(paramsFrom(next));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <Button variant="outline" size="sm" onClick={() => void entries.refetch()}>
          <RefreshCw aria-hidden /> Refresh
        </Button>
      </div>
      <FiltersForm key={params.toString()} filters={filters} members={members} onApply={show} />
      <QueryView
        query={entries}
        what="the Audit log"
        isEmpty={(data) => data.entries.length === 0}
        empty={isFiltered(filters) ? "No changes match these filters." : "No changes recorded."}
      >
        {(data) => (
          <>
            <EntriesTable entries={data.entries} members={members} />
            <div className="flex justify-end gap-2">
              {filters.to && (
                <Button variant="outline" size="sm" onClick={() => show({ ...filters, to: "" })}>
                  Newest
                </Button>
              )}
              {data.entries.length >= pageSize(filters) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const oldest = data.entries[data.entries.length - 1].recordedAt;
                    if (oldest) {
                      show({ ...filters, to: formatTime(oldest) });
                    }
                  }}
                >
                  Older
                </Button>
              )}
            </div>
          </>
        )}
      </QueryView>
    </section>
  );
}

type FiltersFormProps = {
  filters: AuditFilters;
  members: Member[];
  onApply: (filters: AuditFilters) => void;
};

function FiltersForm({ filters, members, onApply }: FiltersFormProps) {
  const [draft, setDraft] = useState({
    ...filters,
    from: localInput(filters.from),
    to: localInput(filters.to),
  });
  const set = (key: keyof AuditFilters) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply({
      ...draft,
      action: draft.action.trim(),
      target: draft.target.trim(),
      from: fromLocalInput(draft.from, filters.from),
      to: fromLocalInput(draft.to, filters.to),
    });
  };

  const actorKnown = members.some((m) => m.userId === draft.actor);
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <Field label="Who" htmlFor="audit-actor">
        {members.length > 0 ? (
          <select
            id="audit-actor"
            value={draft.actor}
            onChange={(e) => set("actor")(e.target.value)}
            className="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email}
              </option>
            ))}
            {draft.actor && !actorKnown && <option value={draft.actor}>{draft.actor}</option>}
          </select>
        ) : (
          <Input
            id="audit-actor"
            placeholder="User ID"
            value={draft.actor}
            onChange={(e) => set("actor")(e.target.value)}
          />
        )}
      </Field>
      <Field label="Action" htmlFor="audit-action">
        <Input
          id="audit-action"
          list="audit-actions"
          placeholder="Any"
          value={draft.action}
          onChange={(e) => set("action")(e.target.value)}
        />
        <datalist id="audit-actions">
          {knownActions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Field label="Target" htmlFor="audit-target">
        <Input
          id="audit-target"
          placeholder="Any"
          value={draft.target}
          onChange={(e) => set("target")(e.target.value)}
        />
      </Field>
      <Field label="From" htmlFor="audit-from">
        <Input
          id="audit-from"
          type="datetime-local"
          value={draft.from}
          onChange={(e) => set("from")(e.target.value)}
        />
      </Field>
      <Field label="To" htmlFor="audit-to">
        <Input
          id="audit-to"
          type="datetime-local"
          value={draft.to}
          onChange={(e) => set("to")(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply
        </Button>
        {isFiltered(filters) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onApply(filtersFrom(new URLSearchParams()))}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}

function Field(props: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.htmlFor} className="text-muted-foreground text-xs font-medium">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function EntriesTable({ entries, members }: { entries: AuditEntry[]; members: Member[] }) {
  const emails = new Map(members.map((m) => [m.userId, m.email]));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Who</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                {entry.recordedAt && timestampDate(entry.recordedAt).toLocaleString()}
              </td>
              {/* A removed member shows as the raw ID. */}
              <td className="px-3 py-2">{emails.get(entry.actorId) ?? entry.actorId}</td>
              <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
              <td className="px-3 py-2 break-all">{entry.targetId}</td>
              <td className="text-muted-foreground px-3 py-2">
                {Object.entries(entry.details)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
