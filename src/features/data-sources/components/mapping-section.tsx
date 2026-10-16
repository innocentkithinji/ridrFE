import { ConnectorService } from "@ridr/web";
import { useState } from "react";
import { ErrorState, Loading } from "@/components/states";
import { isNoMapping, useMapping } from "@/features/data-sources/api/get-mapping";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { MappingEditor } from "@/features/data-sources/components/mapping-editor";
import { MappingSummary } from "@/features/data-sources/components/mapping-summary";
import { Section } from "@/features/data-sources/components/section";
import { useCan } from "@/lib/me";

// Where the Reprocessing section of the Adapter page starts, to offer it
// once a new Mapping version is saved.
export const reprocessingAnchor = "reprocessing";

// MappingSection shows how a Connector turns its payloads into Readings
// and lets admins write, preview and save a new version. A summary
// without SetMapping and PreviewMapping; hidden on retired Adapters.
export function MappingSection({ adapter, retired }: AdapterSectionProps) {
  const canGet = useCan(ConnectorService.method.getMapping);
  if (!canGet || retired) return null;
  return <Mapping adapterId={adapter.id} />;
}

function Mapping({ adapterId }: { adapterId: string }) {
  const mapping = useMapping(adapterId);
  const canSet = useCan(ConnectorService.method.setMapping);
  const canPreview = useCan(ConnectorService.method.previewMapping);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const noMapping = isNoMapping(mapping.error);
  const current = mapping.data?.mapping;

  return (
    <Section
      title="Mapping"
      actions={
        current && (
          <span className="text-muted-foreground text-sm">Version {current.version}</span>
        )
      }
    >
      {mapping.isPending ? (
        <Loading what="the Mapping" />
      ) : mapping.error && !noMapping ? (
        <ErrorState error={mapping.error} />
      ) : (
        <>
          {noMapping && (
            <p className="text-muted-foreground text-sm">
              No Mapping yet; payloads are kept but make no Readings.
            </p>
          )}
          {savedVersion !== null && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              Saved Mapping version {savedVersion}. Readings already made are unchanged:{" "}
              <a href={`#${reprocessingAnchor}`} className="font-medium underline">
                Reprocess payloads
              </a>{" "}
              to rebuild them with it.
            </p>
          )}
          {!(canSet && canPreview) ? (
            current?.mapping && <MappingSummary mapping={current.mapping} />
          ) : (
            (current || noMapping) && (
              // Opened once from the loaded version; after a save it
              // already holds what was saved.
              <MappingEditor
                adapterId={adapterId}
                saved={current?.mapping}
                onSaved={setSavedVersion}
              />
            )
          )}
        </>
      )}
    </Section>
  );
}
