import { createClient, type Transport } from "@connectrpc/connect";
import { PreferenceService } from "@ridr/web";
import { hasUnitStage, withUnitStage } from "@/lib/query-text";

// Unit preferences: the Unit a user sees each Quantity kind in, added as
// a `unit` stage to the Queries the app writes for them, never to Query
// text they typed.

// A Unit preference, shaped as Ridr's PreferenceService returns it: a
// Quantity kind and the UCUM code of a Unit of that kind.
export type UnitPreference = { quantityKind: string; unit: string };

// UnitPreferenceStore keeps one user's Unit preferences in one
// Organisation. Screens reach it only through the hooks in
// use-unit-preferences, so where preferences live can change here alone.
export interface UnitPreferenceStore {
  // At most one per Quantity kind; empty when none is chosen.
  list(): Promise<UnitPreference[]>;
  // Replaces any earlier Unit for the kind; the answer gives its code.
  set(quantityKind: string, unit: string): Promise<UnitPreference>;
  // Forgets the kind's Unit; succeeds when there is none.
  clear(quantityKind: string): Promise<void>;
}

// ridrUnitPreferenceStore keeps preferences in Ridr's PreferenceService,
// so they follow the user to every device and client.
export function ridrUnitPreferenceStore(transport: Transport): UnitPreferenceStore {
  const client = createClient(PreferenceService, transport);
  return {
    list: async () =>
      (await client.listUnitPreferences({})).unitPreferences.map(({ quantityKind, unit }) => ({
        quantityKind,
        unit,
      })),
    set: async (quantityKind, unit) => {
      const { unitPreference } = await client.setUnitPreference({ quantityKind, unit });
      return { quantityKind, unit: unitPreference?.unit ?? unit };
    },
    clear: async (quantityKind) => {
      await client.clearUnitPreference({ quantityKind });
    },
  };
}

// withUnitPreference adds a `unit` stage for quantityKind's preferred
// Unit to Query text the app wrote. Text that already names a Unit, a
// kind with no preference, or an unknown kind ("") is left as it is.
// Never pass it text the user typed.
export function withUnitPreference(
  queryText: string,
  quantityKind: string,
  preferences: readonly UnitPreference[],
): string {
  const preferred = preferences.find((preference) => preference.quantityKind === quantityKind);
  if (!quantityKind || !preferred || hasUnitStage(queryText)) return queryText;
  return withUnitStage(queryText, preferred.unit);
}
