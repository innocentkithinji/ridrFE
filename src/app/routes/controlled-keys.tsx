import { lazy } from "react";
import { RegistryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const ControlledKeysList = lazy(() => import("@/features/controlled-keys/components/controlled-keys-list").then((m) => ({ default: m.ControlledKeysList })));

export const controlledKeysPath = "/settings/controlled-keys";

export const controlledKeysPermission = permissionOf(RegistryService.method.listControlledKeys);

export function ControlledKeysRoute() {
  return (
    <RequirePermission permission={controlledKeysPermission} what="Controlled keys">
      <ControlledKeysList />
    </RequirePermission>
  );
}
