import { expect, test } from "@playwright/test";

// The dev server mounts a route gated by a Permission nobody has
// (src/app/routes/test-only.tsx), standing in for any route whose
// Permission the user lacks.

test("a route whose Permission the user lacks has no nav link", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Gated test route" })).toHaveCount(0);
});

test("opening that route shows the permission-denied state", async ({ page }) => {
  await page.goto("/test-only/gated");
  await expect(page.getByRole("alert")).toContainText("No access");
  await expect(page.getByText("You should never see this.")).toHaveCount(0);
});
