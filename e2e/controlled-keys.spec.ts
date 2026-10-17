import { expect, test, type Page } from "@playwright/test";

// The demo data declares the Controlled key "mode" with values such as
// "bus" and "tram"; the dev user is a whole-Organisation admin.

test("lists every Controlled key with its allowed values", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Controlled keys" })
    .click();
  await expect(page).toHaveURL(/\/settings\/controlled-keys$/);
  const mode = page.getByRole("region", { name: "mode" });
  await expect(mode.getByRole("listitem").filter({ hasText: "bus" })).toBeVisible();
  await expect(mode.getByRole("listitem").filter({ hasText: "tram" })).toBeVisible();
});

test("shows how many Assets hold each value", async ({ page }) => {
  await page.goto("/settings/controlled-keys");
  const mode = page.getByRole("region", { name: "mode" });
  // Demo Assets include ships; other tests may add more, never fewer.
  await expect(mode.getByRole("listitem").filter({ hasText: "ship" })).toContainText(
    /[1-9]\d* Assets?/,
  );
});

test("an admin declares a Controlled key with its values", async ({ page }) => {
  const key = `e2e_declare_${Date.now()}`;
  await page.goto("/settings/controlled-keys");
  const form = page.getByRole("form", { name: "Declare a Controlled key" });
  await form.getByLabel("Key").fill(key);
  await form.getByLabel("Allowed values").fill("North, south");
  await form.getByRole("button", { name: "Declare" }).click();
  const declared = page.getByRole("region", { name: key });
  await expect(declared.getByRole("listitem").filter({ hasText: "North" })).toContainText("0 Assets");
  await expect(declared.getByRole("listitem").filter({ hasText: "south" })).toBeVisible();
  await expect(form.getByLabel("Key")).toHaveValue("");
});

test("a refused declare shows the server's reason beside the form", async ({ page }) => {
  await page.goto("/settings/controlled-keys");
  const form = page.getByRole("form", { name: "Declare a Controlled key" });
  await form.getByLabel("Key").fill("not a key!");
  await form.getByLabel("Allowed values").fill("x");
  await form.getByRole("button", { name: "Declare" }).click();
  await expect(form.getByRole("alert")).toContainText(/key/i);
  await expect(form.getByLabel("Key")).toHaveValue("not a key!");
});

// declareKey declares a fresh Controlled key through the page and
// returns its card.
async function declareKey(page: Page, prefix: string, values: string) {
  const key = `${prefix}_${Date.now()}`;
  await page.goto("/settings/controlled-keys");
  const form = page.getByRole("form", { name: "Declare a Controlled key" });
  await form.getByLabel("Key").fill(key);
  await form.getByLabel("Allowed values").fill(values);
  await form.getByRole("button", { name: "Declare" }).click();
  const card = page.getByRole("region", { name: key });
  await expect(card).toBeVisible();
  return card;
}

test("an admin adds values to a Controlled key", async ({ page }) => {
  const card = await declareKey(page, "e2e_add", "first");
  await card.getByLabel("Add values").fill("second, Third");
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.getByRole("listitem").filter({ hasText: "second" })).toBeVisible();
  await expect(card.getByRole("listitem").filter({ hasText: "Third" })).toBeVisible();
  await expect(card.getByLabel("Add values")).toHaveValue("");
});

test("an admin removes a value no Asset holds", async ({ page }) => {
  const card = await declareKey(page, "e2e_remove", "keep, drop");
  await card.getByRole("button", { name: "Remove drop" }).click();
  await expect(card.getByRole("listitem").filter({ hasText: "drop" })).toHaveCount(0);
  await expect(card.getByRole("listitem").filter({ hasText: "keep" })).toBeVisible();
});

test("a refused remove shows the server's reason on the key", async ({ page }) => {
  const card = await declareKey(page, "e2e_last", "only");
  await card.getByRole("button", { name: "Remove only" }).click();
  await expect(card.getByRole("alert")).toContainText(/value/i);
  await expect(card.getByRole("listitem").filter({ hasText: "only" })).toBeVisible();
});
