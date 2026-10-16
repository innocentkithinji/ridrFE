import { useQuery } from "@connectrpc/connect-query";
import { CatalogService, type Unit } from "@ridr/web";
import { catalogStaleTime } from "@/features/catalog/api/metrics";

// useUnits lists every Unit Ridr knows, each with its Quantity kind and
// aliases. Unit preference, Explore and Rules reuse it.
export function useUnits(options: { enabled?: boolean } = {}) {
  return useQuery(
    CatalogService.method.listUnits,
    {},
    { staleTime: catalogStaleTime, enabled: options.enabled },
  );
}

// quantityKindsOf names every Quantity kind Ridr knows: the distinct
// kinds of its Units, by name. Offer them wherever a kind is chosen.
export function quantityKindsOf(units: readonly Unit[]): string[] {
  return [...new Set(units.map((unit) => unit.quantityKind))].toSorted();
}

// A Quantity kind and the Units that measure it.
export type QuantityKindUnits = { quantityKind: string; units: Unit[] };

// unitsByQuantityKind groups Units by Quantity kind, kinds by name, Units
// in the order Ridr lists them. Its kinds are every Quantity kind Ridr
// knows.
export function unitsByQuantityKind(units: readonly Unit[]): QuantityKindUnits[] {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) {
    groups.set(unit.quantityKind, [...(groups.get(unit.quantityKind) ?? []), unit]);
  }
  return [...groups]
    .map(([quantityKind, kindUnits]) => ({ quantityKind, units: kindUnits }))
    .toSorted((a, b) => a.quantityKind.localeCompare(b.quantityKind));
}
