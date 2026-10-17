import { lazy } from "react";
import { AccessService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const TeamScreen = lazy(() => import("@/features/team/components/team-screen").then((m) => ({ default: m.TeamScreen })));

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
