import { expect, test } from "@playwright/test";

// Runs against the demo data (`make demo` in ../Ridr): its trains carry
// the Controlled keys fleet and mode.

test("lists Assets by name with their Attributes", async ({ page }) => {
  await page.goto("/assets");
  // Only Assets in view are drawn, so narrow the list to the one wanted.
  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("Train 27");
  const assets = page.getByRole("list", { name: "Assets" });
  const train = assets.getByRole("listitem").filter({ hasText: "Train 27 Helsinki–Rovaniemi" });
  await expect(train).toContainText("fleet=fintraffic");
  await expect(train).toContainText("mode=train");
});

test("the Fleet nav links to Assets", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Assets" })
    .click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
});

test("filters Assets by name or Attribute in the browser", async ({ page }) => {
  await page.goto("/assets");
  const assets = page.getByRole("list", { name: "Assets" });
  await expect(assets.getByRole("link", { name: "Demo medicine fridge 1" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("mode=train");
  await expect(assets.getByRole("link", { name: "Train 27 Helsinki–Rovaniemi" })).toBeVisible();
  await expect(assets.getByRole("link", { name: /Demo medicine fridge/ })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("medicine FRIDGE 1");
  await expect(assets.getByRole("link", { name: "Demo medicine fridge 1" })).toBeVisible();
  await expect(assets.getByRole("link", { name: "Train 27 Helsinki–Rovaniemi" })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("no such asset anywhere");
  await expect(page.getByText("No Assets match")).toBeVisible();
});

test("sorts Assets by name either way", async ({ page }) => {
  await page.goto("/assets");
  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("Demo medicine fridge");
  const names = page.getByRole("list", { name: "Assets" }).getByRole("link");
  await expect(names).toHaveText(["Demo medicine fridge 1", "Demo medicine fridge 2"]);
  await page.getByRole("combobox", { name: "Sort" }).selectOption("Name, Z to A");
  await expect(names).toHaveText(["Demo medicine fridge 2", "Demo medicine fridge 1"]);
});

test("an editor creates an Asset, picking a Controlled key's value", async ({ page }) => {
  const name = `Test asset ${Date.now()}`;
  await page.goto("/assets");
  await page.getByRole("button", { name: "Create Asset" }).click();
  const form = page.getByRole("dialog", { name: "Create Asset" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);

  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 1" }).fill("fleet");
  const fleet = form.getByRole("combobox", { name: "Value 1" });
  await expect(fleet.getByRole("option")).toHaveText(["Choose a value", "fintraffic", "hsl"]);
  await fleet.selectOption("hsl");

  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 2" }).fill("colour");
  await form.getByRole("textbox", { name: "Value 2" }).fill("red");

  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();

  await page.getByRole("searchbox", { name: "Filter Assets" }).fill(name);
  const created = page
    .getByRole("list", { name: "Assets" })
    .getByRole("listitem")
    .filter({ hasText: name });
  await expect(created).toContainText("colour=red");
  await expect(created).toContainText("fleet=hsl");
});

test("a taken name shows AlreadyExists beside the name field", async ({ page }) => {
  await page.goto("/assets");
  await page.getByRole("button", { name: "Create Asset" }).click();
  const form = page.getByRole("dialog", { name: "Create Asset" });
  const nameField = form.getByRole("textbox", { name: "Name" });
  await nameField.fill("Demo infusion pump 1");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(nameField).toHaveAccessibleDescription("another asset has this name");
  await expect(form).toBeVisible();
});

test("a free key is checked before saving", async ({ page }) => {
  await page.goto("/assets");
  await page.getByRole("button", { name: "Create Asset" }).click();
  const form = page.getByRole("dialog", { name: "Create Asset" });
  await form.getByRole("textbox", { name: "Name" }).fill(`Test asset ${Date.now()}`);
  await form.getByRole("button", { name: "Add Attribute" }).click();
  const key = form.getByRole("combobox", { name: "Key 1" });
  await key.fill("has space");
  await expect(key).toHaveAccessibleDescription("Use only letters, digits, _ or -.");

  await key.fill("site");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form.getByRole("textbox", { name: "Value 1" })).toHaveAccessibleDescription(
    "Give a value.",
  );
  await expect(form).toBeVisible();
});

test("an editor renames an Asset and replaces its Attributes", async ({ page }) => {
  const stamp = Date.now();
  const name = `Test asset ${stamp}`;
  const renamed = `Test asset ${stamp} renamed`;
  await page.goto("/assets");
  await page.getByRole("button", { name: "Create Asset" }).click();
  const createForm = page.getByRole("dialog", { name: "Create Asset" });
  await createForm.getByRole("textbox", { name: "Name" }).fill(name);
  await createForm.getByRole("button", { name: "Add Attribute" }).click();
  await createForm.getByRole("combobox", { name: "Key 1" }).fill("colour");
  await createForm.getByRole("textbox", { name: "Value 1" }).fill("red");
  await createForm.getByRole("button", { name: "Create" }).click();
  await expect(createForm).toBeHidden();

  await page.getByRole("searchbox", { name: "Filter Assets" }).fill(`Test asset ${stamp}`);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const editForm = page.getByRole("dialog", { name: `Edit ${name}` });
  await expect(editForm.getByRole("textbox", { name: "Value 1" })).toHaveValue("red");
  await editForm.getByRole("textbox", { name: "Name" }).fill(renamed);
  await editForm.getByRole("button", { name: "Remove Attribute 1" }).click();
  await editForm.getByRole("button", { name: "Add Attribute" }).click();
  await editForm.getByRole("combobox", { name: "Key 1" }).fill("mode");
  await editForm.getByRole("combobox", { name: "Value 1" }).selectOption("tram");
  await editForm.getByRole("button", { name: "Save" }).click();
  await expect(editForm).toBeHidden();

  const assets = page.getByRole("list", { name: "Assets" });
  await expect(assets.getByRole("link", { name, exact: true })).toHaveCount(0);
  const row = assets.getByRole("listitem").filter({ hasText: renamed });
  await expect(row).toContainText("mode=tram");
  await expect(row).not.toContainText("colour=red");
});

test("draws only the Assets in view, so large fleets stay quick", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.goto("/assets");
  const count = page.getByText(/^\d+ Assets$/);
  await expect(count).toBeVisible();
  const total = Number((await count.textContent())?.split(" ")[0]);
  const rows = page.getByRole("list", { name: "Assets" }).locator(":scope > li");
  await expect(rows.first()).toBeVisible();
  expect(total).toBeGreaterThan(await rows.count());

  // The last Asset by name is drawn once the list scrolls to the end.
  const sort = page.getByRole("combobox", { name: "Sort" });
  await sort.selectOption("Name, Z to A");
  const lastName = (await rows.first().getByRole("link").textContent()) ?? "";
  await sort.selectOption("Name, A to Z");
  const last = page.getByRole("link", { name: lastName, exact: true });
  await expect(last).toHaveCount(0);
  await page
    .getByRole("list", { name: "Assets" })
    .locator("..")
    .evaluate((scroller) => scroller.scrollTo(0, scroller.scrollHeight));
  await expect(last).toBeVisible();
});
