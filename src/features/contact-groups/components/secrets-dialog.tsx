import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A newly issued webhook signing secret and the URL it belongs to.
export type IssuedSecret = { address: string; secret: string };

type SecretsDialogProps = {
  secrets: IssuedSecret[];
  onClose: () => void;
};

// SecretsDialog shows newly issued signing secrets once. They live only
// in the caller's state; closing the dialog drops them for good.
export function SecretsDialog({ secrets, onClose }: SecretsDialogProps) {
  return (
    <Dialog open={secrets.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Webhook signing secret</DialogTitle>
          <DialogDescription>
            Copy it now: you won't see this again. Receivers use it to verify notifications the
            Standard Webhooks way. A secret belongs to its URL, in every group that uses it.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {secrets.map((issued) => (
            <li key={issued.address} className="space-y-1">
              <p className="text-muted-foreground break-all text-xs">{issued.address}</p>
              <div className="flex items-center gap-2">
                <code
                  aria-label={`Signing secret for ${issued.address}`}
                  className="bg-muted flex-1 break-all rounded px-2 py-1 font-mono text-xs"
                >
                  {issued.secret}
                </code>
                <CopyButton value={issued.secret} />
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
