import type { AlertState } from "@ridr/web";
import { useState } from "react";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { openStates, useAlerts } from "@/lib/api/alerts";
import { AlertsTable } from "@/features/alerts/components/alerts-table";
import { ScopeNote } from "@/features/alerts/components/scope-note";

// Filter is which Alerts the inbox lists.
type Filter = "open" | "all";

const filters: { id: Filter; label: string; states: AlertState[] }[] = [
  { id: "open", label: "Open", states: openStates },
  { id: "all", label: "All", states: [] }, // no states means every state
];

// AlertsScreen is /alerts: open Alerts newest first, or every Alert,
// refreshed every 15 s.
export function AlertsScreen() {
  const [filter, setFilter] = useState<Filter>("open");
  const chosen = filters.find((f) => f.id === filter) ?? filters[0];
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <ScopeNote />
      <div role="group" aria-label="Alert filter" className="flex gap-1">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={f.id === filter ? "secondary" : "ghost"}
            aria-pressed={f.id === filter}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <FilteredAlerts states={chosen.states} />
    </section>
  );
}

// FilteredAlerts fetches one filter's Alerts; each filter is its own cache
// entry, so switching back shows the last answer at once.
function FilteredAlerts({ states }: { states: AlertState[] }) {
  const alerts = useAlerts({ states });
  return (
    <QueryView
      query={alerts}
      what="Alerts"
      empty="No Alerts. Rules raise them when readings break."
      isEmpty={(answer) => answer.alerts.length === 0}
    >
      {(answer) => <AlertsTable alerts={answer.alerts} label="Alerts" />}
    </QueryView>
  );
}
