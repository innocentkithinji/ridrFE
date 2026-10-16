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
