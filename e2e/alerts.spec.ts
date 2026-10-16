import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

// The demo fires each Rule once per 10-minute cycle, so a test waiting
// for a firing Alert may wait that long.
const cycleMs = 11 * 60_000;

type ApiAlert = { id: string; ruleName: string; state: string };

async function listAlerts(request: APIRequestContext, body: object): Promise<ApiAlert[]> {
  const response = await request.post(`${api}/ridr.v1.AlertService/ListAlerts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).alerts ?? [];
}

// firingAlert waits until an Alert of ruleName (any Rule when empty) is
// firing, and returns it.
async function firingAlert(request: APIRequestContext, ruleName = ""): Promise<ApiAlert> {
  let found: ApiAlert | undefined;
  await expect
    .poll(
      async () => {
        const alerts = await listAlerts(request, { states: ["ALERT_STATE_FIRING"] });
        found = alerts.find((a) => !ruleName || a.ruleName === ruleName);
        return found !== undefined;
      },
      { timeout: cycleMs, intervals: [1000] },
    )
    .toBe(true);
  return found!;
}

// withoutPermissions takes Permissions out of the dev user's real GetMe
// answer, standing in for a viewer or a user with fewer rights: the local
// stack has only one user, a whole-Organisation admin.
async function withoutPermissions(page: Page, ...methods: string[]) {
  await page.route("**/ridr.v1.AccessService/GetMe", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    me.permissions = me.permissions.filter(
      (p: string) => !methods.includes(p.replace("ridr.v1.", "")),
    );
    await route.fulfill({ response, json: me });
  });
}

// The State definition comes first in the detail's facts.
function stateOf(page: Page) {
  return page.getByRole("definition").first();
}

// Runs against the demo data (`make demo` in ../Ridr): the simulator makes
// every demo Rule fire and resolve once in each 10-minute cycle, so the
// demo always has resolved Alerts and, now and then, a firing one.

test("the Monitor nav links to the Alerts inbox, which toggles to all Alerts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Alerts" }).click();
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  const filter = page.getByRole("group", { name: "Alert filter" });
  await expect(filter.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");

  await filter.getByRole("button", { name: "All" }).click();
  const alerts = page.getByRole("table", { name: "Alerts" });
  const fridge = alerts
    .getByRole("row")
    .filter({ hasText: "Demo medicine fridge above 8 °C" })
    .filter({ hasText: "Resolved" })
    .first();
  await expect(fridge).toBeVisible();
  await expect(fridge).toContainText("Demo medicine fridge 2");
});

test("an Alert's detail shows its state, value, times and Deliveries", async ({ page }) => {
  await page.goto("/alerts");
  await page.getByRole("group", { name: "Alert filter" }).getByRole("button", { name: "All" }).click();
  await page
    .getByRole("table", { name: "Alerts" })
    .getByRole("row")
    .filter({ hasText: "Demo medicine fridge above 8 °C" })
    .filter({ hasText: "Resolved" })
    .first()
    .getByRole("link", { name: "Demo medicine fridge 2" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Demo medicine fridge above 8 °C: Demo medicine fridge 2" }),
  ).toBeVisible();
  const facts = page.getByRole("definition");
  await expect(page.getByText("State", { exact: true })).toBeVisible();
  await expect(facts.filter({ hasText: "Resolved" }).first()).toBeVisible();
  await expect(facts.filter({ hasText: /\d °C$/ })).toBeVisible();

  const deliveries = page.getByRole("table", { name: "Deliveries" });
  const email = deliveries.getByRole("row").filter({ hasText: "operations@example.com" }).first();
  await expect(email).toContainText(/Delivered|Pending|Retrying|Failed/);
});

test("an Alert outside the newest 1000 reads as not found", async ({ page }) => {
  await page.goto("/alerts/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("This Alert doesn't exist, or isn't yours to see.")).toBeVisible();
});

test("an Alert's detail streams its Asset's live Readings", async ({ page }) => {
  await page.goto("/alerts");
  await page.getByRole("group", { name: "Alert filter" }).getByRole("button", { name: "All" }).click();
  await page
    .getByRole("table", { name: "Alerts" })
    .getByRole("row")
    .filter({ hasText: "Demo medicine fridge above 8 °C" })
    .first()
    .getByRole("link", { name: "Demo medicine fridge 2" })
    .click();

  const chart = page.getByRole("figure", { name: "Live Readings, last hour" });
  await expect(chart).toBeVisible();
  await expect(chart.getByText("fridge-2 · temperature").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
});

test("without the list Permission there is no nav link and both paths are denied", async ({
  page,
}) => {
  await withoutPermissions(page, "AlertService/ListAlerts");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Alerts" })).toHaveCount(0);

  for (const path of ["/alerts", "/alerts/00000000-0000-0000-0000-000000000000"]) {
    await page.goto(path);
    await expect(page.getByRole("alert")).toContainText("No access");
  }
});

test("an editor acknowledges the demo fridge Alert, then sees it resolve", async ({
  page,
  request,
}) => {
  test.setTimeout(cycleMs + 3 * 60_000);
  const alert = await firingAlert(request, "Demo medicine fridge above 8 °C");

  await page.goto(`/alerts/${alert.id}`);
  await expect(stateOf(page)).toContainText("Firing");
  await stateOf(page).getByRole("button", { name: "Acknowledge" }).click();
  await expect(stateOf(page)).toContainText("Acknowledged");
  await expect(stateOf(page).getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
  await expect(page.getByRole("definition").nth(3)).toContainText("by ");

  // The fridge cools down and the Rule resolves the Alert; the detail
  // polls every 15 s.
  await expect(stateOf(page)).toContainText("Resolved", { timeout: 3 * 60_000 });
  await expect(stateOf(page).getByRole("button")).toHaveCount(0);
});

test("an editor resolves a firing Alert by hand from the inbox", async ({ page, request }) => {
  test.setTimeout(cycleMs + 60_000);
  const alert = await firingAlert(request, "Demo infusion pump battery below 20%");

  await page.goto("/alerts");
  const row = page.getByRole("table", { name: "Alerts" }).getByRole("row").filter({
    has: page.locator(`a[href="/alerts/${alert.id}"]`),
  });
  await row.getByRole("button", { name: "Resolve" }).click();
  // Resolved Alerts leave the open inbox, and show as resolved in All.
  await expect(row).toHaveCount(0);
  await page.getByRole("group", { name: "Alert filter" }).getByRole("button", { name: "All" }).click();
  await expect(row).toContainText("Resolved");
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("without the editor Permissions open Alerts show no actions", async ({ page, request }) => {
  test.setTimeout(cycleMs + 60_000);
  await withoutPermissions(page, "AlertService/AcknowledgeAlert", "AlertService/ResolveAlert");
  const alert = await firingAlert(request);

  await page.goto(`/alerts/${alert.id}`);
  await expect(stateOf(page)).toContainText(/Firing|Acknowledged/);
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resolve" })).toHaveCount(0);

  await page.goto("/alerts");
  await expect(page.getByRole("table", { name: "Alerts" }).getByRole("row")).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: /Acknowledge|Resolve/ })).toHaveCount(0);
});
