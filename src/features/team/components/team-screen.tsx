import { AccessService } from "@ridr/web";
import { InvitationsList } from "@/features/team/components/invitations-list";
import { InviteForm } from "@/features/team/components/invite-form";
import { MembersList } from "@/features/team/components/members-list";
import { Can, useIsScoped } from "@/lib/me";

// TeamScreen is where admins see who belongs to the Organisation, invite
// people and change what each may do and see.
export function TeamScreen() {
  const scoped = useIsScoped();
  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        {scoped && (
          <p className="text-muted-foreground text-sm">You see people within your Scope only</p>
        )}
      </div>
      <MembersList />
      <Can method={AccessService.method.listInvitations}>
        <InvitationsList />
      </Can>
      <Can method={AccessService.method.inviteUser}>
        <InviteForm />
      </Can>
    </section>
  );
}
