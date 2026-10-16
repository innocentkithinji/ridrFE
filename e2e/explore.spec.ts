import { expect, test, type Page } from "@playwright/test";

// Explore (/explore) against the demo data: the demo simulator keeps
// "Demo medicine fridge 1" reporting temperature.

const fridgeQuery =
  'measurements | where asset == "Demo medicine fridge 1" and metric == temperature | range last 15m';

function editor(page: Page) {
  return page.getByRole("textbox", { name: "Query" });
}

async function run(page: Page, text: string) {
  await editor(page).fill(text);
  await page.getByRole("button", { name: "Run" }).click();
}

test("a Query runs on submit and draws its Measurements as a chart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Explore" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(editor(page)).toContainText("measurements");

  await run(page, fridgeQuery);

  await expect(page).toHaveURL(/[?&]q=/);
  const chart = page.getByRole("figure", { name: "Query answer chart" });
  await expect(chart.getByText("fridge-1 · temperature").first()).toBeVisible();

  const understood = page.getByRole("region", { name: "How Ridr read it" });
  await expect(understood).toContainText("metric is temperature");
  await expect(understood).toContainText("last 15m");
});

test("a broken Query is marked inline at the reported spot, with the message", async ({ page }) => {
  await page.goto("/explore");
  await run(page, fridgeQuery);
  await expect(page.getByRole("figure", { name: "Query answer chart" })).toBeVisible();

  await run(page, "measurements\n| wher metric == temperature");

  await expect(page.getByRole("alert")).toContainText('Line 2, column 3: unknown stage "wher"');
  await expect(page.locator(".cm-lintRange-error")).toHaveText("wher");
});

test("the editor highlights sources, operators, keywords, durations and strings", async ({ page }) => {
  await page.goto(`/explore?q=${encodeURIComponent(fridgeQuery)}`);
  const code = editor(page);
  await expect(code.locator(".tok-typeName")).toHaveText("measurements");
  await expect(code.locator(".tok-keyword").first()).toHaveText("where");
  await expect(code.locator(".tok-operator").first()).toHaveText("|");
  await expect(code.locator(".tok-number")).toHaveText("15m");
  await expect(code.locator(".tok-string")).toHaveText('"Demo medicine fridge 1"');
});

test("the same answer shows as a table with Units, and the URL restores both", async ({ page }) => {
  await page.goto(`/explore?q=${encodeURIComponent(fridgeQuery)}`);
  await expect(page.getByRole("figure", { name: "Query answer chart" })).toBeVisible();

  await page.getByRole("tab", { name: "Table" }).click();
  const table = page.getByRole("table", { name: "Query answer" });
  await expect(table.getByRole("cell", { name: /°C$/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/view=table/);

  await page.reload();
  await expect(editor(page)).toContainText("Demo medicine fridge 1");
  await expect(page.getByRole("table", { name: "Query answer" })).toBeVisible();
});

test("the unit picker converts values", async ({ page }) => {
  await page.goto(`/explore?view=table&q=${encodeURIComponent(fridgeQuery)}`);
  await expect(page.getByRole("table", { name: "Query answer" })).toBeVisible();

  await page.getByLabel("Unit").selectOption("[degF]");

  await expect(editor(page)).toContainText("| unit [degF]");
  const table = page.getByRole("table", { name: "Query answer" });
  await expect(table.getByRole("cell", { name: /°F$/ }).first()).toBeVisible();
  await expect(table.getByRole("cell", { name: /°C$/ })).toHaveCount(0);
});

test("a Query without a rollup ending now streams new Readings", async ({ page }) => {
  await page.goto(`/explore?view=table&q=${encodeURIComponent(fridgeQuery)}`);
  await expect(page.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();

  const rows = page.getByRole("table", { name: "Query answer" }).getByRole("row");
  await expect(rows.nth(1)).toBeVisible();
  const before = await rows.count();
  await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeGreaterThan(before);
});

test("a rollup ending now reruns every bucket", async ({ page }) => {
  const text = `${fridgeQuery} | rollup avg every 5s`;
  let runs = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/ridr.v1.QueryService/RunQuery")) runs++;
  });
  await page.goto(`/explore?q=${encodeURIComponent(text)}`);
  await expect(page.getByRole("status").filter({ hasText: "Refreshing every 5s" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Query answer chart" })).toBeVisible();

  const first = runs;
  await expect.poll(() => runs, { timeout: 15_000 }).toBeGreaterThan(first);
});

test("a too costly Query shows the server's reason and suggests a shorter range", async ({ page }) => {
  await page.goto("/explore");
  await run(page, "measurements | range last 60d");

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("above the limit of 31d");
  await expect(alert).toContainText("shorter range");
});
