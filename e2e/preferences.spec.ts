import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Unit preferences (/settings/preferences), kept by Ridr's
// PreferenceService, against the demo data: the demo simulator keeps
// "Demo medicine fridge 1" reporting temperature in °C.
//
// Preferences belong to a user, and other test files run as the dev
// admin in parallel, so these tests act as the dev viewer
// (viewer@localhost): its preferences change nothing they look at. They
// run one at a time because they share that user, each starting with no
// preferences.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const adminToken = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";
const viewerToken = "dev-viewer-token";

const fridgeQuery =
  'measurements | where asset == "Demo medicine fridge 1" and metric == temperature | range last 15m';

test.describe.configure({ mode: "serial" });

async function call(request: APIRequestContext, path: string, data: object, token: string) {
  return request.post(`${api}/ridr.v1.${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

// The viewer joins the dev Organisation on its first call after being
// invited; an invitation it already has is fine.
test.beforeAll(async ({ request }) => {
  await call(request, "AccessService/InviteUser", { email: "viewer@localhost", role: "ROLE_VIEWER" }, adminToken);
  const me = await call(request, "AccessService/GetMe", {}, viewerToken);
  expect(me.ok(), await me.text()).toBe(true);
});

test.beforeEach(async ({ page, request }) => {
  const listed = await call(request, "PreferenceService/ListUnitPreferences", {}, viewerToken);
  const { unitPreferences = [] } = (await listed.json()) as { unitPreferences?: { quantityKind: string }[] };
  for (const { quantityKind } of unitPreferences) {
    await call(request, "PreferenceService/ClearUnitPreference", { quantityKind }, viewerToken);
  }
  // Every call to Ridr goes as the viewer.
  await page.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${viewerToken}` } }),
  );
});

function kindRow(page: Page, kind: string) {
  return page.getByRole("group", { name: kind });
}

async function openPreferences(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Preferences" }).click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
}

async function prefer(page: Page, kind: string, unit: string) {
  await openPreferences(page);
  await kindRow(page, kind).getByRole("radio", { name: unit }).check();
  await expect(kindRow(page, kind).getByRole("radio", { name: unit })).toBeChecked();
}

async function assetIdOf(request: APIRequestContext, name: string): Promise<string> {
  const response = await call(request, "RegistryService/ListAssets", {}, adminToken);
  const { assets } = (await response.json()) as { assets: { id: string; name: string }[] };
  const asset = assets.find((one) => one.name === name);
  if (!asset) throw new Error(`no Asset named ${name}`);
  return asset.id;
}

test("the preferences screen lists each Quantity kind with its Units, and Ridr keeps the choice", async ({
  page,
  request,
}) => {
  await prefer(page, "temperature", "°F");

  const temperature = kindRow(page, "temperature");
  await expect(temperature.getByRole("radio", { name: "°C" })).toBeVisible();
  await expect(temperature.getByRole("radio", { name: "Original Unit" })).not.toBeChecked();
  await expect(kindRow(page, "speed").getByRole("radio", { name: "mph" })).toBeVisible();
  await expect(kindRow(page, "speed").getByRole("radio", { name: "Original Unit" })).toBeChecked();

  // Kept by Ridr, not this browser: another device sees it.
  await expect
    .poll(async () => (await call(request, "PreferenceService/ListUnitPreferences", {}, viewerToken)).json())
    .toEqual({ unitPreferences: [{ quantityKind: "temperature", unit: "[degF]" }] });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "°F" })).toBeChecked();

  await kindRow(page, "temperature").getByRole("radio", { name: "Original Unit" }).check();
  await page.reload();
  await expect(kindRow(page, "temperature").getByRole("radio", { name: "Original Unit" })).toBeChecked();
});

test("with temperature in °F, a demo fridge's Asset detail chart shows °F", async ({ page, request }) => {
  await prefer(page, "temperature", "°F");

  await page.goto(`/assets/${await assetIdOf(request, "Demo medicine fridge 1")}`);
  const chart = page
    .getByRole("region", { name: "Readings" })
    .getByRole("figure", { name: "Demo medicine fridge 1, last hour" });
  await chart.getByText("Show as table").click();
  await expect(chart.getByRole("cell", { name: /°F$/ }).first()).toBeVisible();
  await expect(chart.getByRole("cell", { name: /°C$/ })).toHaveCount(0);
});

test("with temperature in °F, the live-query dev chart the app writes shows °F", async ({ page }) => {
  await prefer(page, "temperature", "°F");

  await page.goto("/dev/live-query");
  const chart = page.getByRole("figure", { name: "Live query chart" });
  await chart.getByText("Show as table").click();
  await expect(chart.getByRole("cell", { name: /°F$/ }).first()).toBeVisible();
  await expect(chart.getByRole("cell", { name: /°C$/ })).toHaveCount(0);
});

test("Explore starts on the preferred Unit, and leaves typed Queries as written", async ({ page }) => {
  await prefer(page, "temperature", "°F");

  await page.goto("/explore");
  const editor = page.getByRole("textbox", { name: "Query" });
  await expect(editor).toContainText("| unit [degF]");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByLabel("Unit")).toHaveValue("[degF]");

  await page.goto(`/explore?view=table&q=${encodeURIComponent(fridgeQuery)}`);
  const table = page.getByRole("table", { name: "Query answer" });
  await expect(table.getByRole("cell", { name: /°C$/ }).first()).toBeVisible();
  await expect(editor).not.toContainText("unit");
});

test("a failed save says so beside the row and keeps Ridr's Units", async ({ page }) => {
  await page.route(`${api}/ridr.v1.PreferenceService/SetUnitPreference`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "internal", message: "boom" }),
    }),
  );

  await openPreferences(page);
  const temperature = kindRow(page, "temperature");
  await temperature.getByRole("radio", { name: "°F" }).click();
  await expect(temperature.getByRole("alert")).toContainText("Something went wrong. Try again.");
  await expect(temperature.getByRole("radio", { name: "Original Unit" })).toBeChecked();
});

test("when the preferences can't be read, Queries the app writes use Ridr's Units", async ({ page }) => {
  await prefer(page, "temperature", "°F");
  await page.route(`${api}/ridr.v1.PreferenceService/ListUnitPreferences`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ code: "permission_denied", message: "no" }),
    }),
  );

  await page.goto("/explore");
  const editor = page.getByRole("textbox", { name: "Query" });
  await expect(editor).toContainText("rollup avg, max every 5m by asset");
  await expect(editor).not.toContainText("| unit");
});
