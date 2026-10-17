import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

// SessionControls lets the user change Organisation or sign out. It works
// before GetMe answers, so a refused GetMe is never a dead end.
export function SessionControls() {
  const { organisationSwitcher, signOut } = useSession();
  return (
    <div className="flex items-center gap-2">
      {organisationSwitcher}
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
