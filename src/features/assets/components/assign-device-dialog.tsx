import { Code, ConnectError } from "@connectrpc/connect";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAssets } from "@/features/assets/api/get-assets";
import { useAssignDevice } from "@/features/assets/api/change-assignment";
import { now, timestampOf, WhenField, whenProblem, type When } from "@/features/assets/components/when-field";
import { messageFor } from "@/lib/errors";

type AssignDeviceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fix the Asset (from its detail) or the Device (from the Unclaimed
  // list); the dialog asks for whichever is left.
  asset?: { id: string; name: string };
  deviceId?: string;
  onAssigned?: () => void;
};

// AssignDeviceDialog assigns a Device to an Asset from now or a chosen
// time, ending the Device's current Assignment then.
export function AssignDeviceDialog(props: AssignDeviceDialogProps) {
  const { open, onOpenChange, asset, deviceId } = props;
  const title = asset
    ? `Assign a Device to ${asset.name}`
    : `Assign ${deviceId ?? "a Device"} to an Asset`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Readings count for the Asset from the start. A past start claims the Readings since
            then.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts empty. */}
        {open && <AssignForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({ asset, deviceId: fixedDevice, onOpenChange, onAssigned }: AssignDeviceDialogProps) {
  const assign = useAssignDevice();
  const [deviceId, setDeviceId] = useState(fixedDevice ?? "");
  const [assetId, setAssetId] = useState(asset?.id ?? "");
  const [when, setWhen] = useState<When>(now);
  const [submitted, setSubmitted] = useState(false);
  const deviceProblemId = useId();

  const deviceProblem = submitted && !deviceId.trim() ? "Give the Device's ID." : undefined;
  const assetProblem = submitted && !assetId ? "Choose an Asset." : undefined;
  const timeProblem = submitted ? whenProblem(when) : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!deviceId.trim() || !assetId || whenProblem(when)) return;
    assign.mutate(
      { deviceId: deviceId.trim(), assetId, startsAt: timestampOf(when) },
      {
        onSuccess: () => {
          onOpenChange(false);
          onAssigned?.();
        },
      },
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {fixedDevice === undefined && (
        <label className="space-y-1 text-sm font-medium">
          <span>Device ID</span>
          <Input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            aria-invalid={!!deviceProblem}
            aria-describedby={deviceProblem ? deviceProblemId : undefined}
            className="font-mono"
            autoFocus
          />
          {deviceProblem && (
            <span id={deviceProblemId} role="alert" className="text-destructive block text-xs font-normal">
              {deviceProblem}
            </span>
          )}
        </label>
      )}
      {asset === undefined && <AssetPicker value={assetId} onChange={setAssetId} problem={assetProblem} />}
      <WhenField
        legend="Starts"
        atLabel="From a chosen time"
        value={when}
        onChange={setWhen}
        problem={timeProblem}
      />
      {assign.error && (
        <p role="alert" className="text-destructive text-sm">
          {assignErrorMessage(ConnectError.from(assign.error))}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={assign.isPending}>
          Assign
        </Button>
      </DialogFooter>
    </form>
  );
}

// assignErrorMessage explains why Ridr refused an Assignment.
function assignErrorMessage(error: ConnectError): string {
  switch (error.code) {
    case Code.FailedPrecondition:
      return `Assignments of a Device can't overlap, and this one would: ${error.rawMessage}. Choose a later start.`;
    case Code.NotFound:
      return "Ridr has never seen a Device with this ID, or the Asset is gone.";
    default:
      return messageFor(error);
  }
}

type AssetPickerProps = { value: string; onChange: (assetId: string) => void; problem?: string };

function AssetPicker({ value, onChange, problem }: AssetPickerProps) {
  const assets = useAssets();
  const problemId = useId();
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>Asset</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={assets.isPending}
        aria-invalid={!!problem}
        aria-describedby={problem ? problemId : undefined}
        className="border-input bg-background block h-8 w-full rounded-lg border px-2 text-sm font-normal"
      >
        <option value="">{assets.isPending ? "Loading Assets…" : "Choose an Asset"}</option>
        {assets.data?.assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name}
          </option>
        ))}
      </select>
      {assets.error && (
        <span role="alert" className="text-destructive block text-xs font-normal">
          {messageFor(assets.error)}
        </span>
      )}
      {problem && (
        <span id={problemId} role="alert" className="text-destructive block text-xs font-normal">
          {problem}
        </span>
      )}
    </label>
  );
}
