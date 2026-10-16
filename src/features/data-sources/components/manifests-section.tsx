import { AdapterService, type Manifest } from "@ridr/web";
import { QueryView } from "@/components/states";
import { useManifests } from "@/features/data-sources/api/get-manifests";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { When } from "@/features/data-sources/components/format";
import { Section } from "@/features/data-sources/components/section";
import { useCan } from "@/lib/me";

// ManifestsSection lists the Manifest versions the Adapter's Agent has
// published, oldest first, each with its Metrics and Units.
export function ManifestsSection({ adapter }: AdapterSectionProps) {
  const canList = useCan(AdapterService.method.listManifests);
  if (!canList) return null;
  return (
    <Section title="Manifests">
      <ManifestsList adapterId={adapter.id} />
    </Section>
  );
}

function ManifestsList({ adapterId }: { adapterId: string }) {
  const manifests = useManifests(adapterId);
  return (
    <QueryView
      query={manifests}
      what="Manifests"
      isEmpty={(data) => data.manifests.length === 0}
      empty="No Manifest published yet. An Agent publishes one before its first batch."
    >
      {(data) => (
        <ol className="space-y-3">
          {oldestFirst(data.manifests).map((manifest) => (
            <li key={manifest.version} aria-label={`Version ${manifest.version}`} className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Version {manifest.version}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · published <When at={manifest.publishedAt} />
                </span>
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                    <tr>
                      <th className="px-3 py-2 font-medium">Metric</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.entries.map((entry) => (
                      <tr key={entry.metric} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{entry.metric}</td>
                        <td className="px-3 py-2">{entry.unit || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ol>
      )}
    </QueryView>
  );
}

function oldestFirst(manifests: Manifest[]): Manifest[] {
  return manifests.toSorted((a, b) => a.version - b.version);
}
