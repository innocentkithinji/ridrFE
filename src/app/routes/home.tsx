import { AdapterService } from "@ridr/web";
import { OpenAlertsPanel } from "@/features/alerts/components/open-alerts-panel";
import { dataSourcesPath } from "@/features/data-sources/paths";
import { HomeScreen } from "@/features/home/components/home-screen";
import { useCan } from "@/lib/me";

// HomeRoute is `/`. Every panel gates itself on its own Permission, so
// the route needs none.
export function HomeRoute() {
  const canSetUp = useCan(AdapterService.method.registerAdapter);
  return (
    <HomeScreen
      alerts={<OpenAlertsPanel />}
      setUpPath={canSetUp ? dataSourcesPath : undefined}
    />
  );
}
