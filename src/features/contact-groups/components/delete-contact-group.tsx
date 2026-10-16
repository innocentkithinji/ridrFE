import { ConnectError } from "@connectrpc/connect";
import type { ContactGroup, Rule } from "@ridr/web";
import { Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDeleteContactGroup } from "@/features/contact-groups/api/change-contact-group";
import { RuleLinks } from "@/features/contact-groups/components/rule-links";
import { messageFor } from "@/lib/errors";

type DeleteContactGroupProps = {
  group: ContactGroup;
  // The Rules notifying the group, when the user may list Rules.
  rules: Rule[] | undefined;
};

// DeleteContactGroup is a group's "Delete" button. It asks first; when a
// Rule still notifies the group the server refuses, and the dialog shows
// why with links to the Rules to change.
export function DeleteContactGroup({ group, rules }: DeleteContactGroupProps) {
  const remove = useDeleteContactGroup();
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<string>();

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setRefusal(undefined);
    }
  }

  async function confirm() {
    try {
      await remove.mutateAsync({ contactGroupId: group.id });
      setOpen(false);
    } catch (error) {
      setRefusal(messageFor(ConnectError.from(error)));
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={openChange}>
      <AlertDialog.Trigger asChild>
        <Button variant="destructive" size="sm" aria-label={`Delete ${group.name}`}>
          <Trash2 /> Delete
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs" />
        <AlertDialog.Content className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm shadow-lg ring-1 sm:max-w-md">
          <AlertDialog.Title className="text-base font-medium">Delete {group.name}?</AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground">
            Rules can't notify a deleted group. This can't be undone.
          </AlertDialog.Description>
          {refusal && (
            <div role="alert" className="text-destructive space-y-1">
              <p>{refusal}</p>
              {rules && rules.length > 0 && <RuleLinks rules={rules} label="Change first:" />}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
