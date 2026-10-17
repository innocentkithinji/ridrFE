import { Check, Copy, KeyRound } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A secret Ridr returns once, with what to call it: "Ingest key",
// "Webhook URL", "Signing secret for https://…"…
export type Secret = { label: string; value: string };

type SecretDialogProps = {
  // The secrets to show, or null when the dialog is closed. Hold them in
  // the calling component's state only, never in the query cache, a URL
  // or storage, and drop them in onDone.
  secrets: Secret[] | null;
  title: string;
  // What the secrets are for; the dialog adds that they won't be shown
  // again.
  children?: ReactNode;
  // Ridr keeps only a hash of most secrets (Ingest keys, passwords), and
  // the dialog says so. Pass false for one Ridr keeps to use itself, such
  // as a webhook signing secret.
  hashed?: boolean;
  // Called when the user is done with the secrets. The dialog closes only
  // through "Done", never by a stray click or Escape, so a secret can't
  // be lost by accident.
  onDone: () => void;
};

// SecretDialog shows secrets Ridr issues exactly once, each with a copy
// button, until the user says they are done.
export function SecretDialog({ secrets, title, children, hashed = true, onDone }: SecretDialogProps) {
  return (
    <Dialog open={secrets !== null}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden /> {title}
          </DialogTitle>
          <DialogDescription>
            {children} Copy it now: it won't be shown again.
            {hashed && " Ridr keeps only a hash of it."}
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-3">
          {secrets?.map((secret) => <SecretValue key={secret.label} secret={secret} />)}
        </dl>
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecretValue({ secret }: { secret: Secret }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(secret.value);
    setCopied(true);
  }

  return (
    <div className="space-y-1">
      <dt id={id} className="text-muted-foreground text-xs font-medium">
        {secret.label}
      </dt>
      <dd className="bg-muted flex items-start gap-2 rounded-lg border p-2">
        <code aria-labelledby={id} className="min-w-0 flex-1 font-mono text-sm break-all">
          {secret.value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Copy ${secret.label}`}
          onClick={() => void copy()}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </dd>
    </div>
  );
}
