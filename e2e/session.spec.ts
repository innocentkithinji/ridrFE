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

test("signing in again starts from an empty cache, so GetMe reloads", async ({ page }) => {
  let getMeCalls = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/ridr.v1.AccessService/GetMe")) getMeCalls += 1;
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toContainText("dev@localhost");
  expect(getMeCalls).toBe(1);

  // Well inside the cache's freshness window: a kept cache would not ask again.
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in with the dev token" }).click();
  await expect(page.getByRole("button", { name: "User menu" })).toContainText("dev@localhost");
  expect(getMeCalls).toBe(2);
});

test("without a Clerk key, Clerk's code is never loaded", async ({ page }) => {
  const clerkRequests: string[] = [];
  page.on("request", (request) => {
    if (/clerk/i.test(request.url())) clerkRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toContainText("dev@localhost");
  expect(clerkRequests).toEqual([]);
});
