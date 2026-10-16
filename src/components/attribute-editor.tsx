import type { ControlledKey } from "@ridr/web";
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  allowedValuesOf,
  attributeProblems,
  newAttributeRow,
  type AttributeRow,
} from "@/lib/attributes";

type AttributeEditorProps = {
  rows: AttributeRow[];
  onChange: (rows: AttributeRow[]) => void;
  // The Organisation's Controlled keys: their values are picked from a
  // list, every other key takes free text.
  controlledKeys: ControlledKey[];
  // Show every problem, as after a save attempt. Before that only a key
  // with characters Ridr refuses is flagged, as it is typed.
  showAllProblems: boolean;
};

const selectClass =
  "border-input bg-background h-8 w-full rounded-lg border px-2 text-sm aria-invalid:border-destructive";

// AttributeEditor edits a set of Attributes as key=value rows. Keys
// suggest the Controlled keys; a Controlled key's value is a picker of
// its allowed values.
export function AttributeEditor(props: AttributeEditorProps) {
  const { rows, onChange, controlledKeys, showAllProblems } = props;
  const listId = useId();
  const problems = attributeProblems(rows, controlledKeys);

  const change = (id: number, patch: Partial<AttributeRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Attributes</legend>
      <datalist id={listId}>
        {controlledKeys.map((controlled) => (
          <option key={controlled.key} value={controlled.key} />
        ))}
      </datalist>
      {rows.length === 0 && <p className="text-muted-foreground text-sm">No Attributes.</p>}
      {rows.map((row, index) => {
        const n = index + 1;
        const allowed = allowedValuesOf(row.key, controlledKeys);
        const keyProblem =
          showAllProblems || (row.key.trim() && problems[index].key !== "Give a key.")
            ? problems[index].key
            : undefined;
        const valueProblem = showAllProblems ? problems[index].value : undefined;
        const keyProblemId = `${listId}-key-${row.id}`;
        const valueProblemId = `${listId}-value-${row.id}`;
        return (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <div>
              <Input
                aria-label={`Key ${n}`}
                list={listId}
                placeholder="key"
                autoComplete="off"
                value={row.key}
                aria-invalid={!!keyProblem}
                aria-describedby={keyProblem ? keyProblemId : undefined}
                onChange={(event) => change(row.id, { key: event.target.value })}
              />
              {keyProblem && (
                <p id={keyProblemId} className="text-destructive mt-1 text-xs">
                  {keyProblem}
                </p>
              )}
            </div>
            <div>
              {allowed ? (
                <select
                  aria-label={`Value ${n}`}
                  className={selectClass}
                  value={allowed.includes(row.value) ? row.value : ""}
                  aria-invalid={!!valueProblem}
                  aria-describedby={valueProblem ? valueProblemId : undefined}
                  onChange={(event) => change(row.id, { value: event.target.value })}
                >
                  <option value="" disabled>
                    Choose a value
                  </option>
                  {allowed.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  aria-label={`Value ${n}`}
                  placeholder="value"
                  value={row.value}
                  aria-invalid={!!valueProblem}
                  aria-describedby={valueProblem ? valueProblemId : undefined}
                  onChange={(event) => change(row.id, { value: event.target.value })}
                />
              )}
              {valueProblem && (
                <p id={valueProblemId} className="text-destructive mt-1 text-xs">
                  {valueProblem}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove Attribute ${n}`}
              onClick={() => onChange(rows.filter((other) => other.id !== row.id))}
            >
              <X aria-hidden />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, newAttributeRow()])}
      >
        <Plus aria-hidden />
        Add Attribute
      </Button>
    </fieldset>
  );
}
