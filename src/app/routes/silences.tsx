import { lazy } from "react";
import { SilenceService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const SilencesScreen = lazy(() => import("@/features/silences/components/silences-screen").then((m) => ({ default: m.SilencesScreen })));

export const silencesPath = "/silences";

export const silencesPermission = permissionOf(SilenceService.method.listSilences);

export function SilencesRoute() {
  return (
    <RequirePermission permission={silencesPermission} what="Silences">
      <SilencesScreen />
    </RequirePermission>
  );
}
