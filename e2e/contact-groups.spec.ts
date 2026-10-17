import { expect, test, type Page } from "@playwright/test";

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

test("each Contact's address is checked for its Channel, with the error beside it", async ({ page }) => {
  await page.goto("/settings/contact-groups");
  await page.getByRole("button", { name: "Create" }).click();
  const form = page.getByRole("dialog", { name: "New Contact group" });
  await form.getByLabel("Name").fill(`Bad addresses ${Date.now()}`);
  await form.getByRole("button", { name: "Add Contact" }).click();

  const address = form.getByLabel("Address");
  await form.getByLabel("Channel").selectOption("Email");
  await address.fill("not-an-email");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(address).toHaveAccessibleDescription(/email address/);

  await form.getByLabel("Channel").selectOption("Webhook");
  await address.fill("http://example.com/hook");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(address).toHaveAccessibleDescription(/https URL/);

  await form.getByLabel("Channel").selectOption("SMS");
  await address.fill("0712345678");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(address).toHaveAccessibleDescription(/country code/);
  await expect(form).toBeVisible();
});

test("a taken name is shown beside the name", async ({ page }) => {
  await page.goto("/settings/contact-groups");
  await page.getByRole("button", { name: "Create" }).click();
  const form = page.getByRole("dialog", { name: "New Contact group" });
  await form.getByLabel("Name").fill("Demo operations");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByLabel("Name")).toHaveAccessibleDescription(/already exists/);
});

async function createGroup(page: Page, name: string, email: string) {
  await page.goto("/settings/contact-groups");
  await page.getByRole("button", { name: "Create" }).click();
  const form = page.getByRole("dialog", { name: "New Contact group" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Add Contact" }).click();
  await form.getByLabel("Channel").selectOption("Email");
  await form.getByLabel("Address").fill(email);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toHaveCount(0);
  return page.getByRole("article", { name });
}

test("an editor renames a group and adds a Contact", async ({ page }) => {
  const stamp = Date.now();
  let group = await createGroup(page, `Night shift ${stamp}`, "night@example.com");
  await group.getByRole("button", { name: /^Edit/ }).click();

  const form = page.getByRole("dialog", { name: `Edit Night shift ${stamp}` });
  await expect(form.getByLabel("Address")).toHaveValue("night@example.com");
  await form.getByLabel("Name").fill(`Late shift ${stamp}`);
  await form.getByRole("button", { name: "Add Contact" }).click();
  const second = form.getByRole("group", { name: "Contact 2" });
  await second.getByLabel("Channel").selectOption("WhatsApp");
  await second.getByLabel("Address").fill("+254712345678");
  await form.getByRole("button", { name: "Save" }).click();

  await expect(form).toHaveCount(0);
  group = page.getByRole("article", { name: `Late shift ${stamp}` });
  await expect(group).toContainText("night@example.com");
  await expect(group).toContainText("WhatsApp");
  await expect(group).toContainText("+254712345678");
});

test("deleting a group asks first", async ({ page }) => {
  const name = `Temporary ${Date.now()}`;
  const group = await createGroup(page, name, "temp@example.com");

  await group.getByRole("button", { name: /^Delete/ }).click();
  const confirm = page.getByRole("alertdialog", { name: `Delete ${name}?` });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(group).toBeVisible();

  await group.getByRole("button", { name: /^Delete/ }).click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(group).toHaveCount(0);
});

test("deleting a group a Rule notifies shows which Rules to change", async ({ page }) => {
  await page.goto("/settings/contact-groups");
  const group = page.getByRole("article", { name: "Demo operations" });
  await group.getByRole("button", { name: /^Delete/ }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Demo operations?" });
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(confirm.getByRole("alert")).toContainText("a rule still notifies this contact group");
  await expect(confirm.getByRole("link", { name: "HSL tram above 40 km/h" })).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(group).toBeVisible();
});

test("a new webhook's signing secret is shown once, and rotating issues another", async ({ page }) => {
  const stamp = Date.now();
  const name = `Webhooks ${stamp}`;
  const url = `https://hooks.example.com/ridr-${stamp}`;
  await page.goto("/settings/contact-groups");
  await page.getByRole("button", { name: "Create" }).click();
  const form = page.getByRole("dialog", { name: "New Contact group" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Add Contact" }).click();
  await form.getByLabel("Channel").selectOption("Webhook");
  await form.getByLabel("Address").fill(url);
  await form.getByRole("button", { name: "Save" }).click();

  const issued = page.getByRole("dialog", { name: "Webhook signing secret" });
  await expect(issued).toContainText("it won't be shown again");
  // Ridr signs with the secret, so it keeps it, unlike an Ingest key.
  await expect(issued).not.toContainText("hash");
  // Only "Done" closes it, so the secret can't be lost by a stray key.
  await page.keyboard.press("Escape");
  await expect(issued).toBeVisible();
  await expect(issued.getByRole("button", { name: `Copy Signing secret for ${url}` })).toBeVisible();
  const secret = issued.getByLabel(`Signing secret for ${url}`, { exact: true });
  const first = (await secret.textContent()) ?? "";
  expect(first).not.toBe("");
  await issued.getByRole("button", { name: "Done" }).click();
  await expect(issued).toHaveCount(0);

  const group = page.getByRole("article", { name });
  await expect(group).toContainText(url);
  await expect(page.getByText(first)).toHaveCount(0);

  await group.getByRole("button", { name: `Rotate secret for ${url}` }).click();
  await page.getByRole("alertdialog", { name: "Rotate this webhook's secret?" })
    .getByRole("button", { name: "Rotate" }).click();
  await expect(secret).toBeVisible();
  await expect(secret).not.toHaveText(first);
  await issued.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByRole("article", { name })).toContainText(url);
  await expect(page.getByText(first)).toHaveCount(0);
});
