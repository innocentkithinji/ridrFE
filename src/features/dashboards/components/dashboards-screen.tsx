import { DashboardService, type Dashboard } from "@ridr/web";
import { Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FormError } from "@/components/form-error";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateDashboard } from "@/features/dashboards/api/change-dashboard";
import { useDashboards } from "@/features/dashboards/api/get-dashboards";
import type { DashboardLocationState } from "@/features/dashboards/components/dashboard-screen";
import { nameProblem } from "@/features/dashboards/widgets";
import { formatTime } from "@/lib/format";
import { Can, useCan, useMe } from "@/lib/me";

// DashboardsScreen is /dashboards: the user's own Dashboards and every
// shared one, by name, and "Create Dashboard" for editors.
export function DashboardsScreen() {
  const dashboards = useDashboards();
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <Can method={DashboardService.method.createDashboard}>
          <CreateDashboard />
        </Can>
      </div>
      <QueryView
        query={dashboards}
        what="Dashboards"
        isEmpty={(data) => data.dashboards.length === 0}
        empty={<EmptyList />}
      >
        {(data) => <DashboardsTable dashboards={data.dashboards} />}
      </QueryView>
    </section>
  );
}

// EmptyList points editors at "Create Dashboard" above.
function EmptyList() {
  const canCreate = useCan(DashboardService.method.createDashboard);
  return canCreate ? "No Dashboards yet. Create one to gather Widgets in one place." : "No Dashboards yet.";
}

function DashboardsTable({ dashboards }: { dashboards: readonly Dashboard[] }) {
  const me = useMe();
  const sorted = dashboards.toSorted((a, b) => a.name.localeCompare(b.name));
  const cell = "px-3 py-2";
  const head = `${cell} text-muted-foreground font-normal`;
  return (
    <div className="overflow-auto rounded-md border">
      <table aria-label="Dashboards" className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th className={head}>Name</th>
            <th className={head}>Owner</th>
            <th className={head}>Shared</th>
            <th className={head}>Last saved</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((dashboard) => (
            <tr key={dashboard.id} className="border-t">
              <td className={cell}>
                <Link to={`/dashboards/${dashboard.id}`} className="font-medium hover:underline">
                  {dashboard.name}
                </Link>
              </td>
              <td className={cell}>{dashboard.ownerId === me.userId ? "You" : dashboard.ownerId}</td>
              <td className={cell}>{dashboard.shared ? "Shared" : "Private"}</td>
              <td className={`${cell} tabular-nums`}>{formatTime(dashboard.savedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// CreateDashboard names a new Dashboard, creates it empty and opens it in
// edit mode to add Widgets.
function CreateDashboard() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Create Dashboard
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
        </DialogHeader>
        {open && <CreateDashboardForm onCancel={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateDashboardForm({ onCancel }: { onCancel: () => void }) {
  const create = useCreateDashboard();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [checked, setChecked] = useState(false);
  const nameId = useId();
  const problemId = useId();
  const problem = checked ? nameProblem(name) : null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (nameProblem(name)) return;
    const answer = await create.mutateAsync({ name: name.trim(), widgets: [] });
    const state: DashboardLocationState = { editing: true };
    await navigate(`/dashboards/${answer.dashboard?.id ?? ""}`, { state });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event).catch(() => {})}>
      <div className="space-y-1">
        <label htmlFor={nameId} className="text-sm font-medium">
          Name
        </label>
        <Input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={!!problem}
          aria-describedby={problem ? problemId : undefined}
          autoFocus
        />
        {problem && (
          <p id={problemId} role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
        <FormError id={`${problemId}-server`} error={create.error} />
      </div>
      <p className="text-muted-foreground text-sm">It starts private to you; you add widgets next.</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}
