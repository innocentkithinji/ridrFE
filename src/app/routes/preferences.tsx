import { PreferenceService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { PreferencesScreen } from "@/features/preferences/components/preferences-screen";
import { permissionOf } from "@/lib/me";

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
