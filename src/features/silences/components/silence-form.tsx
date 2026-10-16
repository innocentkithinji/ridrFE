import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { Asset } from "@ridr/web";
import { useId, useMemo, useState, type FormEvent } from "react";
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
import { useAssets } from "@/features/assets/api/get-assets";
import { useControlledKeys } from "@/features/controlled-keys/api/get-controlled-keys";
import { useCreateSilence } from "@/features/silences/api/change-silence";
import { refusalMessage } from "@/features/silences/refusal";
import {
  attributeProblems,
  attributeRowsOf,
  attributesOf,
  hasAttributeProblems,
  holdsEvery,
  newAttributeRow,
  type AttributeRow,
} from "@/lib/attributes";
import { useMe } from "@/lib/me";

const commentLimit = 500;

type SilenceFormSheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

// SilenceFormSheet creates a Silence in a panel over the list.
export function SilenceFormSheet({ open, onOpenChange }: SilenceFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create Silence</SheetTitle>
          <SheetDescription>
            Hold back notifications for the Assets holding every pair below. Rules keep
            recording Alerts; one still firing when the Silence ends is notified then.
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so each opening starts afresh. */}
        {open && <SilenceForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

// useScopeRows prefills the selector with the user's Scope: a key with one
// allowed value is filled in, a key with several waits for a choice.
function useScopeRows(): AttributeRow[] {
  const conditions = useMe().scope?.conditions ?? [];
  return conditions.map((condition) => ({
    ...newAttributeRow(),
    key: condition.key,
    value: condition.values.length === 1 ? condition.values[0] : "",
  }));
}

function SilenceForm({ onDone }: { onDone: () => void }) {
  const controlledKeys = useControlledKeys();
  const create = useCreateSilence();
  const scopeRows = useScopeRows();
  const [rows, setRows] = useState<AttributeRow[]>(scopeRows);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const endsProblemId = useId();
  const commentCountId = useId();

  if (controlledKeys.isPending) {
    return <Loading what="Controlled keys" />;
  }
  // Without the Controlled keys every key is free text; Ridr still
  // checks the values.
  const keys = controlledKeys.data?.controlledKeys ?? [];
  const endsProblem = submitted && !endsAt ? "Choose when the Silence ends." : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!endsAt || hasAttributeProblems(attributeProblems(rows, keys))) {
      return;
    }
    create.mutate(
      {
        selector: attributesOf(rows),
        startsAt: startsAt ? timestampFromDate(new Date(startsAt)) : undefined,
        endsAt: timestampFromDate(new Date(endsAt)),
        comment: comment.trim(),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4">
      <FromAsset onPick={(asset) => setRows(attributeRowsOf(asset.attributes))} />
      <AttributeEditor
        legend="Selector"
        rows={rows}
        onChange={setRows}
        controlledKeys={keys}
        showAllProblems={submitted}
      />
      <CoveredAssets rows={rows} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm font-medium">
          <span>Starts</span>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <span className="text-muted-foreground block text-xs font-normal">Empty starts now.</span>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Ends</span>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            aria-invalid={!!endsProblem}
            aria-describedby={endsProblem ? endsProblemId : undefined}
          />
          {endsProblem && (
            <span id={endsProblemId} className="text-destructive block text-xs font-normal">
              {endsProblem}
            </span>
          )}
        </label>
      </div>
      <label className="space-y-1 text-sm font-medium">
        <span>Comment</span>
        <textarea
          value={comment}
          maxLength={commentLimit}
          rows={3}
          placeholder="Why, such as a defrost or planned maintenance"
          onChange={(event) => setComment(event.target.value)}
          aria-describedby={commentCountId}
          className="border-input bg-background w-full rounded-lg border px-2 py-1 text-sm font-normal"
        />
        <span id={commentCountId} className="text-muted-foreground block text-xs font-normal">
          {comment.length} of {commentLimit} characters
        </span>
      </label>
      {create.error && (
        <p role="alert" className="text-destructive text-sm">
          {refusalMessage(create.error)}
        </p>
      )}
      <SheetFooter className="mt-auto px-0">
        <Button type="submit" disabled={create.isPending}>
          Create
        </Button>
      </SheetFooter>
    </form>
  );
}

// FromAsset fills the selector with one Asset's Attributes, picked by
// name.
function FromAsset({ onPick }: { onPick: (asset: Asset) => void }) {
  const assets = useAssets();
  const listId = useId();
  const [name, setName] = useState("");
  const all = assets.data?.assets ?? [];
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>Start from an Asset</span>
      <datalist id={listId}>
        {all.map((asset) => (
          <option key={asset.id} value={asset.name} />
        ))}
      </datalist>
      <Input
        list={listId}
        value={name}
        autoComplete="off"
        placeholder="Asset name"
        onChange={(event) => {
          setName(event.target.value);
          const picked = all.find((asset) => asset.name === event.target.value);
          if (picked) {
            onPick(picked);
          }
        }}
      />
      <span className="text-muted-foreground block text-xs font-normal">
        Copies its Attributes into the selector.
      </span>
    </label>
  );
}

// How many covered Assets the preview names before summing up the rest.
const previewLimit = 20;

// CoveredAssets previews the Assets holding every complete pair.
function CoveredAssets({ rows }: { rows: AttributeRow[] }) {
  const assets = useAssets();
  const selector = useMemo(
    () => attributesOf(rows.filter((row) => row.key.trim() && row.value.trim())),
    [rows],
  );
  const covered = useMemo(
    () =>
      (assets.data?.assets ?? []).filter((asset) => holdsEvery(asset.attributes, selector)),
    [assets.data, selector],
  );
  if (!assets.data) {
    return null;
  }
  if (Object.keys(selector).length === 0) {
    return <p className="text-muted-foreground text-sm">Add a pair to choose Assets.</p>;
  }
  if (covered.length === 0) {
    return <p className="text-muted-foreground text-sm">No Assets hold every pair yet.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        Covers {covered.length} {covered.length === 1 ? "Asset" : "Assets"}
      </p>
      <ul aria-label="Assets this Silence covers" className="text-muted-foreground list-disc pl-5">
        {covered.slice(0, previewLimit).map((asset) => (
          <li key={asset.id}>{asset.name}</li>
        ))}
        {covered.length > previewLimit && <li>and {covered.length - previewLimit} more</li>}
      </ul>
    </div>
  );
}
