import { ConnectError } from "@connectrpc/connect";
import { AlertService, AlertState, type Alert } from "@ridr/web";
import { Button } from "@/components/ui/button";
import { useAcknowledgeAlert, useResolveAlert } from "@/features/alerts/api/change-alert";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";

// AlertActions offers Acknowledge and Resolve to users whose Permissions
// allow them, and only in the states where they apply.
export function AlertActions({ alert }: { alert: Alert }) {
  const canAcknowledge = useCan(AlertService.method.acknowledgeAlert);
  const canResolve = useCan(AlertService.method.resolveAlert);
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const busy = acknowledge.isPending || resolve.isPending;
  const error = acknowledge.error ?? resolve.error;
  const target = { alertId: alert.id };
  const showAcknowledge = canAcknowledge && alert.state === AlertState.FIRING;
  const showResolve = canResolve && alert.state !== AlertState.RESOLVED;
  if (!showAcknowledge && !showResolve && !error) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {showAcknowledge && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            resolve.reset();
            acknowledge.mutate(target);
          }}
        >
          Acknowledge
        </Button>
      )}
      {showResolve && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            acknowledge.reset();
            resolve.mutate(target);
          }}
        >
          Resolve
        </Button>
      )}
      {error && (
        <span role="alert" className="text-destructive text-sm">
          {messageFor(ConnectError.from(error))}
        </span>
      )}
    </span>
  );
}
