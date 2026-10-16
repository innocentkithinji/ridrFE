import { RegistryService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { ControlledKeysList } from "@/features/controlled-keys/components/controlled-keys-list";
import { permissionOf } from "@/lib/me";

export const controlledKeysPath = "/settings/controlled-keys";

export const controlledKeysPermission = permissionOf(RegistryService.method.listControlledKeys);

export function ControlledKeysRoute() {
  return (
    <RequirePermission permission={controlledKeysPermission} what="Controlled keys">
      <ControlledKeysList />
    </RequirePermission>
  );
}
