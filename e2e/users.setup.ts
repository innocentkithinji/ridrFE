import { request } from "@playwright/test";
import { api, adminToken, users } from "./users";

type Member = { userId: string; email: string; role: string; scope?: { conditions?: unknown[] } };

// Global setup: the dev admin makes each dev user (users.ts) a member with
// its Role and Scope. Safe to re-run: a user already a member has its Role
// and Scope put back if a test or another run changed them.
export default async function setupUsers() {
  const context = await request.newContext();
  const call = async <T>(method: string, body: object, token = adminToken): Promise<T> => {
    const response = await context.post(`${api}/ridr.v1.${method}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    });
    if (!response.ok()) throw new Error(`${method}: ${response.status()} ${await response.text()}`);
    return (await response.json()) as T;
  };

  const { members = [] } = await call<{ members?: Member[] }>("AccessService/ListMembers", {});
  for (const user of Object.values(users)) {
    const member = members.find((m) => m.email === user.email);
    if (!member) {
      await call("AccessService/InviteUser", { email: user.email, role: user.role, scope: user.scope });
      // The first call signed in as the user accepts the invitation.
      await call("AccessService/GetMe", {}, user.token);
      continue;
    }
    if (member.role !== user.role) {
      await call("AccessService/SetMemberRole", { userId: member.userId, role: user.role });
    }
    if (JSON.stringify(member.scope?.conditions ?? []) !== JSON.stringify(user.scope.conditions)) {
      await call("AccessService/SetMemberScope", { userId: member.userId, scope: user.scope });
    }
  }
  await context.dispose();
}
