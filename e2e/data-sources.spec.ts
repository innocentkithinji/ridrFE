import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAs, type UserName } from "./users";

// Each test registers its own Adapters, with unique names, through the
// API or the screen, so the tests re-run cleanly against the demo data.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call<T>(request: APIRequestContext, method: string, body: object): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.AdapterService/${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

function unique(label: string) {
  return `e2e ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type Registered = { adapter: { id: string }; ingestKey: { plaintext: string } };

async function register(request: APIRequestContext, name: string) {
  return call<Registered>(request, "RegisterAdapter", { name });
}

test("lists every Adapter oldest first, retired ones marked, with the Agent guide linked", async ({
  page,
  request,
}) => {
  const older = unique("older");
  const newer = unique("newer");
  const first = await register(request, older);
  await register(request, newer);
  await call(request, "RetireAdapter", { adapterId: first.adapter.id });

  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Data sources" })
    .click();
  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();

  const rows = page.getByRole("row").filter({ hasText: /e2e (older|newer)/ });
  const names = await rows.allTextContents();
  expect(names.findIndex((t) => t.includes(older))).toBeLessThan(
    names.findIndex((t) => t.includes(newer)),
  );
  await expect(page.getByRole("row").filter({ hasText: older })).toContainText("Retired");
  await expect(page.getByRole("row").filter({ hasText: newer })).not.toContainText("Retired");

  await expect(page.getByRole("link", { name: "Agent guide" })).toHaveAttribute(
    "href",
    "/docs/agents",
  );
});

test("register an Adapter, copy its key once, see it in the guide, then revoke it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const name = unique("register");

  await page.goto("/settings/data-sources");
  await page.getByRole("link", { name: "Add a data source" }).first().click();
  await page.getByRole("radio", { name: /Adapter \(for an Agent\)/ }).check();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Register" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("won't be shown again");
  const key = (await dialog.getByLabel("Ingest key", { exact: true }).textContent())?.trim() ?? "";
  expect(key.length).toBeGreaterThan(10);
  await dialog.getByRole("button", { name: "Copy Ingest key" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(key);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);

  // The guide is filled in with this Adapter and its key.
  await expect(page.getByRole("heading", { name: "Build an Agent" })).toBeVisible();
  await expect(page.getByText(key).first()).toBeVisible();

  await page.getByRole("link", { name: `Open ${name}` }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  // The plaintext is gone once its dialog has closed.
  await expect(page.getByText(key)).toHaveCount(0);

  const keys = page.getByRole("region", { name: "Ingest keys" });
  await expect(keys.getByRole("row").filter({ hasText: "All Devices" })).toHaveCount(1);
  await keys.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
  await expect(keys.getByText("No Ingest keys.")).toBeVisible();
});

test("another key narrowed to Devices shows once and notes it can't use Hosted MQTT", async ({
  page,
  request,
}) => {
  const name = unique("narrowed");
  const { adapter } = await register(request, name);
  const device = `e2e-device-${Date.now()}`;

  await page.goto(`/settings/data-sources/${adapter.id}`);
  const keys = page.getByRole("region", { name: "Ingest keys" });
  await keys.getByLabel("Only these Devices (optional)").fill(device);
  await keys.getByRole("button", { name: "Create Ingest key" }).click();

  const dialog = page.getByRole("dialog");
  const key = (await dialog.getByLabel("Ingest key", { exact: true }).textContent())?.trim() ?? "";
  expect(key.length).toBeGreaterThan(10);
  await dialog.getByRole("button", { name: "Done" }).click();

  // The guide carries the new key until it's hidden; the list never does.
  await expect(page.getByRole("heading", { name: "Build an Agent" })).toBeVisible();
  await expect(page.getByText(key).first()).toBeVisible();
  const narrowed = keys.getByRole("row").filter({ hasText: device });
  await expect(narrowed).toContainText("Can't connect over Hosted MQTT.");
  await expect(narrowed).not.toContainText(key);
  await expect(keys.getByRole("row").filter({ hasText: "All Devices" })).toHaveCount(1);

  await page.getByRole("button", { name: "Hide the Agent guide" }).click();
  await expect(page.getByText(key)).toHaveCount(0);
});

test("lists Manifests oldest first with their Metrics and Units", async ({ page, request }) => {
  const { adapter, ingestKey } = await register(request, unique("manifests"));
  for (const entries of [
    [{ metric: "temperature", unit: "Cel" }],
    [
      { metric: "temperature", unit: "Cel" },
      { metric: "speed", unit: "km/h" },
    ],
  ]) {
    const response = await request.post(`${api}/ridr.v1.IngestService/PublishManifest`, {
      headers: { Authorization: `Bearer ${ingestKey.plaintext}` },
      data: { entries },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }

  await page.goto(`/settings/data-sources/${adapter.id}`);
  const manifests = page.getByRole("region", { name: "Manifests" });
  const versions = manifests.getByRole("listitem");
  await expect(versions).toHaveCount(2);
  await expect(versions.nth(0)).toContainText("Version 1");
  await expect(versions.nth(0).getByRole("row")).toHaveCount(2);
  await expect(versions.nth(1)).toContainText("Version 2");
  await expect(versions.nth(1).getByRole("row").filter({ hasText: "speed" })).toContainText(
    "km/h",
  );
  await expect(versions.nth(1).getByRole("row").filter({ hasText: "temperature" })).toContainText(
    "Cel",
  );
});

test("retiring asks first, can't be undone, and leaves the Adapter read-only", async ({
  page,
  request,
}) => {
  const name = unique("retire");
  const { adapter } = await register(request, name);

  await page.goto(`/settings/data-sources/${adapter.id}`);
  await page.getByRole("region", { name: "Retire" }).getByRole("button", { name: "Retire" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("can't be undone");
  await confirm.getByRole("button", { name: "Retire" }).click();

  await expect(page.getByRole("main").getByText("Retired", { exact: true })).toBeVisible();
  const keys = page.getByRole("region", { name: "Ingest keys" });
  await expect(keys.getByText("No Ingest keys.")).toBeVisible();
  await expect(keys.getByRole("button", { name: "Create Ingest key" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Retire" })).toHaveCount(0);

  await page.goto("/settings/data-sources");
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Retired");
});

for (const user of ["viewer", "editor", "scoped"] satisfies UserName[]) {
  test(`a ${user} gets a read-only screen`, async ({ page, request }) => {
    const name = unique("readonly");
    await register(request, name);
    await signInAs(page, user);

    await page.goto("/settings/data-sources");
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a data source" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Agent guide" })).toBeVisible();

    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("region", { name: "Manifests" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ingest keys" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Retire" })).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);

    await page.goto("/settings/data-sources/new");
    await expect(page.getByRole("alert")).toContainText("No access");
  });
}

test("with no Adapters, says so and offers to add one", async ({ page }) => {
  await page.route("**/ridr.v1.AdapterService/ListAdapters", (route) =>
    route.fulfill({ json: { adapters: [] } }),
  );
  await page.goto("/settings/data-sources");
  await expect(page.getByText("No data sources yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a data source" })).toHaveCount(2);
});

test("an unknown Adapter shows not found", async ({ page }) => {
  await page.goto("/settings/data-sources/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByRole("heading", { name: "Data source not found" })).toBeVisible();
});
