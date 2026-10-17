import { useId } from "react";

// What each Role grants, in brief, from the backend's Permissions table
// (docs/frontend/reference/permissions.md). The server decides; this
// only tells an admin what they are choosing.
const summary = [
  {
    term: "Viewer",
    text: "Sees Assets, Devices, Alerts, Rules, Silences, Dashboards, Explore and Data sources, and sets their own Unit preferences, but changes nothing.",
  },
  {
    term: "Editor",
    text: "Everything a Viewer can, and may create and change Assets and Assignments, Rules, Silences, Dashboards and Contact groups, and acknowledge and resolve Alerts.",
  },
  {
    term: "Admin",
    text: "Everything an Editor can, and manages the Team, Data sources (Adapters, Ingest keys, Mappings, MQTT bridges), the Catalog and Controlled keys, and reads the Audit log.",
  },
  {
    term: "With a Scope",
    text: "Sees and changes only Assets whose Attributes match the Scope, and loses what reaches past it: changing Data sources, the Catalog, Controlled keys and Contact groups, and the Audit log.",
  },
];

// RolesSummary tells, on request, what each Role may do.
export function RolesSummary() {
  const id = useId();
  return (
    <details className="text-sm">
      <summary id={id} className="text-muted-foreground cursor-pointer text-xs underline">
        What each Role can do
      </summary>
      <section aria-labelledby={id} className="mt-2 max-w-2xl rounded-lg border p-3">
        <dl className="space-y-2">
          {summary.map(({ term, text }) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </details>
  );
}
