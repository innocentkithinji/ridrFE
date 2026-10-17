import { timestampMs } from "@bufbuild/protobuf/wkt";
import { RegistryService, type Asset } from "@ridr/web";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
import { Empty, QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssets } from "@/lib/api/registry";
import { AssetFormSheet } from "@/features/assets/components/asset-form";
import { AssetsList } from "@/features/assets/components/assets-list";
import { Can, useCan, useIsScoped } from "@/lib/me";

const sorts = {
  "name-asc": { label: "Name, A to Z", compare: (a: Asset, b: Asset) => byName(a, b) },
  "name-desc": { label: "Name, Z to A", compare: (a: Asset, b: Asset) => byName(b, a) },
  newest: { label: "Newest first", compare: (a: Asset, b: Asset) => createdMs(b) - createdMs(a) },
  oldest: { label: "Oldest first", compare: (a: Asset, b: Asset) => createdMs(a) - createdMs(b) },
} as const;

type SortId = keyof typeof sorts;

function byName(a: Asset, b: Asset): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function createdMs(asset: Asset): number {
  return asset.createdAt ? timestampMs(asset.createdAt) : 0;
}

// matches tells whether an Asset's name or one of its Attributes, written
// key=value, contains the filter text, ignoring case.
function matches(asset: Asset, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    asset.name,
    ...Object.entries(asset.attributes).map(([key, value]) => `${key}=${value}`),
  ];
  return haystack.some((text) => text.toLowerCase().includes(needle));
}

// AssetsScreen is /assets: every Asset the user may see, with its
// Attributes, filtered and sorted in the browser.
export function AssetsScreen() {
  const assets = useAssets();
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortId>("name-asc");
  const deferredFilter = useDeferredValue(filter);
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <Can method={RegistryService.method.createAsset}>
          <Button onClick={() => setCreating(true)}>Create Asset</Button>
          <AssetFormSheet open={creating} onOpenChange={setCreating} />
        </Can>
      </div>
      <ScopeNote />
      <QueryView
        query={assets}
        what="Assets"
        isEmpty={(data) => data.assets.length === 0}
        empty={<NoAssetsYet onCreate={() => setCreating(true)} />}
      >
        {(data) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="search"
                aria-label="Filter Assets"
                placeholder="Filter by name or key=value"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortId)}
                  className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                >
                  {Object.entries(sorts).map(([id, { label }]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ShownAssets assets={data.assets} filter={deferredFilter} sort={sort} />
          </>
        )}
      </QueryView>
    </section>
  );
}

type ShownAssetsProps = { assets: Asset[]; filter: string; sort: SortId };

function ShownAssets({ assets, filter, sort }: ShownAssetsProps) {
  const shown = useMemo(
    () => assets.filter((asset) => matches(asset, filter)).toSorted(sorts[sort].compare),
    [assets, filter, sort],
  );
  if (shown.length === 0) {
    return <Empty>No Assets match “{filter.trim()}”.</Empty>;
  }
  return (
    <>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {shown.length === assets.length
          ? `${assets.length} Assets`
          : `${shown.length} of ${assets.length} Assets`}
      </p>
      <AssetsList assets={shown} />
    </>
  );
}

// ScopeNote tells a scoped user why some Assets may be missing.
function ScopeNote() {
  if (!useIsScoped()) return null;
  return <p className="text-muted-foreground text-sm">You see Assets in your Scope only.</p>;
}

// NoAssetsYet is the list's empty state: a way to make the first Asset,
// or to find the Devices already reporting.
function NoAssetsYet({ onCreate }: { onCreate: () => void }) {
  // A scoped user never has Unclaimed devices, so the route is hidden.
  const canListUnclaimed = useCan(RegistryService.method.listUnclaimedDevices);
  const scoped = useIsScoped();
  const canSeeUnclaimed = canListUnclaimed && !scoped;
  return (
    <span className="flex flex-col items-center gap-3">
      No Assets yet.
      <Can method={RegistryService.method.createAsset}>
        <Button onClick={onCreate}>Create</Button>
      </Can>
      {canSeeUnclaimed && (
        <Link to="/devices/unclaimed" className="underline">
          See Unclaimed devices
        </Link>
      )}
    </span>
  );
}
