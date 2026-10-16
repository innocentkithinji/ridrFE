import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useControlledKeys } from "@/features/controlled-keys/api/get-controlled-keys";

// A Scope as the editor holds it: each condition a Controlled key and
// the values an Asset may hold for it. None means the whole Organisation.
export type ScopeConditions = { key: string; values: string[] }[];

// toConditions copies a Scope's conditions into the editor's shape.
export function toConditions(scope: { conditions: ScopeConditions } | undefined): ScopeConditions {
  return (scope?.conditions ?? []).map((c) => ({ key: c.key, values: [...c.values] }));
}

type ScopeEditorProps = {
  value: ScopeConditions;
  onChange: (value: ScopeConditions) => void;
};

// ScopeEditor builds a Scope from the Controlled keys: pick a key, then
// tick the values it admits.
export function ScopeEditor({ value, onChange }: ScopeEditorProps) {
  const id = useId();
  const keys = useControlledKeys();
  const [picked, setPicked] = useState("");
  const allowed = new Map(
    (keys.data?.controlledKeys ?? []).map((key) => [key.key, key.allowedValues]),
  );
  const unused = [...allowed.keys()].filter((key) => !value.some((c) => c.key === key));

  function toggle(key: string, item: string, on: boolean) {
    onChange(
      value.map((c) =>
        c.key !== key
          ? c
          : { key, values: on ? [...c.values, item] : c.values.filter((v) => v !== item) },
      ),
    );
  }

  return (
    <fieldset aria-labelledby={`${id}-legend`} className="space-y-2 text-sm">
      <legend id={`${id}-legend`}>Scope</legend>
      {value.length === 0 && (
        <p className="text-muted-foreground">Whole Organisation: every Asset.</p>
      )}
      {value.map((condition) => (
        <fieldset
          key={condition.key}
          aria-label={condition.key}
          className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2"
        >
          <span className="font-mono">{condition.key}</span>
          {(allowed.get(condition.key) ?? condition.values).map((item) => (
            <label key={item} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={condition.values.includes(item)}
                onChange={(event) => toggle(condition.key, item, event.target.checked)}
              />
              {item}
            </label>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`Remove ${condition.key} from the Scope`}
            onClick={() => onChange(value.filter((c) => c.key !== condition.key))}
          >
            Remove
          </Button>
        </fieldset>
      ))}
      {unused.length > 0 && (
        <div className="flex items-end gap-2">
          <label className="space-y-1">
            <span className="block">Controlled key</span>
            <select
              value={picked}
              onChange={(event) => setPicked(event.target.value)}
              className="border-input bg-background h-8 rounded-lg border px-2"
            >
              <option value="">Pick a key…</option>
              {unused.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!picked}
            onClick={() => {
              onChange([...value, { key: picked, values: [] }]);
              setPicked("");
            }}
          >
            Add condition
          </Button>
        </div>
      )}
    </fieldset>
  );
}
