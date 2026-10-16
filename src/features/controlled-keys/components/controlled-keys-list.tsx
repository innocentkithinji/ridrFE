import { RegistryService } from "@ridr/web";
import { QueryView } from "@/components/states";
import { useControlledKeys } from "@/features/controlled-keys/api/get-controlled-keys";
import { useValueUsage } from "@/features/controlled-keys/api/get-value-usage";
import { ControlledKeyCard } from "@/features/controlled-keys/components/controlled-key-card";
import { DeclareControlledKeyForm } from "@/features/controlled-keys/components/declare-controlled-key-form";
import { Can } from "@/lib/me";

// ControlledKeysList shows every Controlled key with its allowed values.
// Admins declare keys here; everyone else sees the list read-only.
export function ControlledKeysList() {
  const keys = useControlledKeys();
  const usage = useValueUsage();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Controlled keys</h1>
      <Can method={RegistryService.method.declareControlledKey}>
        <DeclareControlledKeyForm />
      </Can>
      <QueryView
        query={keys}
        what="Controlled keys"
        isEmpty={(data) => data.controlledKeys.length === 0}
        empty="No Controlled keys. Declare one, such as site, to build Scopes."
      >
        {(data) => (
          <div className="space-y-4">
            {data.controlledKeys.map((key) => (
              <ControlledKeyCard key={key.key} controlledKey={key} usage={usage} />
            ))}
          </div>
        )}
      </QueryView>
    </section>
  );
}
