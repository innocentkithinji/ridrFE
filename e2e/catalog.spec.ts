import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAs } from "./users";

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const devToken = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

// ingestUnknownMetric sends one Measurement of a Metric Ridr has never
// seen, as an Adapter would, so Ridr registers it as unreviewed.
async function ingestUnknownMetric(request: APIRequestContext, name: string) {
  const registered = await request.post(`${api}/ridr.v1.AdapterService/RegisterAdapter`, {
    headers: { Authorization: `Bearer ${devToken}` },
    data: { name: `e2e-catalog-${name}` },
  });
  expect(registered.ok()).toBe(true);
  const ingestKey: string = (await registered.json()).ingestKey.plaintext;
  const ingested = await request.post(`${api}/ridr.v1.IngestService/Ingest`, {
    headers: { Authorization: `Bearer ${ingestKey}` },
    data: {
      measurements: [
        { deviceId: "e2e-catalog", metric: name, value: 1, deviceTime: new Date().toISOString() },
      ],
    },
  });
  expect(ingested.ok()).toBe(true);
}

test("the Catalog lists built-in Metrics with their Quantity kind", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Catalog" })
    .click();
  await expect(page).toHaveURL(/\/settings\/catalog$/);

  const metrics = page.getByRole("table", { name: "Metrics" });
  const speed = metrics.getByRole("row", { name: /^speed\b/ });
  await expect(speed).toContainText("speed");
  await expect(speed).toContainText("Built in");
});

test("built-in Metrics come before the Organisation's", async ({ page }) => {
  await page.goto("/settings/catalog");
  const sources = page
    .getByRole("table", { name: "Metrics" })
    .getByRole("row")
    .filter({ hasText: /Built in|Custom/ })
    .getByRole("cell", { name: /^(Built in|Custom)$/ });
  await expect(sources.first()).toHaveText("Built in");
  const all = await sources.allTextContents();
  expect(all.indexOf("Custom")).toBeGreaterThan(all.lastIndexOf("Built in"));
});

test("Units are grouped by Quantity kind with their aliases", async ({ page }) => {
  await page.goto("/settings/catalog");
  const speed = page.getByRole("region", { name: "speed" });
  const mph = speed.getByRole("listitem").filter({ hasText: "[mi_i]/h" });
  await expect(mph).toContainText("mph");
  await expect(page.getByRole("region", { name: "temperature" })).toContainText("Cel");
});

test("an admin adds a custom Metric and sees it listed", async ({ page }) => {
  const name = `e2e_metric_${Date.now()}`;
  await page.goto("/settings/catalog");
  const form = page.getByRole("form", { name: "Add a Metric" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Quantity kind").selectOption("speed");
  await form.getByRole("button", { name: "Add Metric" }).click();

  const row = page.getByRole("table", { name: "Metrics" }).getByRole("row", { name: name });
  await expect(row).toContainText("speed");
  await expect(row).toContainText("Custom");
  await expect(form.getByLabel("Name")).toHaveValue("");
});

test("defining a name already in the Catalog shows why beside the form", async ({ page }) => {
  await page.goto("/settings/catalog");
  const form = page.getByRole("form", { name: "Add a Metric" });
  await form.getByLabel("Name").fill("speed");
  await form.getByLabel("Quantity kind").selectOption("speed");
  await form.getByRole("button", { name: "Add Metric" }).click();

  await expect(form.getByRole("alert")).toContainText("already exists");
  await expect(form.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
});

test("an admin reviews an unreviewed Metric by choosing its Quantity kind", async ({
  page,
  request,
}) => {
  const name = `e2e_unreviewed_${Date.now()}`;
  await ingestUnknownMetric(request, name);
  await page.goto("/settings/catalog");

  const row = page.getByRole("table", { name: "Metrics" }).getByRole("row", { name: name });
  await expect(row).toContainText("Needs review");
  await row.getByRole("button", { name: "Choose kind" }).click();
  await row.getByLabel(`Quantity kind of ${name}`).selectOption("distance");
  await row.getByRole("button", { name: "Save" }).click();

  await expect(row).toContainText("distance");
  await expect(row).not.toContainText("Needs review");
});

test("an editor, who can't define Metrics, sees the Catalog read-only", async ({ page }) => {
  await signInAs(page, "editor");
  await page.goto("/settings/catalog");

  await expect(page.getByRole("table", { name: "Metrics" })).toContainText("speed");
  await expect(page.getByRole("form", { name: "Add a Metric" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose kind" })).toHaveCount(0);
});
