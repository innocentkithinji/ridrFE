import { SilenceService } from "@ridr/web";
import { useState } from "react";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useSilences } from "@/features/silences/api/get-silences";
import { SilenceFormSheet, silenceDraftKey } from "@/features/silences/components/silence-form";
import { SilencesList } from "@/features/silences/components/silences-list";
import { Can, useIsScoped } from "@/lib/me";
import { hasStoredDraft } from "@/lib/unsaved-draft";

// SilencesScreen is /silences: pending and active Silences, expired ones
// on demand, and the form to create one.
export function SilencesScreen() {
  const [includeExpired, setIncludeExpired] = useState(false);
  const silences = useSilences(includeExpired);
  // A Silence left unsaved reopens at once, restoring its draft.
  const [creating, setCreating] = useState(() => hasStoredDraft(silenceDraftKey));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Silences</h1>
        <Can method={SilenceService.method.createSilence}>
          <Button onClick={() => setCreating(true)}>Create Silence</Button>
          <SilenceFormSheet open={creating} onOpenChange={setCreating} />
        </Can>
      </div>
      <ScopeNote />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeExpired}
          onChange={(event) => setIncludeExpired(event.target.checked)}
        />
        Show expired
      </label>
      <QueryView
        query={silences}
        what="Silences"
        isEmpty={(data) => data.silences.length === 0}
        empty="No Silences. Create one before planned maintenance."
      >
        {(data) => <SilencesList silences={data.silences} />}
      </QueryView>
    </section>
  );
}

// ScopeNote tells a scoped user why some Silences may be missing and why
// the selector starts with their Scope.
function ScopeNote() {
  if (!useIsScoped()) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      You see and create Silences within your Scope only.
    </p>
  );
}
