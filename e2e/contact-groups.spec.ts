import { expect, test } from "@playwright/test";

// The demo data has a "Demo operations" Contact group, with one email
// Contact, that every demo Rule notifies.

test("lists every Contact group with its Contacts and the Rules using it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Contact groups" }).click();
  await expect(page.getByRole("heading", { name: "Contact groups", level: 1 })).toBeVisible();

  const group = page.getByRole("article", { name: "Demo operations" });
  await expect(group).toContainText("Email");
  await expect(group).toContainText("operations@example.com");
  await expect(group.getByRole("link", { name: "HSL tram above 40 km/h" })).toBeVisible();
});

test("an editor creates a group with an email Contact", async ({ page }) => {
  const name = `On-call ${Date.now()}`;
  await page.goto("/settings/contact-groups");
  await page.getByRole("button", { name: "Create" }).click();

  const form = page.getByRole("dialog", { name: "New Contact group" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Add Contact" }).click();
  await form.getByLabel("Channel").selectOption("Email");
  await form.getByLabel("Address").fill("on-call@example.com");
  await form.getByRole("button", { name: "Save" }).click();

  await expect(form).toHaveCount(0);
  const group = page.getByRole("article", { name });
  await expect(group).toContainText("Email");
  await expect(group).toContainText("on-call@example.com");
});
