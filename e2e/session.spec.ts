import { expect, test } from "@playwright/test";

test("signing out leaves the app until the user signs in again", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByText("Signed out.")).toBeVisible();
  await expect(page.getByRole("button", { name: "User menu" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign in with the dev token" }).click();
  await expect(page.getByRole("button", { name: "User menu" })).toContainText("dev@localhost");
});
