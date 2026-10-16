import { expect, test } from "@playwright/test";

// Run against the built app served the way Cloudflare serves it with
// `npm run test:e2e:worker`; under the dev server it passes trivially.

test("a deep link loads the app instead of a server 404", async ({ page }) => {
  const response = await page.goto(`/assets/deep-link-${Date.now()}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
});
