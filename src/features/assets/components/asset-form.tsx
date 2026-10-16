import { Code, ConnectError } from "@connectrpc/connect";
import type { Asset } from "@ridr/web";
import { useId, useState, type FormEvent } from "react";
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
import { useCreateAsset, useUpdateAsset } from "@/features/assets/api/change-asset";
import { useControlledKeys } from "@/features/assets/api/get-controlled-keys";
import {
  attributeProblems,
  attributeRowsOf,
  attributesOf,
  hasAttributeProblems,
  type AttributeRow,
} from "@/lib/attributes";
import { messageFor } from "@/lib/errors";

type AssetFormSheetProps = {
  // The Asset to edit; none to create one.
  asset?: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// AssetFormSheet creates an Asset, or renames one and replaces its
// Attributes, in a panel over the list.
export function AssetFormSheet({ asset, open, onOpenChange }: AssetFormSheetProps) {
  const title = asset ? `Edit ${asset.name}` : "Create Asset";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {asset
              ? "Saving replaces all of the Asset's Attributes with these."
              : "Name the real thing your Devices report for."}
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so each opening starts from the Asset. */}
        {open && <AssetForm asset={asset} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

type AssetFormProps = { asset?: Asset; onDone: () => void };

function AssetForm({ asset, onDone }: AssetFormProps) {
  const controlledKeys = useControlledKeys();
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const save = asset ? update : create;
  const [name, setName] = useState(asset?.name ?? "");
  const [rows, setRows] = useState<AttributeRow[]>(() => attributeRowsOf(asset?.attributes ?? {}));
  const [submitted, setSubmitted] = useState(false);
  const nameProblemId = useId();

  if (controlledKeys.isPending) {
    return <Loading what="Controlled keys" />;
  }
  // Without the Controlled keys every key is free text; Ridr still
  // refuses a value a Controlled key doesn't allow.
  const keys = controlledKeys.data?.controlledKeys ?? [];

  const error = save.error ? ConnectError.from(save.error) : undefined;
  const nameTaken = error?.code === Code.AlreadyExists;
  const nameProblem = nameTaken
    ? error.rawMessage
    : submitted && !name.trim()
      ? "Give the Asset a name."
      : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || hasAttributeProblems(attributeProblems(rows, keys))) {
      return;
    }
    const request = { name: name.trim(), attributes: attributesOf(rows) };
    const options = { onSuccess: onDone };
    if (asset) {
      update.mutate({ assetId: asset.id, ...request }, options);
    } else {
      create.mutate(request, options);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4">
      <label className="space-y-1 text-sm font-medium">
        <span>Name</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
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
      <AttributeEditor
        rows={rows}
        onChange={setRows}
        controlledKeys={keys}
        showAllProblems={submitted}
      />
      {error && !nameTaken && (
        <p role="alert" className="text-destructive text-sm">
          {messageFor(error)}
        </p>
      )}
      <SheetFooter className="mt-auto px-0">
        <Button type="submit" disabled={save.isPending}>
          {asset ? "Save" : "Create"}
        </Button>
      </SheetFooter>
    </form>
  );
}
