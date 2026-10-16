import { AccessService, type Member } from "@ridr/web";
import { useId, useState } from "react";
import { FormError } from "@/components/form-error";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  useRemoveMember,
  useSetMemberRole,
  useSetMemberScope,
} from "@/features/team/api/change-team";
import { useMembers } from "@/features/team/api/get-team";
import { roleLabel, scopeText } from "@/features/team/components/describe";
import { RolePicker } from "@/features/team/components/role-picker";
import {
  ScopeEditor,
  toConditions,
  type ScopeConditions,
} from "@/features/team/components/scope-editor";
import { Can, useCan, useMe } from "@/lib/me";

// MembersList shows everyone in the Organisation by email, with their
// Role and Scope. The signed-in user's row is marked and offers nothing.
export function MembersList() {
  const members = useMembers();
  const me = useMe();
  return (
    <section aria-labelledby="team-members" className="space-y-3">
      <h2 id="team-members" className="text-lg font-semibold">
        Members
      </h2>
      <QueryView query={members} what="members">
        {(data) => (
          <>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <MemberRow key={member.userId} member={member} isMe={member.userId === me.userId} />
                ))}
              </tbody>
            </table>
            {data.members.every((member) => member.userId === me.userId) && (
              <p className="text-muted-foreground text-sm">
                You're the only member. Invite your team.
              </p>
            )}
          </>
        )}
      </QueryView>
    </section>
  );
}

type MemberRowProps = { member: Member; isMe: boolean };

// MemberRow shows one member. On anyone but yourself, admins change the
// Role and Scope and remove the member, with any refusal beside the row.
function MemberRow({ member, isMe }: MemberRowProps) {
  const id = useId();
  const setRole = useSetMemberRole();
  const setScope = useSetMemberScope();
  const remove = useRemoveMember();
  const [editing, setEditing] = useState<ScopeConditions | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canSetRole = useCan(AccessService.method.setMemberRole);
  const error = setRole.error ?? setScope.error ?? remove.error;

  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-4">
        {member.email}
        {isMe && <span className="text-muted-foreground ml-2 text-xs">(you)</span>}
      </td>
      <td className="py-2 pr-4">
        {isMe || !canSetRole ? (
          roleLabel(member.role)
        ) : (
          <RolePicker
            value={member.role}
            onChange={(role) => setRole.mutate({ userId: member.userId, role })}
            label={`Role of ${member.email}`}
            hideLabel
            disabled={setRole.isPending}
          />
        )}
      </td>
      <td className="space-y-2 py-2 pr-4">
        {editing ? (
          <form
            aria-label={`Scope of ${member.email}`}
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setScope.mutate(
                { userId: member.userId, scope: { conditions: editing } },
                { onSuccess: () => setEditing(null) },
              );
            }}
          >
            <ScopeEditor value={editing} onChange={setEditing} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={setScope.isPending}>
                Save Scope
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          scopeText(member.scope)
        )}
      </td>
      <td className="space-y-1 py-2 text-right">
        {!isMe && (
          <div className="flex flex-wrap justify-end gap-2">
            {!editing && (
              <Can method={AccessService.method.setMemberScope}>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Change Scope of ${member.email}`}
                  onClick={() => {
                    setScope.reset();
                    setEditing(toConditions(member.scope));
                  }}
                >
                  Change Scope
                </Button>
              </Can>
            )}
            <Can method={AccessService.method.removeMember}>
              {confirming ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`Confirm removing ${member.email}`}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { userId: member.userId },
                        { onSettled: () => setConfirming(false) },
                      )
                    }
                  >
                    Remove {member.email}?
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Remove ${member.email}`}
                  onClick={() => {
                    remove.reset();
                    setConfirming(true);
                  }}
                >
                  Remove
                </Button>
              )}
            </Can>
          </div>
        )}
        <FormError id={id} error={error} />
      </td>
    </tr>
  );
}
