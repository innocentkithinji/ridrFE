import { timestampDate } from "@bufbuild/protobuf/wkt";
import { AccessService, type Invitation } from "@ridr/web";
import { useId } from "react";
import { FormError } from "@/components/form-error";
import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useRevokeInvitation } from "@/features/team/api/change-team";
import { useInvitations } from "@/features/team/api/get-invitations";
import { roleLabel, scopeText } from "@/features/team/components/describe";
import { Can } from "@/lib/me";

// InvitationsList shows pending invitations with when each was sent.
// An invitation leaves the list once its person signs in.
export function InvitationsList() {
  const invitations = useInvitations();
  return (
    <section aria-labelledby="team-invitations" className="space-y-3">
      <h2 id="team-invitations" className="text-lg font-semibold">
        Invitations
      </h2>
      <QueryView
        query={invitations}
        what="invitations"
        isEmpty={(data) => data.invitations.length === 0}
        empty="No pending invitations."
      >
        {(data) => (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Scope</th>
                <th className="py-2 pr-4 font-medium">Sent</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.invitations.map((invitation) => (
                <InvitationRow key={invitation.email} invitation={invitation} />
              ))}
            </tbody>
          </table>
        )}
      </QueryView>
    </section>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const id = useId();
  const revoke = useRevokeInvitation();
  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-4">{invitation.email}</td>
      <td className="py-2 pr-4">{roleLabel(invitation.role)}</td>
      <td className="py-2 pr-4">{scopeText(invitation.scope)}</td>
      <td className="py-2 pr-4">
        {invitation.sentAt && timestampDate(invitation.sentAt).toLocaleString()}
      </td>
      <td className="space-y-1 py-2 text-right">
        <Can method={AccessService.method.revokeInvitation}>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Withdraw ${invitation.email}`}
            aria-describedby={revoke.isError ? id : undefined}
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ email: invitation.email })}
          >
            Withdraw
          </Button>
          <FormError id={id} error={revoke.error} />
        </Can>
      </td>
    </tr>
  );
}
