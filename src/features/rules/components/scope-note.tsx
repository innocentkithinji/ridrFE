import { useIsScoped } from "@/lib/me";

// ScopeNote tells a scoped user why some Rules may be missing, and what
// a Rule they save must select.
export function ScopeNote() {
  if (!useIsScoped()) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      You see only Rules whose selector lies inside your Scope, and can save only such Rules.
    </p>
  );
}
