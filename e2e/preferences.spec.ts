import { expect, test, type Page } from "@playwright/test";

// Unit preferences (/settings/preferences), kept in this browser for the
// signed-in user, against the demo data: the demo simulator keeps
// "Demo medicine fridge 1" reporting temperature in °C.

function kindRow(page: Page, kind: string) {
  return page.getByRole("group", { name: kind });
}

async function prefer(page: Page, kind: string, unit: string) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Preferences" }).click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await kindRow(page, kind).getByRole("radio", { name: unit }).check();
}

test("the preferences screen lists each Quantity kind with its Units, and a choice survives reloads", async ({ page }) => {
  await prefer(page, "temperature", "°F");

  const temperature = kindRow(page, "temperature");
  await expect(temperature.getByRole("radio", { name: "°C" })).toBeVisible();
  await expect(temperature.getByRole("radio", { name: "Original Unit" })).not.toBeChecked();
  await expect(kindRow(page, "speed").getByRole("radio", { name: "mph" })).toBeVisible();
  await expect(kindRow(page, "speed").getByRole("radio", { name: "Original Unit" })).toBeChecked();

  await page.reload();
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "°F" })).toBeChecked();

  await kindRow(page, "temperature").getByRole("radio", { name: "Original Unit" }).check();
  await page.reload();
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "Original Unit" })).toBeChecked();
});

test("with temperature in °F, a demo fridge's chart the app writes shows °F", async ({ page }) => {
  await prefer(page, "temperature", "°F");
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "°F" })).toBeChecked();

  await page.goto("/dev/live-query");
  const chart = page.getByRole("figure", { name: "Live query chart" });
  await chart.getByText("Show as table").click();
  await expect(chart.getByRole("cell", { name: /°F$/ }).first()).toBeVisible();
  await expect(chart.getByRole("cell", { name: /°C$/ })).toHaveCount(0);
});

test("Explore starts on the preferred Unit, and leaves typed Queries as written", async ({ page }) => {
  await prefer(page, "temperature", "°F");
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "°F" })).toBeChecked();

  await page.goto("/explore");
  const editor = page.getByRole("textbox", { name: "Query" });
  await expect(editor).toContainText("| unit [degF]");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByLabel("Unit")).toHaveValue("[degF]");

  const typed =
    'measurements | where asset == "Demo medicine fridge 1" and metric == temperature | range last 15m';
  await page.goto(`/explore?view=table&q=${encodeURIComponent(typed)}`);
  const table = page.getByRole("table", { name: "Query answer" });
  await expect(table.getByRole("cell", { name: /°C$/ }).first()).toBeVisible();
  await expect(editor).not.toContainText("unit");
});

test("when browser storage fails, values show in Ridr's Units and the screen says why", async ({ page }) => {
  await page.addInitScript(() => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith("ridr.unitPreferences")) throw new DOMException("blocked", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("ridr.unitPreferences")) throw new DOMException("full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/settings/preferences");
  const temperature = kindRow(page, "temperature");
  await temperature.getByRole("radio", { name: "°F" }).click();
  await expect(temperature.getByRole("alert")).toContainText("wouldn't save your Unit preference");
  await expect(temperature.getByRole("radio", { name: "Original Unit" })).toBeChecked();

  await page.goto("/explore");
  await expect(page.getByRole("textbox", { name: "Query" })).toContainText("rollup avg, max every 5m by asset");
  await expect(page.getByRole("textbox", { name: "Query" })).not.toContainText("| unit");
});
