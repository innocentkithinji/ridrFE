import { expect, test } from "@playwright/test";

test("shows the Organisation and who is signed in", async ({ page }) => {
  await page.goto("/");
  const userMenu = page.getByRole("button", { name: "User menu" });
  await expect(userMenu).toContainText("Dev tenant");
  await expect(userMenu).toContainText("dev@localhost");
});
