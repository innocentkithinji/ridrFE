import { useEffect } from "react";
import { useBlocker } from "react-router";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UnsavedDraft } from "@/lib/unsaved-draft";

type DiscardChangesDialogProps = {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
};

// DiscardChangesDialog asks before unsaved changes are thrown away.
// Staying keeps the draft as it is.
export function DiscardChangesDialog({ open, onStay, onDiscard }: DiscardChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            What you changed here hasn't been saved and will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <Button variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// LeaveGuard asks before the user leaves a form with unsaved changes: in
// the app (another page, or the same page at other search params) with
// DiscardChangesDialog, and on reload or tab close with the browser's own
// prompt. Leaving after "Discard" throws the draft away.
export function LeaveGuard<T>({ draft }: { draft: UnsavedDraft<T> }) {
  const { dirty, isDirty, discard } = draft;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty() &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers show the prompt only with returnValue set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  return (
    <DiscardChangesDialog
      open={blocker.state === "blocked"}
      onStay={() => blocker.reset?.()}
      onDiscard={() => {
        discard();
        blocker.proceed?.();
      }}
    />
  );
}

// RestoredDraftNotice says the form holds work restored from earlier,
// with a way to throw it away.
export function RestoredDraftNotice<T>({ draft }: { draft: UnsavedDraft<T> }) {
  if (!draft.restored) return null;
  return (
    <p role="status" className="bg-muted/50 rounded-lg border p-3 text-sm">
      Restored your unsaved draft ·{" "}
      <button type="button" className="font-medium underline" onClick={draft.discard}>
        Discard
      </button>
    </p>
  );
}
