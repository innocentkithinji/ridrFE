import { AdapterService } from "@ridr/web";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useRetireAdapter } from "@/features/data-sources/api/retire-adapter";
import type { AdapterSectionProps } from "@/features/data-sources/components/adapter-screen";
import { Section } from "@/features/data-sources/components/section";
import { useCan } from "@/lib/me";

// RetireSection lets an admin retire an Adapter that isn't retired yet.
export function RetireSection({ adapter, retired }: AdapterSectionProps) {
  const canRetire = useCan(AdapterService.method.retireAdapter);
  const retire = useRetireAdapter();
  if (!canRetire || retired) return null;
  return (
    <Section title="Retire">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Retiring revokes every Ingest key, so {adapter.name} can no longer send data. Its
          Readings stay queryable.
        </p>
        <ConfirmDialog
          trigger={<Button variant="destructive">Retire</Button>}
          title={`Retire ${adapter.name}?`}
          confirm="Retire"
          onConfirm={() => retire.mutateAsync({ adapterId: adapter.id })}
        >
          Every Ingest key is revoked and it can no longer send data; its Readings stay queryable.
          This can't be undone.
        </ConfirmDialog>
      </div>
    </Section>
  );
}
