import { ContactGroupService, RuleService, type ContactGroup, type Rule } from "@ridr/web";
import { QueryView } from "@/components/states";
import { useContactGroups } from "@/features/contact-groups/api/get-contact-groups";
import { useRules } from "@/features/contact-groups/api/get-rules";
import { DeleteContactGroup } from "@/features/contact-groups/components/delete-contact-group";
import { RuleLinks } from "@/features/contact-groups/components/rule-links";
import { channelLabel } from "@/features/contact-groups/components/channels";
import {
  CreateContactGroup,
  EditContactGroup,
} from "@/features/contact-groups/components/contact-group-editor";
import { Can, useCan } from "@/lib/me";

// ContactGroupsList shows every Contact group with its Contacts and the
// Rules that notify it.
export function ContactGroupsList() {
  const groups = useContactGroups();
  const canListRules = useCan(RuleService.method.listRules);
  const rules = useRules({ enabled: canListRules });

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Contact groups</h1>
        <Can method={ContactGroupService.method.createContactGroup}>
          <CreateContactGroup />
        </Can>
      </header>
      <QueryView
        query={groups}
        what="Contact groups"
        isEmpty={(answer) => answer.contactGroups.length === 0}
        empty="No Contact groups. Rules need one to notify anybody."
      >
        {(answer) => (
          <div className="grid gap-4">
            {answer.contactGroups.map((group) => (
              <ContactGroupCard
                key={group.id}
                group={group}
                rules={canListRules ? notifying(rules.data?.rules, group.id) : undefined}
              />
            ))}
          </div>
        )}
      </QueryView>
    </section>
  );
}

// notifying returns the Rules whose contactGroupIds hold groupId.
function notifying(rules: Rule[] | undefined, groupId: string): Rule[] | undefined {
  return rules?.filter((rule) => rule.contactGroupIds.includes(groupId));
}

type ContactGroupCardProps = {
  group: ContactGroup;
  // The Rules notifying the group; undefined while loading or when the
  // user may not list Rules.
  rules: Rule[] | undefined;
};

function ContactGroupCard({ group, rules }: ContactGroupCardProps) {
  const headingId = `contact-group-${group.id}`;
  return (
    <article aria-labelledby={headingId} className="space-y-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          {group.name}
        </h2>
        <div className="flex gap-2">
          <Can method={ContactGroupService.method.updateContactGroup}>
            <EditContactGroup group={group} />
          </Can>
          <Can method={ContactGroupService.method.deleteContactGroup}>
            <DeleteContactGroup group={group} rules={rules} />
          </Can>
        </div>
      </header>
      {group.contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Contacts.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {group.contacts.map((contact) => (
            <li key={`${contact.channel}:${contact.address}`} className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">
                {channelLabel(contact.channel)}
              </span>
              <span className="break-all">{contact.address}</span>
            </li>
          ))}
        </ul>
      )}
      {rules && <NotifyingRules rules={rules} />}
    </article>
  );
}

function NotifyingRules({ rules }: { rules: Rule[] }) {
  if (rules.length === 0) {
    return <p className="text-muted-foreground text-sm">No Rule notifies this group.</p>;
  }
  return <RuleLinks rules={rules} label="Notified by:" />;
}
