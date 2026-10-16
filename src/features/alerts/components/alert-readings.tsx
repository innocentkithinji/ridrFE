import { RegistryService, type Alert } from "@ridr/web";
import { measurementSeries } from "@/components/charts/time-series";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { PermissionDenied, QueryView } from "@/components/states";
import { useAssetName } from "@/features/alerts/api/get-asset-name";
import { useCan } from "@/lib/me";
import { useLiveQuery } from "@/lib/use-live-query";

// AlertReadings charts the last hour of Readings of what an Alert fired
// for, growing as new ones arrive.
export function AlertReadings({ alert }: { alert: Alert }) {
  const canGetAsset = useCan(RegistryService.method.getAsset);
  if (alert.assetId === "") {
    // A Device with no Asset: the Alert's asset holds its Device ID, and
    // the query still matches once the Device is assigned to an Asset.
    return <LiveReadings field="device" value={alert.asset} />;
  }
  if (!canGetAsset) {
    return <PermissionDenied what="this Asset's Readings" />;
  }
  return <AssetReadings assetId={alert.assetId} />;
}

// AssetReadings looks the Asset up first: the Alert holds the name at
// firing time, and a renamed Asset's Readings are under its new one.
function AssetReadings({ assetId }: { assetId: string }) {
  const name = useAssetName(assetId);
  return (
    <QueryView query={name} what="the Asset" empty="The Asset can't be found.">
      {(current) => <LiveReadings field="asset" value={current} />}
    </QueryView>
  );
}

type LiveReadingsProps = {
  // The query field the Readings are picked by.
  field: "asset" | "device";
  // An Asset's name, or a Device ID.
  value: string;
};

function LiveReadings({ field, value }: LiveReadingsProps) {
  const text = `measurements | where ${field} == ${JSON.stringify(value)} | range last 1h`;
  const live = useLiveQuery(text);
  if (live.status === "denied") {
    return <PermissionDenied what="these Readings" />;
  }
  return (
    <QueryView
      query={live.query}
      what="Readings"
      empty="No Readings in the last hour."
      isEmpty={(answer) => measurementSeries(answer.readings).length === 0}
    >
      {(answer) => (
        <div className="space-y-2">
          <p role="status" className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span
              aria-hidden
              className={
                live.status === "live"
                  ? "size-2 rounded-full bg-emerald-600"
                  : "size-2 rounded-full bg-amber-500"
              }
            />
            {live.status === "live" ? "Live" : "Reconnecting"}
          </p>
          <TimeSeriesChart
            series={measurementSeries(answer.readings)}
            label="Live Readings, last hour"
          />
        </div>
      )}
    </QueryView>
  );
}

