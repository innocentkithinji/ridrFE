import { AdapterService } from "@ridr/web";
import { useParams } from "react-router";
import { RequirePermission } from "@/components/require-permission";
import { AdapterScreen } from "@/features/data-sources/components/adapter-screen";
import { DataSourcesScreen } from "@/features/data-sources/components/data-sources-screen";
import { NewDataSourceScreen } from "@/features/data-sources/components/new-data-source-screen";
import { permissionOf } from "@/lib/me";

export { dataSourcesPath, newDataSourcePath } from "@/features/data-sources/paths";

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
