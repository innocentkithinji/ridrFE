import { Role } from "@ridr/web";
import { useId, useState, type FormEvent } from "react";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInviteUser } from "@/features/team/api/change-team";
import { RolePicker } from "@/features/team/components/role-picker";
import { ScopeEditor, type ScopeConditions } from "@/features/team/components/scope-editor";

// InviteForm invites a person by email. They get the Role and Scope on
// first sign-in; inviting the same email again resends the invitation.
export function InviteForm() {
  const id = useId();
  const invite = useInviteUser();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.VIEWER);
  const [scope, setScope] = useState<ScopeConditions>([]);

  function submit(event: FormEvent) {
    event.preventDefault();
    invite.mutate(
      { email: email.trim(), role, scope: { conditions: scope } },
      {
        onSuccess: () => {
          setEmail("");
          setRole(Role.VIEWER);
          setScope([]);
        },
      },
    );
  }

  const errorId = `${id}-error`;
  return (
    <form
      aria-labelledby={`${id}-title`}
      onSubmit={submit}
      className="space-y-3 rounded-lg border p-4"
    >
      <h2 id={`${id}-title`} className="font-semibold">
        Invite someone
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 space-y-1 text-sm">
          <span>Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ana@example.com"
            aria-invalid={invite.isError || undefined}
            aria-describedby={invite.isError ? errorId : undefined}
          />
        </label>
        <RolePicker value={role} onChange={setRole} label="Role" />
      </div>
      <ScopeEditor value={scope} onChange={setScope} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={invite.isPending}>
          Invite
        </Button>
        <FormError id={errorId} error={invite.error} />
      </div>
    </form>
  );
}
