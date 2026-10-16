import { useIsScoped } from "@/lib/me";

// ScopeNote tells a scoped user why some Alerts may be missing.
export function ScopeNote() {
  if (!useIsScoped()) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      You see Alerts only for the Assets in your Scope.
    </p>
  );
}
