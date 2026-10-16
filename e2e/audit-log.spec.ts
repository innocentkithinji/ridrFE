import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAs } from "./users";

// Each test makes its own audited changes through the API, by inviting
// and un-inviting a user with a unique email, then reads them back in
// the Audit log.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call(request: APIRequestContext, method: string, body: object) {
  const response = await request.post(`${api}/ridr.v1.AccessService/${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
}

// invite invites a new email, recording "member.invited", and revokes
// the invitation again, recording "invitation.revoked".
async function invite(request: APIRequestContext, label: string) {
  const email = `audit-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await call(request, "InviteUser", { email, role: "ROLE_VIEWER" });
  await call(request, "RevokeInvitation", { email });
  return email;
}

test("lists changes made earlier with who, what and when, newest first", async ({
  page,
  request,
}) => {
  const email = await invite(request, "list");

  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();

  const rows = page.getByRole("row").filter({ hasText: email });
  await expect(rows).toHaveCount(2);
  // Newest first: the revocation came after the invitation.
  await expect(rows.nth(0)).toContainText("invitation.revoked");
  await expect(rows.nth(1)).toContainText("member.invited");
  await expect(rows.nth(1)).toContainText("dev@localhost");
  await expect(rows.nth(1)).toContainText("role");
  await expect(rows.nth(1).getByRole("cell").first()).toHaveText(/\d{4}/);
});

test("filters by action and target, kept in the URL", async ({ page, request }) => {
  const email = await invite(request, "filter");

  await page.goto("/settings/audit-log");
  await page.getByLabel("Action").fill("member.invited");
  await page.getByLabel("Target").fill(email);
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/action=member\.invited/);
  const rows = page.getByRole("row").filter({ hasText: email });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("member.invited");

  await page.reload();
  await expect(page.getByLabel("Target")).toHaveValue(email);
  await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(1);
});

test("says when no changes match the filters", async ({ page }) => {
  await page.goto(`/settings/audit-log?target=nobody-${Date.now()}`);
  await expect(page.getByText("No changes match these filters.")).toBeVisible();
});

test("Older reaches entries before the oldest shown", async ({ page, request }) => {
  const email = await invite(request, "older");
  const rows = page.getByRole("row").filter({ hasText: email });

  // One entry a page, so the revocation hides the invitation before it.
  await page.goto(`/settings/audit-log?target=${encodeURIComponent(email)}&limit=1`);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("invitation.revoked");

  await page.getByRole("button", { name: "Older" }).click();
  await expect(page).toHaveURL(/to=/);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("member.invited");
});

test("hidden from an editor, who lacks the Permission", async ({ page }) => {
  await signInAs(page, "editor");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);

  await page.goto("/settings/audit-log");
  await expect(page.getByRole("alert")).toContainText("No access");
  await expect(page.getByRole("heading", { name: "Audit log" })).toHaveCount(0);
});
