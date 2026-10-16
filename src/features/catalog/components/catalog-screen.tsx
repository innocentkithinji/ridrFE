import { CatalogService, type Metric } from "@ridr/web";
import { QueryView } from "@/components/states";
import { sortMetrics, useMetrics } from "@/features/catalog/api/metrics";
import { quantityKindsOf, useUnits } from "@/features/catalog/api/units";
import { DefineMetricForm } from "@/features/catalog/components/define-metric-form";
import { ReviewMetric } from "@/features/catalog/components/review-metric";
import { UnitsSection } from "@/features/catalog/components/units-section";
import { Can, useCan } from "@/lib/me";

// CatalogScreen shows the Metrics Readings are about and the Units they
// may be reported in. Admins add Metrics; everyone else reads.
export function CatalogScreen() {
  const metrics = useMetrics();
  const canListUnits = useCan(CatalogService.method.listUnits);
  const units = useUnits({ enabled: canListUnits });
  const kinds = quantityKindsOf(units.data?.units ?? []);
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground">
          The Metrics Readings are about, and the Units they may be reported in.
        </p>
      </header>
      <section aria-labelledby="metrics-heading" className="space-y-3">
        <h2 id="metrics-heading" className="text-lg font-semibold">
          Metrics
        </h2>
        <Can method={CatalogService.method.defineMetric}>
          <DefineMetricForm kinds={kinds} />
        </Can>
        <QueryView query={metrics} what="the Metrics">
          {(data) => <MetricsTable metrics={sortMetrics(data.metrics)} kinds={kinds} />}
        </QueryView>
      </section>
      {canListUnits && <UnitsSection units={units} />}
    </div>
  );
}

function MetricsTable({ metrics, kinds }: { metrics: Metric[]; kinds: string[] }) {
  return (
    <table aria-labelledby="metrics-heading" className="w-full text-sm">
      <thead className="text-muted-foreground text-left">
        <tr className="border-b">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Quantity kind</th>
          <th className="py-2 pr-4 font-medium">Source</th>
          <th className="py-2 font-medium">Review</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => (
          <tr key={metric.name} className="border-b last:border-0">
            <th scope="row" className="py-2 pr-4 text-left font-mono font-normal">
              {metric.name}
            </th>
            <td className="py-2 pr-4">{metric.quantityKind || "—"}</td>
            <td className="py-2 pr-4">{metric.builtIn ? "Built in" : "Custom"}</td>
            <td className="py-2">
              {!metric.reviewed && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Needs review
                  </span>
                  <Can method={CatalogService.method.defineMetric}>
                    <ReviewMetric name={metric.name} kinds={kinds} />
                  </Can>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
