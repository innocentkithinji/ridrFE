import type { Adapter } from "@ridr/web";
import type { ComponentType } from "react";
import { Link } from "react-router";
import { ErrorState, Loading, NotFound } from "@/components/states";
import { useAdapter } from "@/lib/api/adapters";
import { RetiredBadge } from "@/features/data-sources/components/format";
import { CorrectionsSection } from "@/features/data-sources/components/corrections-section";
import { IngestKeysSection } from "@/features/data-sources/components/ingest-keys-section";
import { ManifestsSection } from "@/features/data-sources/components/manifests-section";
import { MappingSection } from "@/features/data-sources/components/mapping-section";
import { MqttBridgeSection } from "@/features/data-sources/components/mqtt-bridge-section";
import { RawPayloadsSection } from "@/features/data-sources/components/raw-payloads-section";
import { ReprocessingSection } from "@/features/data-sources/components/reprocessing-section";
import { RetireSection } from "@/features/data-sources/components/retire-section";
import { dataSourcesPath } from "@/features/data-sources/paths";

// One section of the Adapter page. Each hides itself without its
// Permission and goes read-only once the Adapter is retired.
export type AdapterSectionProps = { adapter: Adapter; retired: boolean };

// The Adapter page's sections, in order. Bridge settings, the Mapping
// editor, Raw payloads, Reprocessing and Corrections go in here, before
// retiring.
const sections: ComponentType<AdapterSectionProps>[] = [
  MqttBridgeSection,
  IngestKeysSection,
  ManifestsSection,
  MappingSection,
  RawPayloadsSection,
  ReprocessingSection,
  CorrectionsSection,
  RetireSection,
];

// AdapterScreen shows one Adapter: its Ingest keys, Manifests and the
// way to retire it.
export function AdapterScreen({ adapterId }: { adapterId: string }) {
  const adapter = useAdapter(adapterId);
  if (adapter.isPending) return <Loading what="the data source" />;
  // A failed refetch keeps the page, and the Mapping editor on it.
  if (adapter.error && !adapter.data) return <ErrorState error={adapter.error} />;
  if (!adapter.data) {
    return (
      <NotFound what="Data source">
        <Link to={dataSourcesPath} className="underline">
          All data sources
        </Link>
      </NotFound>
    );
  }
  const found = adapter.data;
  const retired = found.retiredAt !== undefined;
  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <Link to={dataSourcesPath} className="text-muted-foreground text-sm hover:underline">
          ← Data sources
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{found.name}</h1>
          {retired && <RetiredBadge />}
        </div>
        <p className="text-muted-foreground text-sm">
          Adapter ID <code className="font-mono">{found.id}</code>
        </p>
      </header>
      {sections.map((AdapterSection, i) => (
        <AdapterSection key={i} adapter={found} retired={retired} />
      ))}
    </div>
  );
}
