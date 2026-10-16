import { Code, ConnectError } from "@connectrpc/connect";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { RegistryService, type Asset } from "@ridr/web";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { AttributeEditor } from "@/components/attribute-editor";
import { Loading } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssignDevice } from "@/features/assets/api/change-assignment";
import { useCreateAsset } from "@/features/assets/api/change-asset";
import { useAssets } from "@/features/assets/api/get-assets";
import { useControlledKeys } from "@/features/controlled-keys/api/get-controlled-keys";
import {
  attributeProblems,
  attributesOf,
  hasAttributeProblems,
  type AttributeRow,
} from "@/lib/attributes";
import { messageFor } from "@/lib/errors";
import { useCan } from "@/lib/me";

type ClaimDeviceSheetProps = {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ClaimDeviceSheet assigns an Unclaimed device to a new Asset or to an
// existing one, in a panel over the list.
export function ClaimDeviceSheet({ deviceId, open, onOpenChange }: ClaimDeviceSheetProps) {
  const canCreate = useCan(RegistryService.method.createAsset);
  const done = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Claim {deviceId}</SheetTitle>
          <SheetDescription>
            Its Readings count for the Asset from the start time on.
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so each opening starts empty. */}
        {open &&
          (canCreate ? (
            <Tabs defaultValue="new" className="flex-1 px-4">
              <TabsList>
                <TabsTrigger value="new">New Asset</TabsTrigger>
                <TabsTrigger value="existing">Existing Asset</TabsTrigger>
              </TabsList>
              <TabsContent value="new" className="flex">
                <ClaimAsNewAsset deviceId={deviceId} onDone={done} />
              </TabsContent>
              <TabsContent value="existing" className="flex">
                <AssignToExistingAsset deviceId={deviceId} onDone={done} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-1 px-4">
              <AssignToExistingAsset deviceId={deviceId} onDone={done} />
            </div>
          ))}
      </SheetContent>
    </Sheet>
  );
}

type ClaimFormProps = { deviceId: string; onDone: () => void };

// ClaimAsNewAsset creates an Asset, then assigns the Device to it. When
// the assignment fails, saving again only retries the assignment.
function ClaimAsNewAsset({ deviceId, onDone }: ClaimFormProps) {
  const controlledKeys = useControlledKeys();
  const create = useCreateAsset();
  const assign = useAssignDevice();
  const [created, setCreated] = useState<Asset>();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameProblemId = useId();

  if (controlledKeys.isPending) {
    return <Loading what="Controlled keys" />;
  }
  const keys = controlledKeys.data?.controlledKeys ?? [];

  const createError = create.error ? ConnectError.from(create.error) : undefined;
  const nameTaken = createError?.code === Code.AlreadyExists;
  const nameProblem = nameTaken
    ? createError.rawMessage
    : submitted && !name.trim()
      ? "Give the Asset a name."
      : undefined;
  const startProblem = submitted ? startsAtProblem(startsAt) : undefined;
  const error =
    (createError && !nameTaken ? createError : undefined) ??
    (assign.error ? ConnectError.from(assign.error) : undefined);

  const assignTo = (asset: Asset) =>
    assign.mutate(
      { deviceId, assetId: asset.id, startsAt: startsAtOf(startsAt) },
      { onSuccess: onDone },
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (startsAtProblem(startsAt)) {
      return;
    }
    if (created) {
      assignTo(created);
      return;
    }
    if (!name.trim() || hasAttributeProblems(attributeProblems(rows, keys))) {
      return;
    }
    create.mutate(
      { name: name.trim(), attributes: attributesOf(rows) },
      {
        onSuccess: ({ asset }) => {
          if (asset) {
            setCreated(asset);
            assignTo(asset);
          }
        },
      },
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pt-2">
      <label className="space-y-1 text-sm font-medium">
        <span>Name</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          readOnly={!!created}
          aria-invalid={!!nameProblem}
          aria-describedby={nameProblem ? nameProblemId : undefined}
          autoFocus
        />
        {nameProblem && (
          <span
            id={nameProblemId}
            role="alert"
            className="text-destructive block text-xs font-normal"
          >
            {nameProblem}
          </span>
        )}
      </label>
      {!created && (
        <AttributeEditor
          rows={rows}
          onChange={setRows}
          controlledKeys={keys}
          showAllProblems={submitted}
        />
      )}
      <StartsAtField value={startsAt} onChange={setStartsAt} problem={startProblem} />
      <FormFooter error={error} pending={create.isPending || assign.isPending}>
        {created ? "Assign" : "Create and assign"}
      </FormFooter>
    </form>
  );
}

// AssignToExistingAsset assigns the Device to an Asset the user picks.
function AssignToExistingAsset({ deviceId, onDone }: ClaimFormProps) {
  const assets = useAssets();
  const assign = useAssignDevice();
  const [assetId, setAssetId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const assetProblemId = useId();

  if (assets.isPending) {
    return <Loading what="Assets" />;
  }
  const assetProblem = submitted && !assetId ? "Choose an Asset." : undefined;
  const startProblem = submitted ? startsAtProblem(startsAt) : undefined;
  const error = assets.error ?? assign.error;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!assetId || startsAtProblem(startsAt)) {
      return;
    }
    assign.mutate({ deviceId, assetId, startsAt: startsAtOf(startsAt) }, { onSuccess: onDone });
  };

  const options = (assets.data?.assets ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pt-2">
      <label className="space-y-1 text-sm font-medium">
        <span>Asset</span>
        <select
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
          aria-invalid={!!assetProblem}
          aria-describedby={assetProblem ? assetProblemId : undefined}
          className="border-input bg-background aria-invalid:border-destructive h-8 w-full rounded-lg border px-2 text-sm font-normal"
        >
          <option value="">Choose an Asset</option>
          {options.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
        {assetProblem && (
          <span
            id={assetProblemId}
            role="alert"
            className="text-destructive block text-xs font-normal"
          >
            {assetProblem}
          </span>
        )}
      </label>
      <StartsAtField value={startsAt} onChange={setStartsAt} problem={startProblem} />
      <FormFooter error={error ? ConnectError.from(error) : undefined} pending={assign.isPending}>
        Assign
      </FormFooter>
    </form>
  );
}

type StartsAtFieldProps = { value: string; onChange: (value: string) => void; problem?: string };

// StartsAtField picks when the Assignment starts: empty means now, a past
// time claims the Readings since then.
function StartsAtField({ value, onChange, problem }: StartsAtFieldProps) {
  const problemId = useId();
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>Starts at (optional)</span>
      <Input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!problem}
        aria-describedby={problem ? problemId : undefined}
      />
      <span
        id={problemId}
        role={problem ? "alert" : undefined}
        className={`block text-xs font-normal ${problem ? "text-destructive" : "text-muted-foreground"}`}
      >
        {problem ?? "Leave empty to start now. A past time claims the Readings since then."}
      </span>
    </label>
  );
}

// startsAtProblem says what is wrong with a datetime-local value, if anything.
function startsAtProblem(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return "Enter a date and time.";
  }
  return time > Date.now() ? "Pick a time in the past, or leave it empty for now." : undefined;
}

function startsAtOf(value: string) {
  return value ? timestampFromDate(new Date(value)) : undefined;
}

type FormFooterProps = { error?: ConnectError; pending: boolean; children: ReactNode };

function FormFooter({ error, pending, children }: FormFooterProps) {
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {messageFor(error)}
        </p>
      )}
      <SheetFooter className="mt-auto px-0">
        <Button type="submit" disabled={pending}>
          {children}
        </Button>
      </SheetFooter>
    </>
  );
}
