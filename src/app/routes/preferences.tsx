import { lazy } from "react";
import { PreferenceService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const PreferencesScreen = lazy(() => import("@/features/preferences/components/preferences-screen").then((m) => ({ default: m.PreferencesScreen })));

export const preferencesPath = "/settings/preferences";

// Every member, scoped or not, keeps their own Unit preferences.
export const preferencesPermission = permissionOf(PreferenceService.method.listUnitPreferences);

export function PreferencesRoute() {
  return (
    <RequirePermission permission={preferencesPermission} what="Preferences">
      <PreferencesScreen />
    </RequirePermission>
  );
}
