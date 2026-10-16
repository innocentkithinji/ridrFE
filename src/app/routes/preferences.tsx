import { CatalogService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { PreferencesScreen } from "@/features/preferences/components/preferences-screen";
import { permissionOf } from "@/lib/me";

export const preferencesPath = "/settings/preferences";

// Every member may list the Units; the preferences themselves are kept in
// this browser until Ridr serves PreferenceService (ridr#53).
export const preferencesPermission = permissionOf(CatalogService.method.listUnits);

export function PreferencesRoute() {
  return (
    <RequirePermission permission={preferencesPermission} what="Preferences">
      <PreferencesScreen />
    </RequirePermission>
  );
}
