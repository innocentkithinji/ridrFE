import { ConnectError } from "@connectrpc/connect";
import { RotateCw } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRotateWebhookSecret } from "@/features/contact-groups/api/change-contact-group";
import { WebhookSecretDialog, type IssuedSecret } from "@/features/contact-groups/components/webhook-secret-dialog";
import { messageFor } from "@/lib/errors";

// RotateWebhookSecret replaces a webhook URL's signing secret after
// asking, then shows the new one once.
export function RotateWebhookSecret({ address }: { address: string }) {
  const rotate = useRotateWebhookSecret();
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [secrets, setSecrets] = useState<IssuedSecret[]>([]);

  async function confirm() {
    try {
      const answer = await rotate.mutateAsync({ address });
      rotate.reset(); // the secret lives only in this component's state
      setOpen(false);
      setSecrets([{ address, secret: answer.signingSecret }]);
    } catch (error) {
      setRefusal(messageFor(ConnectError.from(error)));
    }
  }

  return (
    <>
      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setRefusal(undefined);
        }}
      >
        <AlertDialog.Trigger asChild>
          <Button variant="ghost" size="xs" aria-label={`Rotate secret for ${address}`}>
            <RotateCw /> Rotate secret
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs" />
          <AlertDialog.Content className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm shadow-lg ring-1 sm:max-w-md">
            <AlertDialog.Title className="text-base font-medium">
              Rotate this webhook's secret?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground break-all">
              {address} gets a new signing secret, in every group that uses it. Its receiver must
              switch to the new one to keep verifying notifications.
            </AlertDialog.Description>
            {refusal && (
              <p role="alert" className="text-destructive">
                {refusal}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">Cancel</Button>
              </AlertDialog.Cancel>
              <Button onClick={confirm} disabled={rotate.isPending}>
                {rotate.isPending ? "Rotating…" : "Rotate"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <WebhookSecretDialog secrets={secrets} onDone={() => setSecrets([])} />
    </>
  );
}
