import { Code, ConnectError } from "@connectrpc/connect";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUnassignDevice } from "@/features/assets/api/change-assignment";
import { now, timestampOf, WhenField, whenProblem, type When } from "@/features/assets/components/when-field";
import { messageFor } from "@/lib/errors";

type UnassignDeviceDialogProps = {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// UnassignDeviceDialog ends a Device's current Assignment now or at a
// chosen time; its later Readings stay under its Device ID.
export function UnassignDeviceDialog(props: UnassignDeviceDialogProps) {
  const { deviceId, open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unassign {deviceId}</DialogTitle>
          <DialogDescription>
            Readings from the end on no longer count for the Asset.
          </DialogDescription>
        </DialogHeader>
        {open && <UnassignForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function UnassignForm({ deviceId, onOpenChange }: UnassignDeviceDialogProps) {
  const unassign = useUnassignDevice();
  const [when, setWhen] = useState<When>(now);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (whenProblem(when)) return;
    unassign.mutate(
      { deviceId, endsAt: timestampOf(when) },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <WhenField
        legend="Ends"
        atLabel="At a chosen time"
        value={when}
        onChange={setWhen}
        problem={submitted ? whenProblem(when) : undefined}
      />
      {unassign.error && (
        <p role="alert" className="text-destructive text-sm">
          {unassignErrorMessage(ConnectError.from(unassign.error))}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={unassign.isPending}>
          Unassign
        </Button>
      </DialogFooter>
    </form>
  );
}

function unassignErrorMessage(error: ConnectError): string {
  if (error.code === Code.NotFound) {
    return "This Device has no current Assignment, so there is nothing to end. Someone may have unassigned it already.";
  }
  return messageFor(error);
}
