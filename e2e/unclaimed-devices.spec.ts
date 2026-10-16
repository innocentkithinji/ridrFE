import { expect, test, type Page } from "@playwright/test";

// Runs against the local stack. A Device becomes Unclaimed on its first
// Reading, so each test sends one from a new Device ID through the dev
// Agent Adapter ("Dev adapter", ingest key dev-ingest-key).
const ridrUrl = process.env.RIDR_URL ?? "http://localhost:18095";

async function sendReading(deviceId: string, value: number) {
  const response = await fetch(`${ridrUrl}/ridr.v1.IngestService/Ingest`, {
    method: "POST",
    headers: { Authorization: "Bearer dev-ingest-key", "Content-Type": "application/json" },
    body: JSON.stringify({
      measurements: [
        {
          deviceId,
          metric: "temperature",
          value,
          unit: "Cel",
          deviceTime: new Date().toISOString(),
        },
      ],
    }),
  });
  expect(response.ok, await response.text()).toBe(true);
}

function newDeviceId() {
  return `e2e-device-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function deviceRow(page: Page, deviceId: string) {
  return page
    .getByRole("list", { name: "Unclaimed devices" })
    .getByRole("listitem")
    .filter({
      has: page.getByText(deviceId, { exact: true }),
    });
}

test("a new Device appears with its Adapter, health and latest Reading", async ({ page }) => {
  const deviceId = newDeviceId();
  await sendReading(deviceId, 4.5);
  await page.goto("/devices/unclaimed");
  const row = deviceRow(page, deviceId);
  await expect(row).toContainText("Dev adapter");
  await expect(row).toContainText("Live");
  await expect(row).toContainText("temperature 4.5 Cel");
});

test("claiming a Device as a new Asset moves it there", async ({ page }) => {
  const deviceId = newDeviceId();
  const assetName = `Claimed asset ${Date.now()}`;
  await sendReading(deviceId, 6);
  await page.goto("/devices/unclaimed");
  await deviceRow(page, deviceId)
    .getByRole("button", { name: `Claim ${deviceId}` })
    .click();

  const form = page.getByRole("dialog", { name: `Claim ${deviceId}` });
  await form.getByRole("textbox", { name: "Name" }).fill(assetName);
  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 1" }).fill("colour");
  await form.getByRole("textbox", { name: "Value 1" }).fill("blue");
  await form.getByRole("button", { name: "Create and assign" }).click();
  await expect(form).toBeHidden();
  await expect(deviceRow(page, deviceId)).toHaveCount(0);

  await page.goto("/assets");
  await page.getByRole("searchbox", { name: "Filter Assets" }).fill(assetName);
  const created = page.getByRole("list", { name: "Assets" }).getByRole("listitem").filter({
    hasText: assetName,
  });
  await expect(created).toContainText("colour=blue");
});

test("assigning a Device to an existing Asset from a past start removes it", async ({ page }) => {
  const deviceId = newDeviceId();
  await sendReading(deviceId, 7);
  await page.goto("/devices/unclaimed");
  await deviceRow(page, deviceId)
    .getByRole("button", { name: `Claim ${deviceId}` })
    .click();

  const form = page.getByRole("dialog", { name: `Claim ${deviceId}` });
  await form.getByRole("tab", { name: "Existing Asset" }).click();
  await form.getByRole("combobox", { name: "Asset" }).selectOption("Demo medicine fridge 1");
  const hourAgo = new Date(Date.now() - 3_600_000 - new Date().getTimezoneOffset() * 60_000);
  await form.getByLabel("Starts at (optional)").fill(hourAgo.toISOString().slice(0, 16));
  await form.getByRole("button", { name: "Assign" }).click();
  await expect(form).toBeHidden();
  await expect(deviceRow(page, deviceId)).toHaveCount(0);
});

test("a start time in the future is refused beside the field", async ({ page }) => {
  const deviceId = newDeviceId();
  await sendReading(deviceId, 8);
  await page.goto("/devices/unclaimed");
  await deviceRow(page, deviceId)
    .getByRole("button", { name: `Claim ${deviceId}` })
    .click();
  const form = page.getByRole("dialog", { name: `Claim ${deviceId}` });
  await form.getByRole("tab", { name: "Existing Asset" }).click();
  await form.getByRole("combobox", { name: "Asset" }).selectOption("Demo medicine fridge 1");
  await form.getByLabel("Starts at (optional)").fill("2999-01-01T00:00");
  await form.getByRole("button", { name: "Assign" }).click();
  await expect(form.getByRole("alert")).toHaveText(/Pick a time in the past/);
  await expect(form).toBeVisible();
});

test("the Fleet nav links to Unclaimed devices", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Unclaimed devices" })
    .click();
  await expect(page.getByRole("heading", { name: "Unclaimed devices" })).toBeVisible();
});
