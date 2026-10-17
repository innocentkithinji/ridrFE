import { lazy } from "react";
import { RegistryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { PermissionDenied } from "@/components/states";
import { permissionOf, useIsScoped } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const UnclaimedDevicesScreen = lazy(() => import("@/features/assets/components/unclaimed-devices-screen").then((m) => ({ default: m.UnclaimedDevicesScreen })));

export const unclaimedDevicesPath = "/devices/unclaimed";

export const unclaimedDevicesPermission = permissionOf(RegistryService.method.listUnclaimedDevices);

export function UnclaimedDevicesRoute() {
  // No Scope admits a Device with no Asset, so a scoped user's list is
  // always empty; the route is hidden from them, and typing its URL is
  // refused as any route their access doesn't reach.
  const scoped = useIsScoped();
  return (
    <RequirePermission permission={unclaimedDevicesPermission} what="Unclaimed devices">
      {scoped ? (
        <PermissionDenied what="Unclaimed devices" by="Scope" />
      ) : (
        <UnclaimedDevicesScreen />
      )}
    </RequirePermission>
  );
}
