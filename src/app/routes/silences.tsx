import { SilenceService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { SilencesScreen } from "@/features/silences/components/silences-screen";
import { permissionOf } from "@/lib/me";

export const silencesPath = "/silences";

export const silencesPermission = permissionOf(SilenceService.method.listSilences);

export function SilencesRoute() {
  return (
    <RequirePermission permission={silencesPermission} what="Silences">
      <SilencesScreen />
    </RequirePermission>
  );
}
