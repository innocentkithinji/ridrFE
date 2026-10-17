import { lazy } from "react";
import { AdapterService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

export { dataSourcesPath, newDataSourcePath } from "@/features/data-sources/paths";

// Screens load on first visit, keeping them out of the first download.
const AdapterScreen = lazy(() => import("@/features/data-sources/components/adapter-screen").then((m) => ({ default: m.AdapterScreen })));
const DataSourcesScreen = lazy(() => import("@/features/data-sources/components/data-sources-screen").then((m) => ({ default: m.DataSourcesScreen })));
const NewDataSourceScreen = lazy(() => import("@/features/data-sources/components/new-data-source-screen").then((m) => ({ default: m.NewDataSourceScreen })));

// Every role may list Adapters; the same Permission gates the nav link.
export const dataSourcesPermission = permissionOf(AdapterService.method.listAdapters);

export function DataSourcesRoute() {
  return (
    <RequirePermission permission={dataSourcesPermission} what="data sources">
      <DataSourcesScreen />
    </RequirePermission>
  );
}

// Adding a data source is for whole-Organisation admins.
export function NewDataSourceRoute() {
  return (
    <RequirePermission
      permission={permissionOf(AdapterService.method.registerAdapter)}
      what="adding data sources"
    >
      <NewDataSourceScreen />
    </RequirePermission>
  );
}

export function AdapterRoute() {
  const { adapterId = "" } = useParams();
  return (
    <RequirePermission permission={dataSourcesPermission} what="data sources">
      <AdapterScreen key={adapterId} adapterId={adapterId} />
    </RequirePermission>
  );
}
