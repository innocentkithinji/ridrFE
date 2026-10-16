import { DashboardService, type Dashboard } from "@ridr/web";
import { History, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FormError } from "@/components/form-error";
import { ErrorState, Loading } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useRestoreDashboardVersion } from "@/features/dashboards/api/change-dashboard";
import { useDashboardVersions } from "@/features/dashboards/api/get-dashboards";
import { formatTime } from "@/lib/format";
import { Can, useCan } from "@/lib/me";

function dashboardUrl(dashboardId: string, version = 0) {
  return version > 0 ? `/dashboards/${dashboardId}?version=${version}` : `/dashboards/${dashboardId}`;
}

// VersionHistory lists every version of a Dashboard, newest first; each
// opens read-only, the newest as the Dashboard itself.
export function VersionHistory({ dashboardId }: { dashboardId: string }) {
  const [open, setOpen] = useState(false);
  const versions = useDashboardVersions(dashboardId, { enabled: open });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <History /> Version history
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Every save is a version. Open one to see it as it was.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          {versions.isPending ? (
            <Loading what="the versions" />
          ) : versions.error ? (
            <ErrorState error={versions.error} />
          ) : (
            <ol className="flex flex-col gap-1">
              {versions.data.versions.map((one, index) => (
                <li key={one.version}>
                  <Link
                    to={dashboardUrl(dashboardId, index === 0 ? 0 : one.version)}
                    onClick={() => setOpen(false)}
                    className="hover:bg-muted flex flex-col rounded-md px-2 py-1.5"
                  >
                    <span className="font-medium">
                      Version {one.version}
                      {index === 0 && " (latest)"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {one.name} · saved {formatTime(one.savedAt)} by {one.savedBy}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// EarlierVersionBanner sits above an earlier version, shown read-only:
// "Version N of M", a way back to the latest, and Restore for editors.
export function EarlierVersionBanner({ dashboard }: { dashboard: Dashboard }) {
  const canList = useCan(DashboardService.method.listDashboardVersions);
  const versions = useDashboardVersions(dashboard.id, { enabled: canList });
  const restore = useRestoreDashboardVersion();
  const navigate = useNavigate();
  const errorId = useId();
  const latest = versions.data?.versions[0]?.version;

  const onRestore = async () => {
    try {
      await restore.mutateAsync({ dashboardId: dashboard.id, version: dashboard.version });
      navigate(dashboardUrl(dashboard.id));
    } catch {
      // FormError shows why.
    }
  };

  return (
    <div role="status" className="bg-muted flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">
          {latest ? `Version ${dashboard.version} of ${latest}` : `Version ${dashboard.version}`}
        </p>
        <p className="text-muted-foreground">An earlier version, read-only.</p>
        <FormError id={errorId} error={restore.error} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to={dashboardUrl(dashboard.id)}>Open the latest</Link>
        </Button>
        {latest !== undefined && dashboard.version < latest && (
          <Can method={DashboardService.method.restoreDashboardVersion}>
            <Button onClick={() => void onRestore()} disabled={restore.isPending}>
              <RotateCcw /> {restore.isPending ? "Restoring…" : "Restore"}
            </Button>
          </Can>
        )}
      </div>
    </div>
  );
}
