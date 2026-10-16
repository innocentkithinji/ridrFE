import { AccessService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { TeamScreen } from "@/features/team/components/team-screen";
import { permissionOf } from "@/lib/me";

export const teamPath = "/settings/team";

// Admins only; the same Permission gates the nav link.
export const teamPermission = permissionOf(AccessService.method.listMembers);

export function TeamRoute() {
  return (
    <RequirePermission permission={teamPermission} what="the Team">
      <TeamScreen />
    </RequirePermission>
  );
}
