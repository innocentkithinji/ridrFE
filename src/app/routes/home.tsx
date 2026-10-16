import { useMe } from "@/lib/me";

// HomeRoute greets the user until the Home feature (live map, open
// Alerts, Device health) takes this route over.
export function HomeRoute() {
  const me = useMe();
  return (
    <section className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{me.tenantName}</h1>
      <p className="text-muted-foreground">Signed in as {me.email}.</p>
    </section>
  );
}
