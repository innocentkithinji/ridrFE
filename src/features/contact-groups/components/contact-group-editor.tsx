import type { ContactGroup } from "@ridr/web";
import { Pencil, Plus } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useCreateContactGroup,
  useUpdateContactGroup,
} from "@/features/contact-groups/api/change-contact-group";
import {
  ContactGroupForm,
  type ContactGroupDraft,
} from "@/features/contact-groups/components/contact-group-form";
import { SecretsDialog, type IssuedSecret } from "@/features/contact-groups/components/secrets-dialog";

// CreateContactGroup is the "Create" button and the new group's form.
export function CreateContactGroup() {
  const create = useCreateContactGroup();
  return (
    <ContactGroupEditor
      title="New Contact group"
      trigger={
        <Button>
          <Plus /> Create
        </Button>
      }
      save={async (draft) => (await create.mutateAsync(draft)).contactGroup}
    />
  );
}

// EditContactGroup is a group's "Edit" button and its form.
export function EditContactGroup({ group }: { group: ContactGroup }) {
  const update = useUpdateContactGroup();
  return (
    <ContactGroupEditor
      title={`Edit ${group.name}`}
      group={group}
      trigger={
        <Button variant="outline" size="sm" aria-label={`Edit ${group.name}`}>
          <Pencil /> Edit
        </Button>
      }
      save={async (draft) =>
        (await update.mutateAsync({ contactGroupId: group.id, ...draft })).contactGroup
      }
    />
  );
}

type ContactGroupEditorProps = {
  title: string;
  trigger: ReactElement;
  group?: ContactGroup;
  save: (draft: ContactGroupDraft) => Promise<ContactGroup | undefined>;
};

// ContactGroupEditor opens the form in a dialog, then shows any signing
// secret the save issued, once.
function ContactGroupEditor({ title, trigger, group, save }: ContactGroupEditorProps) {
  const [open, setOpen] = useState(false);
  const [secrets, setSecrets] = useState<IssuedSecret[]>([]);
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ContactGroupForm
            group={group}
            save={save}
            onCancel={() => setOpen(false)}
            onSaved={(saved) => {
              setOpen(false);
              setSecrets(issuedSecrets(saved));
            }}
          />
        </DialogContent>
      </Dialog>
      <SecretsDialog secrets={secrets} onClose={() => setSecrets([])} />
    </>
  );
}

function issuedSecrets(group: ContactGroup | undefined): IssuedSecret[] {
  return (group?.contacts ?? [])
    .filter((contact) => contact.signingSecret !== "")
    .map((contact) => ({ address: contact.address, secret: contact.signingSecret }));
}
