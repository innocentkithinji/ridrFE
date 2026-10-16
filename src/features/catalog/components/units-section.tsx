import { QueryView } from "@/components/states";
import {
  unitsByQuantityKind,
  type QuantityKindUnits,
  type useUnits,
} from "@/features/catalog/api/units";

// UnitsSection lists the Units Ridr knows, grouped by Quantity kind.
export function UnitsSection({ units }: { units: ReturnType<typeof useUnits> }) {
  return (
    <section aria-labelledby="units-heading" className="space-y-3">
      <h2 id="units-heading" className="text-lg font-semibold">
        Units
      </h2>
      <p className="text-muted-foreground text-sm">
        Each Unit's UCUM code, then the aliases Queries and Rules also accept.
      </p>
      <QueryView query={units} what="the Units">
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unitsByQuantityKind(data.units).map((group) => (
              <QuantityKindCard key={group.quantityKind} group={group} />
            ))}
          </div>
        )}
      </QueryView>
    </section>
  );
}

function QuantityKindCard({ group }: { group: QuantityKindUnits }) {
  const headingId = `kind-${group.quantityKind}`;
  return (
    <section aria-labelledby={headingId} className="rounded-lg border p-3">
      <h3 id={headingId} className="mb-2 font-medium">
        {group.quantityKind}
      </h3>
      <ul className="space-y-1 text-sm">
        {group.units.map((unit) => (
          <li key={unit.code} className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono">{unit.code}</code>
            {unit.aliases.length > 0 && (
              <span className="text-muted-foreground">{unit.aliases.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
