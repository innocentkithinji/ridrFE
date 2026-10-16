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
// Rule a test makes (named "e2e … <stamp>") is deleted afterwards.
test.afterEach(async ({ request }) => {
  const { rules = [] } = await call(request, "RuleService/ListRules", {});
  for (const rule of rules as { id: string; name: string }[]) {
    if (rule.name.startsWith("e2e ")) {
      await call(request, "RuleService/DeleteRule", { ruleId: rule.id });
    }
  }
});

function unique(what: string) {
  return `e2e ${what} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
