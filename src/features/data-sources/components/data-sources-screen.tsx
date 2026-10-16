import { timestampMs } from "@bufbuild/protobuf/wkt";
import { AdapterService, type Adapter } from "@ridr/web";
import { BookOpen, Plus } from "lucide-react";
import { Link } from "react-router";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAdapters } from "@/features/data-sources/api/get-adapters";
import { RetiredBadge, When } from "@/features/data-sources/components/format";
import { adapterPath, agentGuidePath, newDataSourcePath } from "@/features/data-sources/paths";
import { Can } from "@/lib/me";

// DataSourcesScreen lists every Adapter, oldest first, retired ones
// marked.
export function DataSourcesScreen() {
  const adapters = useAdapters();
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Data sources</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={agentGuidePath}>
              <BookOpen aria-hidden /> Agent guide
            </Link>
          </Button>
          <AddDataSource />
        </div>
      </div>
      <QueryView
        query={adapters}
        what="data sources"
        isEmpty={(data) => data.adapters.length === 0}
        empty={
          <span className="flex flex-col items-center gap-3">
            No data sources yet.
            <AddDataSource />
          </span>
        }
      >
        {(data) => <AdaptersTable adapters={oldestFirst(data.adapters)} />}
      </QueryView>
    </section>
  );
}

function AddDataSource() {
  return (
    <Can method={AdapterService.method.registerAdapter}>
      <Button size="sm" asChild>
        <Link to={newDataSourcePath}>
          <Plus aria-hidden /> Add a data source
        </Link>
      </Button>
    </Can>
  );
}

function registeredAt(adapter: Adapter): number {
  return adapter.createdAt ? timestampMs(adapter.createdAt) : 0;
}

function oldestFirst(adapters: Adapter[]): Adapter[] {
  return adapters.toSorted((a, b) => registeredAt(a) - registeredAt(b));
}

function AdaptersTable({ adapters }: { adapters: Adapter[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Registered</th>
            <th className="px-3 py-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {adapters.map((adapter) => (
            <tr key={adapter.id} className="border-t">
              <td className="px-3 py-2">
                <Link to={adapterPath(adapter.id)} className="font-medium hover:underline">
                  {adapter.name}
                </Link>
              </td>
              <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                <When at={adapter.createdAt} />
              </td>
              <td className="px-3 py-2">{adapter.retiredAt && <RetiredBadge />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
