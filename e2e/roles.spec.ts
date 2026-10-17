import { callAs, expect, test, users, type UserName } from "./users";
import type { Page } from "@playwright/test";

// What each Role and Scope sees and may do on every screen built so far,
// signed in as the stack's dev users (e2e/users.ts): a viewer, an editor,
// and an editor scoped to fleet=hsl. Screens built later add their Role
// cases here.

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

async function signedIn(page: Page, user: UserName) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toContainText(users[user].email);
}

async function expectNoAccess(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("alert")).toContainText("No access");
}

test.describe("a viewer", () => {
  test.use({ user: "viewer" });

  test("has no admin links, and typed admin routes are denied", async ({ page }) => {
    await signedIn(page, "viewer");
    await expect(nav(page).getByRole("link", { name: "Assets" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Team" })).toHaveCount(0);
    await expect(nav(page).getByRole("link", { name: "Audit log" })).toHaveCount(0);
    for (const path of ["/settings/team", "/settings/audit-log", "/settings/data-sources/new"]) {
      await expectNoAccess(page, path);
    }
  });

  test("sees Assets without create or edit", async ({ page }) => {
    await page.goto("/assets");
    await page.getByRole("searchbox", { name: "Filter Assets" }).fill("Demo medicine fridge 1");
    const fridge = page.getByRole("link", { name: "Demo medicine fridge 1" });
    await expect(fridge).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Asset" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);

    await fridge.click();
    await expect(page.getByRole("heading", { name: "Demo medicine fridge 1" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Devices" })).toContainText("fridge-1");
    await expect(page.getByRole("region", { name: "Devices" }).getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  });

  test("sees Silences and Contact groups without changing them", async ({ page }) => {
    await page.goto("/silences");
    await expect(page.getByRole("heading", { name: "Silences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Silence" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "End early" })).toHaveCount(0);

    await page.goto("/settings/contact-groups");
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toHaveCount(0);
    await expect(page.getByRole("article").getByRole("button")).toHaveCount(0);
  });

  test("sees the Catalog and Controlled keys read-only", async ({ page }) => {
    await page.goto("/settings/catalog");
    await expect(page.getByRole("table", { name: "Metrics" })).toContainText("speed");
    await expect(page.getByRole("form", { name: "Add a Metric" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose kind" })).toHaveCount(0);

    await page.goto("/settings/controlled-keys");
    const mode = page.getByRole("region", { name: "mode" });
    await expect(mode.getByRole("listitem").filter({ hasText: "tram" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Declare a Controlled key" })).toHaveCount(0);
    await expect(mode.getByRole("button")).toHaveCount(0);
  });
});

test.describe("an editor", () => {
  test.use({ user: "editor" });

  test("has no Team or Audit log, and typing them is denied", async ({ page }) => {
    await signedIn(page, "editor");
    await expect(nav(page).getByRole("link", { name: "Silences" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Team" })).toHaveCount(0);
    await expect(nav(page).getByRole("link", { name: "Audit log" })).toHaveCount(0);
    for (const path of ["/settings/team", "/settings/audit-log", "/settings/data-sources/new"]) {
      await expectNoAccess(page, path);
    }
  });

  test("creates and edits an Asset", async ({ page }) => {
    const name = `Editor asset ${Date.now()}`;
    await page.goto("/assets");
    await page.getByRole("button", { name: "Create Asset" }).click();
    const form = page.getByRole("dialog", { name: "Create Asset" });
    await form.getByRole("textbox", { name: "Name" }).fill(name);
    await form.getByRole("button", { name: "Create" }).click();
    await expect(form).toBeHidden();

    await page.getByRole("searchbox", { name: "Filter Assets" }).fill(name);
    await page.getByRole("button", { name: `Edit ${name}` }).click();
    const edit = page.getByRole("dialog", { name: `Edit ${name}` });
    await edit.getByRole("button", { name: "Add Attribute" }).click();
    await edit.getByRole("combobox", { name: "Key 1" }).fill("colour");
    await edit.getByRole("textbox", { name: "Value 1" }).fill("green");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();
    await expect(
      page.getByRole("list", { name: "Assets" }).getByRole("listitem").filter({ hasText: name }),
    ).toContainText("colour=green");
  });

  test("creates a Silence", async ({ page }) => {
    const stamp = String(Date.now());
    await page.goto("/silences");
    await page.getByRole("button", { name: "Create Silence" }).click();
    const form = page.getByRole("dialog", { name: "Create Silence" });
    // A key no Asset holds, so the Silence holds back nothing real.
    await form.getByRole("button", { name: "Add Attribute" }).click();
    await form.getByRole("combobox", { name: "Key 1" }).fill("e2e_silence");
    await form.getByRole("textbox", { name: "Value 1" }).fill(stamp);
    await form.getByLabel("Ends").fill(localInput(new Date(Date.now() + 3_600_000)));
    await form.getByLabel("Comment").fill(`Editor silence ${stamp}`);
    await form.getByRole("button", { name: "Create" }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole("listitem").filter({ hasText: `Editor silence ${stamp}` })).toContainText(
      "by dev-editor",
    );
  });
});

test.describe("a scoped user", () => {
  test.use({ user: "scoped" });

  test("sees only the Assets in their Scope, with the scope note", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.getByText("You see Assets in your Scope only.")).toBeVisible();
    const filter = page.getByRole("searchbox", { name: "Filter Assets" });
    // Every Asset listed holds fleet=hsl: the filter keeps them all.
    await filter.fill("fleet=hsl");
    await expect(page.getByText(/^\d+ Assets$/)).toBeVisible();
    await filter.fill("fleet=fintraffic");
    await expect(page.getByText("No Assets match")).toBeVisible();
  });

  test("an Asset outside their Scope reads as not found", async ({ page, request }) => {
    const { assets } = await callAs<{ assets: { id: string; name: string }[] }>(
      request,
      "RegistryService/ListAssets",
      {},
    );
    const train = assets.find((a) => a.name === "Train 27 Helsinki–Rovaniemi")!;
    await page.goto(`/assets/${train.id}`);
    await expect(page.getByRole("heading", { name: "Asset not found" })).toBeVisible();
  });

  test("has no Unclaimed devices route", async ({ page }) => {
    await signedIn(page, "scoped");
    await expect(nav(page).getByRole("link", { name: "Assets" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Unclaimed devices" })).toHaveCount(0);
    await page.goto("/devices/unclaimed");
    const denied = page.getByRole("alert");
    await expect(denied).toContainText("No access");
    await expect(denied).toContainText("Your Scope doesn't let you see Unclaimed devices");
  });

  test("saving an Asset outside their Scope shows the server's message", async ({ page }) => {
    await page.goto("/assets");
    await page.getByRole("button", { name: "Create Asset" }).click();
    const form = page.getByRole("dialog", { name: "Create Asset" });
    await form.getByRole("textbox", { name: "Name" }).fill(`Out of scope ${Date.now()}`);
    await form.getByRole("button", { name: "Add Attribute" }).click();
    await form.getByRole("combobox", { name: "Key 1" }).fill("fleet");
    await form.getByRole("combobox", { name: "Value 1" }).selectOption("fintraffic");
    await form.getByRole("button", { name: "Create" }).click();
    await expect(form.getByRole("alert")).toHaveText("asset would be outside your scope");
    await expect(form).toBeVisible();
  });

  test("sees the scope note on Alerts, Explore, Silences and Contact groups", async ({ page }) => {
    const notes = {
      "/alerts": "You see Alerts only for the Assets in your Scope.",
      "/explore": "You see only Readings of Assets in your Scope",
      "/silences": "You see and create Silences within your Scope only.",
      "/settings/contact-groups": "You see only the Contact groups your Rules notify, and can't change them.",
    };
    for (const [path, note] of Object.entries(notes)) {
      await page.goto(path);
      await expect(page.getByText(note)).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Create" })).toHaveCount(0);
  });
});

const pad = (n: number) => String(n).padStart(2, "0");

// localInput writes a time for a datetime-local field, in local time.
function localInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
