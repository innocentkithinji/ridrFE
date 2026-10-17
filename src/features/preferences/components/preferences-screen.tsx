import { ConnectError } from "@connectrpc/connect";
import { useState } from "react";
import { ErrorState, Loading } from "@/components/states";
import { unitsByQuantityKind, useUnits, type QuantityKindUnits } from "@/lib/api/catalog";
import { messageFor } from "@/lib/errors";
import { unitLabel } from "@/lib/units";
import {
  useClearUnitPreference,
  useSetUnitPreference,
  useUnitPreferences,
} from "@/lib/use-unit-preferences";

// PreferencesScreen lets the user choose the Unit they see each Quantity
// kind in, or go back to the Unit Readings were reported in. Ridr keeps
// them, so they follow the user to every device.
export function PreferencesScreen() {
  const units = useUnits();
  const preferences = useUnitPreferences();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground">
          The Unit you see each Quantity kind in, wherever the app writes a Query for you.
          Queries you type keep the Units you write.
        </p>
      </header>
      {units.isPending || preferences.isPending ? (
        <Loading what="your Unit preferences" />
      ) : units.isError || preferences.isError ? (
        <ErrorState error={units.error ?? preferences.error} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unitsByQuantityKind(units.data.units)
            .filter((group) => group.units.length > 0)
            .map((group) => (
              <QuantityKindRow
                key={group.quantityKind}
                group={group}
                chosen={
                  preferences.data?.find((preference) => preference.quantityKind === group.quantityKind)
                    ?.unit ?? ""
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}

type QuantityKindRowProps = { group: QuantityKindUnits; chosen: string };

// QuantityKindRow offers one Quantity kind's Units, the chosen one marked.
function QuantityKindRow({ group, chosen }: QuantityKindRowProps) {
  const set = useSetUnitPreference();
  const clear = useClearUnitPreference();
  const { quantityKind } = group;
  const error = set.error ?? clear.error;
  const name = `unit-${quantityKind}`;
  // Show a choice at once, until the stored list changes; a failed save
  // shows the stored choice again.
  const [picked, setPicked] = useState<{ unit: string; over: string } | null>(null);
  if (picked && picked.over !== chosen) setPicked(null);
  const shown = picked && picked.over === chosen ? picked.unit : chosen;

  function choose(unit: string) {
    set.reset();
    clear.reset();
    setPicked({ unit, over: chosen });
    const failed = { onError: () => setPicked(null) };
    if (unit) set.mutate({ quantityKind, unit }, failed);
    else clear.mutate(quantityKind, failed);
  }

  const choices = [
    { value: "", label: "Original Unit" },
    ...group.units.map((unit) => ({ value: unit.code, label: unitLabel(unit.code) })),
  ];
  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 font-medium">{quantityKind}</legend>
      <div className="flex flex-col gap-1 text-sm">
        {choices.map((choice) => (
          <label key={choice.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={shown === choice.value}
              onChange={() => choose(choice.value)}
            />
            {choice.label}
            {choice.value && choice.label !== choice.value && (
              <code className="text-muted-foreground font-mono text-xs">{choice.value}</code>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {messageFor(ConnectError.from(error))}
        </p>
      )}
    </fieldset>
  );
}
