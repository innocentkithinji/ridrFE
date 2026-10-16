import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call(request: APIRequestContext, path: string, data: object) {
  const response = await request.post(`${api}/ridr.v1.${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

// Rules on demo Assets raise Alerts in the shared demo data, so every
// Rule a test names with unique() is deleted after it. Other workers'
// Rules are left alone.
let named: string[] = [];

test.afterEach(async ({ request }) => {
  const { rules = [] } = await call(request, "RuleService/ListRules", {});
  for (const rule of rules as { id: string; name: string }[]) {
    if (named.includes(rule.name)) {
      await call(request, "RuleService/DeleteRule", { ruleId: rule.id });
    }
  }
  named = [];
});

function unique(what: string) {
  const name = `e2e ${what} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  named.push(name);
  return name;
}

// openNewRule opens the create form and names the Rule.
async function openNewRule(page: Page, name: string) {
  await page.goto("/rules");
  await page.getByRole("link", { name: "Create" }).first().click();
  await expect(page).toHaveURL(/\/rules\/new$/);
  await page.getByLabel("Name").fill(name);
}

test("the Alerting nav links to Rules", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Rules" }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
});

test("an editor creates a threshold Rule on a demo fridge and sees it listed", async ({ page }) => {
  const name = unique("fridge too hot");
  await openNewRule(page, name);
  await page.getByRole("combobox", { name: "Start from an Asset" }).fill("Demo medicine fridge 1");
  await expect(page.getByRole("list", { name: "Assets this Rule watches" })).toContainText(
    "Demo medicine fridge 1",
  );
  await page.getByRole("radio", { name: "Threshold" }).check();
  await page.getByLabel("Metric").selectOption("temperature");
  await page.getByLabel("Operator").selectOption({ label: "above" });
  // Far above anything a fridge reports, so it never fires.
  await page.getByLabel("Value", { exact: true }).fill("1000");
  await page.getByLabel("Unit").selectOption("Cel");
  await page.getByRole("group", { name: "Contact groups" }).getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Create Rule" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.goto("/rules");
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Threshold");
  await expect(row).toContainText("kind=medicine fridge");
  await expect(row).toContainText("Enabled");
});

// createRuleByApi makes a threshold Rule over a key no Asset holds, so it
// never fires, and returns its ID.
async function createRuleByApi(request: APIRequestContext, name: string, extra: object = {}): Promise<string> {
  const { rule } = await call(request, "RuleService/CreateRule", {
    rule: {
      name,
      selector: { e2e_rule: name.split(" ").at(-1) },
      threshold: { metric: "temperature", operator: "THRESHOLD_OPERATOR_ABOVE", value: 30, unit: "Cel" },
      ...extra,
    },
  });
  return rule.id;
}

test("an editor edits a Rule's condition and repeats", async ({ page, request }) => {
  const name = unique("edit me");
  const ruleId = await createRuleByApi(request, name);
  await page.goto(`/rules/${ruleId}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("temperature above 30 °C")).toBeVisible();
  await expect(page.getByText("Never")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Operator").selectOption({ label: "at or below" });
  await page.getByLabel("Value", { exact: true }).fill("-40");
  await page.getByLabel("Repeat every (minutes)").fill("10");
  await page.getByLabel("Repeat at most (times)").fill("3");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("temperature at or below -40 °C")).toBeVisible();
  await expect(page.getByText("Every 10 minutes, at most 3 times, until acknowledged")).toBeVisible();
});

test("repeats need both an interval and a count", async ({ page, request }) => {
  const ruleId = await createRuleByApi(request, unique("repeats"));
  await page.goto(`/rules/${ruleId}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Repeat every (minutes)").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Set both the interval and the count, or neither.")).toBeVisible();
  await page.getByLabel("Repeat at most (times)").fill("101");
  await expect(page.getByText("A whole number from 0 to 100.")).toBeVisible();
});

test("disabling explains it resolves open Alerts; enabling starts it again", async ({ page, request }) => {
  const name = unique("disable me");
  const ruleId = await createRuleByApi(request, name);
  await page.goto(`/rules/${ruleId}`);
  await page.getByRole("button", { name: "Disable" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("its open Alerts are resolved");
  await dialog.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText(/^Disabled since /)).toBeVisible();

  await page.goto("/rules");
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Disabled since");

  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
});

test("deleting says Alerts are kept and returns to the list", async ({ page, request }) => {
  const name = unique("delete me");
  const ruleId = await createRuleByApi(request, name);
  await page.goto(`/rules/${ruleId}`);
  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Alerts are kept as history");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByRole("link", { name })).toHaveCount(0);

  await page.goto(`/rules/${ruleId}`);
  await expect(page.getByText("This Rule doesn't exist, or isn't yours to see.")).toBeVisible();
});

// geofenceMap is the drawing map in the Rule form, once it has drawn.
async function geofenceMap(page: Page) {
  const map = page.getByRole("figure", { name: "Geofence" });
  await expect(map.locator("canvas")).toBeVisible();
  await expect(map).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  return map;
}

test("an editor draws a geofence on the map and edits it by dragging a corner", async ({ page }) => {
  const name = unique("depot");
  await openNewRule(page, name);
  await page.getByRole("button", { name: "Add Attribute" }).click();
  await page.getByRole("combobox", { name: "Key 1" }).fill("e2e_rule");
  await page.getByRole("textbox", { name: "Value 1" }).fill(name.split(" ").at(-1)!);
  await page.getByRole("radio", { name: "Geofence" }).check();
  const map = await geofenceMap(page);
  const canvas = map.locator("canvas");

  await map.getByRole("button", { name: "Draw area" }).click();
  await canvas.click({ position: { x: 100, y: 100 } });
  await canvas.click({ position: { x: 300, y: 100 } });
  await canvas.click({ position: { x: 200, y: 250 } });
  await map.getByRole("button", { name: "Finish" }).click();
  await expect(map.getByRole("button", { name: /^Corner \d$/ })).toHaveCount(3);

  // Drag the third corner down; its position changes.
  await map.getByText("Edit corners as text").click();
  const corners = map.getByRole("textbox", { name: "Corners" });
  const before = await corners.inputValue();
  await map.getByRole("button", { name: "Corner 3" }).dragTo(canvas, { targetPosition: { x: 200, y: 320 } });
  await expect(corners).not.toHaveValue(before);
  expect((await corners.inputValue()).split("\n")).toHaveLength(3);

  await page.getByLabel("Fires when an Asset").selectOption({ label: "enters the area" });
  await page.getByRole("button", { name: "Create Rule" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("an Asset enters the area (3 corners)")).toBeVisible();
});

test("a geofence crossing ±180° is refused with an explanation", async ({ page }) => {
  await openNewRule(page, unique("antimeridian"));
  await page.getByRole("radio", { name: "Geofence" }).check();
  const map = await geofenceMap(page);
  await map.getByText("Edit corners as text").click();
  await map.getByRole("textbox", { name: "Corners" }).fill("-17, 178\n-18, -178\n-19, 179");
  await expect(map.getByRole("alert")).toContainText("crosses the 180° meridian");
  await page.getByRole("button", { name: "Create Rule" }).click();
  await expect(page).toHaveURL(/\/rules\/new$/);
});
