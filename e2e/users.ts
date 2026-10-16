import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

// The local stack's dev users (Ridr's RIDR_DEV_EXTRA_USERS). The dev admin
// invites each with the Role and Scope below in global setup (users.setup.ts),
// and a test signs in as one with `test.use({ user: "viewer" })`.

export const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
export const adminToken = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

type Scope = { conditions: { key: string; values: string[] }[] };

const wholeOrganisation: Scope = { conditions: [] };

export const users: Record<
  "viewer" | "editor" | "scoped",
  { email: string; token: string; role: string; scope: Scope }
> = {
  viewer: { email: "viewer@localhost", token: "dev-viewer-token", role: "ROLE_VIEWER", scope: wholeOrganisation },
  editor: { email: "editor@localhost", token: "dev-editor-token", role: "ROLE_EDITOR", scope: wholeOrganisation },
  // An editor who sees only the demo's HSL fleet: its trams and buses, not
  // Fintraffic's trains.
  scoped: {
    email: "scoped@localhost",
    token: "dev-scoped-token",
    role: "ROLE_EDITOR",
    scope: { conditions: [{ key: "fleet", values: ["hsl"] }] },
  },
};

export type UserName = keyof typeof users;

// signInAs makes every Ridr call from the page carry the user's dev token
// instead of the admin's one the dev Session sends. Nothing in the app
// changes, so production builds have no way to pick a user.
export async function signInAs(page: Page, user: UserName) {
  const authorization = `Bearer ${users[user].token}`;
  await page.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), authorization } }),
  );
}

// signInAsAdmin undoes signInAs: the page's calls go out as the dev admin.
export async function signInAsAdmin(page: Page) {
  await page.unroute(`${api}/**`);
}

// test is Playwright's test with a `user` option: unset, the page is the
// dev admin's; set, it is that dev user's.
export const test = base.extend<{ user: UserName | undefined }>({
  user: [undefined, { option: true }],
  page: async ({ page, user }, provide) => {
    if (user) await signInAs(page, user);
    await provide(page);
  },
});

export { expect };

// callAs calls a Ridr procedure ("Service/Method") as a user, the dev admin
// by default, and returns its answer.
export async function callAs<T>(
  request: APIRequestContext,
  method: string,
  body: object,
  token = adminToken,
): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}
