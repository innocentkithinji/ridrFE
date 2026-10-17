import { expect, test } from "@playwright/test";

// The dev user (dev@localhost) is the Organisation's only member, a
// whole-Organisation admin. The demo data declares the Controlled key
// "mode" with values such as "bus" and "tram".

test("lists members with the signed-in user marked and not actionable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/settings\/team$/);
  const members = page.getByRole("region", { name: "Members" });
  const me = members.getByRole("row").filter({ hasText: "dev@localhost" });
  await expect(me).toContainText("you");
  await expect(me).toContainText("Admin");
  await expect(me).toContainText("Whole Organisation");
  await expect(me.getByRole("combobox")).toHaveCount(0);
  await expect(me.getByRole("button")).toHaveCount(0);
});

test("an admin invites someone with a Role and Scope, then withdraws it", async ({ page }) => {
  const email = `e2e-invite-${Date.now()}@example.com`;
  await page.goto("/settings/team");
  const form = page.getByRole("form", { name: "Invite someone" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Role").selectOption("Editor");
  const scope = form.getByRole("group", { name: "Scope" });
  await expect(scope).toContainText("Whole Organisation");
  await scope.getByLabel("Controlled key").selectOption("mode");
  await scope.getByRole("button", { name: "Add condition" }).click();
  const mode = scope.getByRole("group", { name: "mode" });
  await mode.getByLabel("bus").check();
  await mode.getByLabel("tram").check();
  await form.getByRole("button", { name: "Invite" }).click();
  await expect(form.getByLabel("Email")).toHaveValue("");

  const invitations = page.getByRole("region", { name: "Invitations" });
  const row = invitations.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Editor");
  await expect(row).toContainText("mode: bus, tram");
  await expect(row).toContainText(/\d/); // when sent

  await row.getByRole("button", { name: `Withdraw ${email}` }).click();
  await expect(row).toHaveCount(0);
});

test("a refused invite shows the server's reason beside the form", async ({ page }) => {
  const email = `e2e-refused-${Date.now()}@example.com`;
  await page.goto("/settings/team");
  const form = page.getByRole("form", { name: "Invite someone" });
  await form.getByLabel("Email").fill(email);
  const scope = form.getByRole("group", { name: "Scope" });
  await scope.getByLabel("Controlled key").selectOption("mode");
  await scope.getByRole("button", { name: "Add condition" }).click();
  await form.getByRole("button", { name: "Invite" }).click();
  await expect(form.getByRole("alert")).toContainText("mode");
  await expect(form.getByLabel("Email")).toHaveValue(email);
  await expect(
    page.getByRole("region", { name: "Invitations" }).getByRole("row").filter({ hasText: email }),
  ).toHaveCount(0);
});

test("removing a key from the Scope leaves the whole Organisation", async ({ page }) => {
  await page.goto("/settings/team");
  const scope = page.getByRole("form", { name: "Invite someone" }).getByRole("group", { name: "Scope" });
  await scope.getByLabel("Controlled key").selectOption("mode");
  await scope.getByRole("button", { name: "Add condition" }).click();
  await expect(scope.getByRole("group", { name: "mode" })).toBeVisible();
  await expect(scope).not.toContainText("Whole Organisation");
  await scope.getByRole("button", { name: "Remove mode from the Scope" }).click();
  await expect(scope.getByRole("group", { name: "mode" })).toHaveCount(0);
  await expect(scope).toContainText("Whole Organisation");
});

test("explains what each Role can do without leaving the app", async ({ page }) => {
  await page.goto("/settings/team");
  await expect(page.getByRole("link", { name: "What each Role can do" })).toHaveCount(0);
  await page.getByText("What each Role can do").click();
  const roles = page.getByRole("region", { name: "What each Role can do" });
  await expect(roles.getByRole("term")).toHaveText(["Viewer", "Editor", "Admin", "With a Scope"]);
  await expect(roles.getByRole("definition").nth(0)).toContainText("changes nothing");
  await expect(roles.getByRole("definition").nth(1)).toContainText("acknowledge and resolve Alerts");
  await expect(roles.getByRole("definition").nth(2)).toContainText("Audit log");
});
