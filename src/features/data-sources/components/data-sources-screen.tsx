import { timestampMs } from "@bufbuild/protobuf/wkt";
import { AdapterService, type Adapter, type MqttBridge } from "@ridr/web";
import { BookOpen, Plus } from "lucide-react";
import { Link } from "react-router";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { DataCredit } from "@/components/data-credit";
import { useAdapters } from "@/features/data-sources/api/get-adapters";
import { useMqttBridges } from "@/features/data-sources/api/get-mqtt-bridges";
import { BridgeStateBadge } from "@/features/data-sources/components/bridge-status";
import { RetiredBadge, When } from "@/features/data-sources/components/format";
import { adapterPath, agentGuidePath, newDataSourcePath } from "@/features/data-sources/paths";
import { Can } from "@/lib/me";

// DataSourcesScreen lists every Adapter, oldest first, retired ones
// marked.
export function DataSourcesScreen() {
  const adapters = useAdapters();
  const bridges = useMqttBridges().data?.bridges ?? [];
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
        {(data) => <AdaptersTable adapters={oldestFirst(data.adapters)} bridges={bridges} />}
      </QueryView>
      <DataCredit bridges={bridges} />
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

// The kind of an Adapter is knowable only for MQTT bridges, by their ID
// in ListMqttBridges; Connectors and Agents' Adapters look the same.
function AdaptersTable({ adapters, bridges }: { adapters: Adapter[]; bridges: MqttBridge[] }) {
  const bridgeOf = new Map(bridges.map((b) => [b.adapter?.id, b]));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Registered</th>
            <th className="px-3 py-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {adapters.map((adapter) => {
            const bridge = bridgeOf.get(adapter.id);
            return (
            <tr key={adapter.id} className="border-t">
              <td className="px-3 py-2">
                <Link to={adapterPath(adapter.id)} className="font-medium hover:underline">
                  {adapter.name}
                </Link>
              </td>
              <td className="px-3 py-2">{bridge && "MQTT bridge"}</td>
              <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                <When at={adapter.createdAt} />
              </td>
              <td className="px-3 py-2">
                {adapter.retiredAt ? (
                  <RetiredBadge />
                ) : (
                  bridge && <BridgeStateBadge status={bridge.status} />
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
