import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { signInAs } from "./users";

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call(request: APIRequestContext, procedure: string, body: object = {}) {
  const response = await request.post(`${api}/ridr.v1.${procedure}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

// withMe edits the dev user's real GetMe answer, standing in for a user
// with fewer Permissions. A Scope comes from the real scoped user
// (e2e/users.ts).
async function withMe(page: Page, edit: (me: { permissions: string[] }) => void) {
  await page.route("**/ridr.v1.AccessService/GetMe", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    edit(me);
    await route.fulfill({ response, json: me });
  });
}

function without(...procedures: string[]) {
  return (me: { permissions: string[] }) => {
    me.permissions = me.permissions.filter((p) => !procedures.includes(p.replace("ridr.v1.", "")));
  };
}

// Home against the demo data (`make demo` in ../Ridr): HSL buses and
// Fintraffic ships report their Locations every few seconds.

function fleetMap(page: Page) {
  return page.getByRole("figure", { name: "Fleet now" });
}

test("the map shows the demo fleet live and moving", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Fleet map" });
  await expect(map.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();
  await expect(fleetMap(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  // Mark the canvas: a map rebuilt for new data would lose the mark.
  // The base map's canvas; its vehicles are drawn on a second one.
  await fleetMap(page).locator("canvas").first().evaluate((canvas) => canvas.setAttribute("data-first", ""));

  await fleetMap(page).getByText("Show as list").click();
  const positions = fleetMap(page).getByRole("list", { name: "Latest positions" }).getByRole("listitem");
  await expect.poll(() => positions.count()).toBeGreaterThan(1);
  const newest = positions.first().locator("time");
  const before = await newest.getAttribute("datetime");

  await expect.poll(() => newest.getAttribute("datetime"), { timeout: 60_000 }).not.toBe(before);
  await expect(fleetMap(page).locator("canvas[data-first]")).toHaveCount(1);
});

test("open Alerts poll every 15 s and link to their detail", async ({ page, request }) => {
  // The demo fires each Rule only once in 10 minutes, so stand a real
  // Alert in as the open one.
  const { alerts } = await call(request, "AlertService/ListAlerts", {});
  const alert = alerts[0];
  let listed = 0;
  await page.route("**/ridr.v1.AlertService/ListAlerts", async (route) => {
    listed++;
    const response = await route.fetch();
    await route.fulfill({ response, json: { alerts: [{ ...alert, state: "ALERT_STATE_FIRING" }] } });
  });
  await page.goto("/");

  const panel = page.getByRole("region", { name: "Open Alerts" });
  await expect(panel.getByRole("table", { name: "Open Alerts" })).toContainText(alert.ruleName);
  const before = listed;
  await expect.poll(() => listed, { timeout: 25_000, intervals: [1000] }).toBeGreaterThan(before);

  await panel.getByRole("link", { name: alert.asset }).first().click();
  await expect(page).toHaveURL(`/alerts/${alert.id}`);
});

test("a burst of open Alerts shows the newest 10 and links to all of them", async ({ page, request }) => {
  const { alerts } = await call(request, "AlertService/ListAlerts", {});
  const alert = alerts[0];
  const burst = Array.from({ length: 25 }, (_, i) => ({
    ...alert,
    id: `${alert.id.slice(0, -2)}${String(i).padStart(2, "0")}`,
    ruleName: `Burst ${String(i).padStart(2, "0")}`,
    state: "ALERT_STATE_FIRING",
  }));
  await page.route("**/ridr.v1.AlertService/ListAlerts", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { alerts: burst } });
  });
  await page.goto("/");

  const panel = page.getByRole("region", { name: "Open Alerts" });
  const rows = panel.getByRole("table", { name: "Open Alerts" }).getByRole("row");
  // A header row and the 10 newest, which Ridr lists first.
  await expect(rows).toHaveCount(11);
  await expect(rows.nth(1)).toContainText("Burst 00");
  await expect(panel).not.toContainText("Burst 10");
  await panel.getByRole("link", { name: "View all 25 open Alerts" }).click();
  await expect(page).toHaveURL("/alerts");
});

test("Device health shows live, silent and Unclaimed devices", async ({ page, request }) => {
  const { devices } = await call(request, "RegistryService/ListUnclaimedDevices");
  const unclaimed = devices[0];
  await page.goto("/");

  const health = page.getByRole("region", { name: "Device health" });
  const live = health.getByRole("group", { name: "Live" });
  await expect.poll(async () => Number(await live.getByRole("definition").textContent())).toBeGreaterThan(0);
  await expect(health.getByRole("group", { name: "Unclaimed" }).getByRole("definition")).toHaveText(String(devices.length));
  await expect(
    health.getByRole("list", { name: "Unclaimed devices" }).getByRole("listitem").filter({ hasText: unclaimed.deviceId }),
  ).toContainText(/Silent|Live|Never seen/);

  // The demo has more Assets than Home checks on its own; the user asks.
  await health.getByRole("button", { name: /Check \d+ Assets for silent Devices/ }).click();
  const silent = health.getByRole("list", { name: "Silent devices" }).getByRole("listitem");
  await expect.poll(() => silent.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(health.getByRole("group", { name: "Silent" }).getByRole("definition")).not.toHaveText("—");

  // GetDeviceHealth, asked on hover, gives the exact last seen.
  await silent.first().hover();
  await expect(silent.first()).toContainText(/last seen|Never seen|Live/);
});

test("the data credit shows while demo bridges bring in open data", async ({ page }) => {
  await page.goto("/");
  const credit = page.getByRole("complementary", { name: "Data credit" });
  await expect(credit).toContainText("Digitransit");
  await expect(credit).toContainText("digitraffic.fi");
});

const panels = ["Fleet map", "Open Alerts", "Device health"] as const;

// Each Permission taken away, and the panels that go with it. Device
// health counts live Devices with a RunQuery rollup, so it needs RunQuery
// as well as its Registry procedures.
const cases = [
  { lacks: "QueryService/RunQuery", hidden: ["Fleet map", "Device health"] },
  { lacks: "AlertService/ListAlerts", hidden: ["Open Alerts"] },
  { lacks: "RegistryService/GetDeviceHealth", hidden: ["Device health"] },
  { lacks: "RegistryService/ListAssets", hidden: ["Device health"] },
];

for (const { lacks, hidden } of cases) {
  test(`without ${lacks} Home hides ${hidden.join(" and ")} and shows the rest`, async ({ page }) => {
    await withMe(page, without(lacks));
    await page.goto("/");
    for (const panel of panels.filter((p) => !hidden.includes(p))) {
      await expect(page.getByRole("region", { name: panel })).toBeVisible();
    }
    for (const panel of hidden) {
      await expect(page.getByRole("region", { name: panel })).toHaveCount(0);
    }
  });
}

test("without ListMqttBridges Home shows no data credit", async ({ page }) => {
  await withMe(page, without("ConnectorService/ListMqttBridges"));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Device health" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Data credit" })).toHaveCount(0);
});

test("a scoped user sees a Scope note on each panel and no Unclaimed devices", async ({ page }) => {
  await signInAs(page, "scoped");
  await page.goto("/");
  for (const panel of panels) {
    await expect(page.getByRole("region", { name: panel })).toBeVisible();
  }
  await expect(page.getByText("You see Assets in your Scope only.")).toHaveCount(3);
  const health = page.getByRole("region", { name: "Device health" });
  await expect(health.getByRole("group", { name: "Live" })).toBeVisible();
  await expect(health.getByRole("group", { name: "Unclaimed" })).toHaveCount(0);
});
