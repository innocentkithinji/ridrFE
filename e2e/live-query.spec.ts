import { expect, test, type Page } from "@playwright/test";

// The dev-only Live query route (src/app/routes/live-query-dev.tsx)
// charts any Measurement Query live, against the demo simulator.

const demoQuery =
  'measurements | where asset == "Demo medicine fridge 1" and metric == temperature | range last 15m';

function open(page: Page, text: string) {
  return page.goto(`/dev/live-query?text=${encodeURIComponent(text)}`);
}

async function readingCount(page: Page): Promise<number> {
  const text = await page.getByTestId("reading-count").textContent();
  return Number(text?.match(/\d+/)?.[0] ?? NaN);
}

test("a live Measurement Query draws its history, then grows without reload", async ({ page }) => {
  await open(page, demoQuery);
  const chart = page.getByRole("figure", { name: "Live query chart" });
  await expect(chart).toBeVisible();
  await expect(chart.getByText("fridge-1 · temperature").first()).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  const history = await readingCount(page);
  expect(history).toBeGreaterThan(1);
  await expect.poll(() => readingCount(page), { timeout: 30_000 }).toBeGreaterThan(history);
});

// closed resolves when the browser drops a Live query it had open.
function closed(page: Page) {
  return page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().includes("/v1/live-query"),
    timeout: 10_000,
  });
}

test("leaving the route closes the stream", async ({ page }) => {
  await open(page, demoQuery);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  const stream = closed(page);
  // No link leads off this dev route, so go to Home as the router would.
  await page.evaluate(() => {
    history.pushState(null, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await stream;
  await expect(page.getByRole("figure", { name: "Live query chart" })).toHaveCount(0);
});

test("a Session change closes every stream", async ({ page }) => {
  await open(page, demoQuery);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  const stream = closed(page);
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await stream;
});
