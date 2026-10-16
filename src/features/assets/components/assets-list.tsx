import { RegistryService, type Asset } from "@ridr/web";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { AssetFormSheet } from "@/features/assets/components/asset-form";
import { useCan } from "@/lib/me";

// AssetsList shows Assets one per row, drawing only the rows in view so
// fleets of thousands scroll smoothly.
export function AssetsList({ assets }: { assets: Asset[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const canEdit = useCan(RegistryService.method.updateAsset);
  // The Asset stays set while the panel closes, so its title holds.
  const [editing, setEditing] = useState<{ asset?: Asset; open: boolean }>({ open: false });
  // TanStack Virtual returns fresh functions each render, which React
  // Compiler can't memoize; this component re-renders with it anyway.
  // oxlint-disable-next-line react/incompatible-library
  const rows = useVirtualizer({
    count: assets.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <>
      <div
        ref={scroller}
        className="h-[calc(100svh-14rem)] min-h-64 overflow-auto rounded-lg border"
      >
        <ul aria-label="Assets" className="relative w-full" style={{ height: rows.getTotalSize() }}>
          {rows.getVirtualItems().map((row) => {
            const asset = assets[row.index];
            return (
              <li
                key={asset.id}
                data-index={row.index}
                ref={rows.measureElement}
                className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3"
                style={{ transform: `translateY(${row.start}px)` }}
              >
                <Link to={`/assets/${asset.id}`} className="font-medium hover:underline">
                  {asset.name}
                </Link>
                <AttributeList attributes={asset.attributes} />
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label={`Edit ${asset.name}`}
                    onClick={() => setEditing({ asset, open: true })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <AssetFormSheet
        asset={editing.asset}
        open={editing.open}
        onOpenChange={(open) => setEditing({ ...editing, open })}
      />
    </>
  );
}

function AttributeList({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes).toSorted(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Attributes" className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs"
        >
          {key}={value}
        </li>
      ))}
    </ul>
  );
}
