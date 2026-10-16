import { expect, test, type Page } from "@playwright/test";

async function background(page: Page) {
  return page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
}

test("the theme follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  const light = await background(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).not.toBe(light);
});

test("the toggle overrides the system theme and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const dark = await background(page);

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await background(page)).not.toBe(dark);

  await page.reload();
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
