import { expect, test, type Page } from "@playwright/test";

// Each test creates its own connectors, with unique names, through the
// screen, so the tests re-run cleanly against the demo data.

function unique(label: string) {
  return `e2e ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function startAdding(page: Page, kind: RegExp, name: string) {
  await page.goto("/settings/data-sources/new");
  await page.getByRole("radio", { name: kind }).check();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
}

async function secretOf(page: Page, label: string) {
  const value = await page.getByRole("dialog").getByLabel(label, { exact: true }).textContent();
  return value?.trim() ?? "";
}

test("create a Webhook connector and copy its URL once", async ({ page }) => {
  const name = unique("webhook");
  await startAdding(page, /Webhook connector/, name);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("won't be shown again");
  const url = await secretOf(page, "Webhook URL");
  expect(url).toMatch(/\/v1\/webhooks\/\S{10,}$/);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(url)).toHaveCount(0);

  await page.getByRole("link", { name: `Open ${name}` }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(url)).toHaveCount(0);
});

test("create a Hosted MQTT connector: broker, username, topic and password shown once", async ({
  page,
}) => {
  const name = unique("hosted mqtt");
  await startAdding(page, /Hosted MQTT connector/, name);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("won't be shown again");
  const username = await secretOf(page, "Username");
  expect(username).toMatch(/^[0-9a-f-]{36}$/);
  expect(await secretOf(page, "Topic")).toBe(`adapters/${username}`);
  expect(await secretOf(page, "Broker URL")).toMatch(/^(mqtts?|tcp|ssl|tls|wss?):\/\//);
  const password = await secretOf(page, "Password");
  expect(password.length).toBeGreaterThan(10);
  await expect(dialog.getByRole("note")).toContainText(
    `Publish only to adapters/${username} or a topic below it`,
  );
  await expect(dialog.getByRole("note")).toContainText("drops publishes to any other topic");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(password)).toHaveCount(0);

  await page.getByRole("link", { name: `Open ${name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/settings/data-sources/${username}$`));
  await expect(page.getByText(password)).toHaveCount(0);
});

test("without Hosted MQTT on this Ridr, shows the server's message", async ({ page }) => {
  const message = "this Ridr runs no hosted MQTT broker";
  await page.route("**/ridr.v1.ConnectorService/CreateHostedMqttConnector", (route) =>
    route.fulfill({ status: 400, json: { code: "failed_precondition", message } }),
  );
  await startAdding(page, /Hosted MQTT connector/, unique("no broker"));
  await expect(page.getByRole("alert")).toHaveText(message);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a new Ingest key on a Webhook connector shows its full new URL once", async ({ page }) => {
  const name = unique("webhook key");
  await startAdding(page, /Webhook connector/, name);
  const first = await secretOf(page, "Webhook URL");
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.getByRole("link", { name: `Open ${name}` }).click();

  const keys = page.getByRole("region", { name: "Ingest keys" });
  await keys.getByRole("button", { name: "Create Ingest key" }).click();
  const dialog = page.getByRole("dialog");
  const key = await secretOf(page, "Ingest key");
  const url = await secretOf(page, "Webhook URL");
  const start = first.slice(0, first.lastIndexOf("/") + 1);
  expect(url).toBe(start + key);
  expect(url).not.toBe(first);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(url)).toHaveCount(0);
});

test("in a browser that didn't create a Webhook connector, a new key explains the missing URL", async ({ page }) => {
  const name = unique("webhook elsewhere");
  await startAdding(page, /Webhook connector/, name);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  // Another browser: nothing remembered from the connector's creation.
  await page.evaluate(() => localStorage.clear());
  await page.getByRole("link", { name: `Open ${name}` }).click();

  await page.getByRole("region", { name: "Ingest keys" }).getByRole("button", { name: "Create Ingest key" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Ingest key", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Webhook URL", { exact: true })).toHaveCount(0);
  await expect(dialog).toContainText(
    "If this is a Webhook connector, its new URL is its old one with this key in place of the last part",
  );
});
