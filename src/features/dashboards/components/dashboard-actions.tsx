import { DashboardService, type Dashboard } from "@ridr/web";
import { Lock, Share2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteDashboard, useShareDashboard } from "@/features/dashboards/api/change-dashboard";
import { Can, useCan, useMe } from "@/lib/me";

// ShareButton shares a Dashboard with the Organisation or makes it
// private again. Only its owner sees it.
export function ShareButton({ dashboard, share }: { dashboard: Dashboard; share: ReturnType<typeof useShareDashboard> }) {
  const me = useMe();
  const may = useCan(DashboardService.method.shareDashboard);
  if (!may || dashboard.ownerId !== me.userId) return null;
  return (
    <Button
      variant="outline"
      disabled={share.isPending}
      onClick={() => share.mutate({ dashboardId: dashboard.id, shared: !dashboard.shared })}
    >
      {dashboard.shared ? (
        <>
          <Lock /> Make private
        </>
      ) : (
        <>
          <Share2 /> Share
        </>
      )}
    </Button>
  );
}

// DeleteDashboard deletes a Dashboard and every version after asking,
// then goes back to the list.
export function DeleteDashboard({ dashboard }: { dashboard: Dashboard }) {
  const remove = useDeleteDashboard();
  const navigate = useNavigate();
  return (
    <Can method={DashboardService.method.deleteDashboard}>
      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <Trash2 /> Delete
          </Button>
        }
        title="Delete this Dashboard?"
        confirm="Delete"
        onConfirm={async () => {
          await remove.mutateAsync({ dashboardId: dashboard.id });
          navigate("/dashboards");
        }}
      >
        “{dashboard.name}” and every one of its versions go for everyone who can see it. This can't be undone.
      </ConfirmDialog>
    </Can>
  );
}
