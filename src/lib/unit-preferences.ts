import { hasUnitStage, withUnitStage } from "@/lib/query-text";

// Unit preferences: the Unit a user sees each Quantity kind in, added as
// a `unit` stage to the Queries the app writes for them, never to Query
// text they typed.

// A Unit preference, shaped as Ridr's PreferenceService returns it: a
// Quantity kind and the UCUM code of a Unit of that kind.
export type UnitPreference = { quantityKind: string; unit: string };

// UnitPreferenceStore keeps one user's Unit preferences in one
// Organisation. It is async, like the PreferenceService calls (ridr#53)
// that will replace the browser store, so swapping it changes no caller.
export interface UnitPreferenceStore {
  // At most one per Quantity kind; empty when none is chosen.
  list(): Promise<UnitPreference[]>;
  // Replaces any earlier Unit for the kind.
  set(quantityKind: string, unit: string): Promise<UnitPreference>;
  // Forgets the kind's Unit; succeeds when there is none.
  clear(quantityKind: string): Promise<void>;
}

// browserUnitPreferenceStore keeps preferences in browser storage, one
// entry per user and Organisation. A read that fails, or finds something
// unreadable, gives no preferences, so values show in Ridr's Units; a
// write that fails rejects, so the screen can say so.
export function browserUnitPreferenceStore(
  owner: { tenantId: string; userId: string },
  storage: () => Storage = () => localStorage,
): UnitPreferenceStore {
  const key = `ridr.unitPreferences.${owner.tenantId}.${owner.userId}`;

  function read(): UnitPreference[] {
    try {
      const parsed: unknown = JSON.parse(storage().getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isPreference) : [];
    } catch {
      return [];
    }
  }

  function write(preferences: UnitPreference[]) {
    try {
      storage().setItem(key, JSON.stringify(preferences));
    } catch (cause) {
      throw new Error("This browser wouldn't save your Unit preference.", { cause });
    }
  }

  return {
    list: async () => read(),
    set: async (quantityKind, unit) => {
      const preference = { quantityKind, unit };
      write([...read().filter((kept) => kept.quantityKind !== quantityKind), preference]);
      return preference;
    },
    clear: async (quantityKind) => {
      write(read().filter((kept) => kept.quantityKind !== quantityKind));
    },
  };
}

function isPreference(value: unknown): value is UnitPreference {
  if (typeof value !== "object" || value === null) return false;
  const { quantityKind, unit } = value as Record<string, unknown>;
  return typeof quantityKind === "string" && typeof unit === "string" && unit !== "";
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
