import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Runs against the demo data (`make demo` in ../Ridr): Device fridge-N
// reports for "Demo medicine fridge N" through an open Assignment.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const devToken = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";
const auth = { Authorization: `Bearer ${devToken}` };

async function call(request: APIRequestContext, path: string, data: object, token = devToken) {
  const response = await request.post(`${api}/ridr.v1.${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}

// freshAsset creates an Asset with no Devices, and a Device Ridr has seen
// only a Location from (so it has no Measurements), both uniquely named.
async function freshAsset(request: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { asset } = await call(request, "RegistryService/CreateAsset", {
    name: `Test asset ${stamp}`,
  });
  const { ingestKey } = await call(request, "AdapterService/RegisterAdapter", {
    name: `e2e-asset-detail-${stamp}`,
  });
  const deviceId = `e2e-located-${stamp}`;
  await call(
    request,
    "IngestService/Ingest",
    {
      locations: [
        { deviceId, deviceTime: new Date().toISOString(), latitude: 60.17, longitude: 24.94 },
      ],
    },
    ingestKey.plaintext,
  );
  // Ridr registers the Device as it stores the Reading, just after Ingest
  // answers.
  await expect
    .poll(
      async () => (await call(request, "RegistryService/GetDeviceHealth", { deviceId })).health,
      { timeout: 10_000 },
    )
    .not.toBe("DEVICE_HEALTH_NEVER_SEEN");
  return { assetId: asset.id as string, name: asset.name as string, deviceId };
}

// assetIdOf finds a demo Asset's ID by name, through Ridr.
async function assetIdOf(page: Page, name: string): Promise<string> {
  const response = await page.request.post(`${api}/ridr.v1.RegistryService/ListAssets`, {
    headers: auth,
    data: {},
  });
  const { assets } = (await response.json()) as { assets: { id: string; name: string }[] };
  const asset = assets.find((one) => one.name === name);
  if (!asset) throw new Error(`no Asset named ${name}`);
  return asset.id;
}

test("opens an Asset from the list and shows its Attributes and Assignment history", async ({
  page,
}) => {
  await page.goto("/assets");
  await page.getByRole("searchbox", { name: "Filter Assets" }).fill("Demo medicine fridge 1");
  await page.getByRole("link", { name: "Demo medicine fridge 1" }).click();

  await expect(page.getByRole("heading", { name: "Demo medicine fridge 1" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Attributes" })).toContainText(
    "kind=medicine fridge",
  );
  const history = page.getByRole("table", { name: "Assignment history" });
  // Other tests may assign Devices to the demo Assets too.
  await expect(history.getByRole("row").filter({ hasText: "fridge-1" })).toContainText("Current");
});

test("an Asset that doesn't exist reads as not found", async ({ page }) => {
  await page.goto("/assets/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByText("This Asset doesn't exist, or isn't yours to see.")).toBeVisible();
});

test("each current Device shows its health and latest Reading", async ({ page }) => {
  await page.goto(`/assets/${await assetIdOf(page, "Demo medicine fridge 1")}`);
  const devices = page.getByRole("region", { name: "Devices" });
  const fridge = devices.getByRole("listitem").filter({ hasText: "fridge-1" });
  await expect(fridge.getByText("Live", { exact: true })).toBeVisible();
  await expect(fridge.getByText(/temperature\s+-?\d+(\.\d+)?\s*°C/)).toBeVisible();
});

test("the Asset's live Readings chart grows without reload", async ({ page }) => {
  await page.goto(`/assets/${await assetIdOf(page, "Demo medicine fridge 1")}`);
  const readings = page.getByRole("region", { name: "Readings" });
  const chart = readings.getByRole("figure", { name: "Demo medicine fridge 1, last hour" });
  await expect(chart).toBeVisible();
  await expect(readings.getByText("Live", { exact: true })).toBeVisible();

  // The table under the chart shows each series' newest point.
  await chart.getByText("Show as table").click();
  const latest = chart.getByRole("group").getByRole("row", { name: /fridge-1 · temperature/ });
  await expect(latest).toBeVisible();
  const before = await latest.textContent();
  await expect.poll(() => latest.textContent(), { timeout: 30_000 }).not.toBe(before);
});

test("the Asset's Alerts are listed, newest first", async ({ page }) => {
  await page.goto(`/assets/${await assetIdOf(page, "Demo medicine fridge 2")}`);
  const alerts = page.getByRole("region", { name: "Alerts" });
  await expect(
    alerts.getByRole("listitem").filter({ hasText: "Demo medicine fridge above 8 °C" }).first(),
  ).toContainText(/Firing|Acknowledged|Resolved/);
});

test("an editor assigns a Device to an Asset with none", async ({ page, request }) => {
  const fresh = await freshAsset(request);
  await page.goto(`/assets/${fresh.assetId}`);
  const devices = page.getByRole("region", { name: "Devices" });
  await expect(devices.getByText("No Devices report for this Asset.")).toBeVisible();

  await devices.getByRole("button", { name: "Assign", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Assign a Device to ${fresh.name}` });
  await dialog.getByRole("textbox", { name: "Device ID" }).fill(fresh.deviceId);
  await dialog.getByRole("button", { name: "Assign" }).click();
  await expect(dialog).toBeHidden();

  const device = devices.getByRole("listitem").filter({ hasText: fresh.deviceId });
  await expect(device).toContainText("No Measurements yet.");
  await expect(
    page.getByRole("table", { name: "Assignment history" }).getByRole("row", { name: new RegExp(fresh.deviceId) }),
  ).toContainText("Current");
});

test("an overlapping Assignment explains Ridr's FailedPrecondition", async ({ page, request }) => {
  const fresh = await freshAsset(request);
  await call(request, "RegistryService/AssignDevice", {
    deviceId: fresh.deviceId,
    assetId: fresh.assetId,
  });
  await page.goto(`/assets/${fresh.assetId}`);
  const devices = page.getByRole("region", { name: "Devices" });
  await expect(devices.getByRole("listitem").filter({ hasText: fresh.deviceId })).toBeVisible();

  await devices.getByRole("button", { name: "Assign", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Assign a Device to ${fresh.name}` });
  await dialog.getByRole("textbox", { name: "Device ID" }).fill(fresh.deviceId);
  await dialog.getByRole("radio", { name: "From a chosen time" }).check();
  await dialog.getByLabel("Starts at").fill("2020-01-01T00:00");
  await dialog.getByRole("button", { name: "Assign" }).click();
  await expect(dialog.getByRole("alert")).toContainText("can't overlap");
  await expect(dialog.getByRole("alert")).toContainText("already has an assignment");
});

test("unassigning a Device that has no Assignment shows NotFound", async ({ page, request }) => {
  const fresh = await freshAsset(request);
  await call(request, "RegistryService/AssignDevice", {
    deviceId: fresh.deviceId,
    assetId: fresh.assetId,
  });
  await page.goto(`/assets/${fresh.assetId}`);
  await page.getByRole("button", { name: `Unassign ${fresh.deviceId}` }).click();
  const dialog = page.getByRole("dialog", { name: `Unassign ${fresh.deviceId}` });
  // Someone else unassigns it first.
  await call(request, "RegistryService/UnassignDevice", { deviceId: fresh.deviceId });
  await dialog.getByRole("button", { name: "Unassign" }).click();
  await expect(dialog.getByRole("alert")).toContainText("no current Assignment");
});

test("on a demo fridge, an editor unassigns its Device and assigns it back", async ({
  page,
  request,
}) => {
  const assetId = await assetIdOf(page, "Demo medicine fridge 2");
  try {
    await page.goto(`/assets/${assetId}`);
    const readings = page.getByRole("region", { name: "Readings" });
    await expect(readings.getByRole("figure", { name: "Demo medicine fridge 2, last hour" })).toBeVisible();
    await expect(readings.getByText("Live", { exact: true })).toBeVisible();

    const devices = page.getByRole("region", { name: "Devices" });
    const fridge = devices.getByRole("listitem").filter({ hasText: "fridge-2" });
    await expect(fridge).toBeVisible();
    await fridge.getByRole("button", { name: "Unassign fridge-2" }).click();
    const unassign = page.getByRole("dialog", { name: "Unassign fridge-2" });
    await unassign.getByRole("button", { name: "Unassign" }).click();
    await expect(unassign).toBeHidden();
    await expect(fridge).toHaveCount(0);
    const history = page.getByRole("table", { name: "Assignment history" });
    await expect(history.getByRole("row", { name: /fridge-2/ }).last()).not.toContainText("Current");

    await devices.getByRole("button", { name: "Assign", exact: true }).click();
    const assign = page.getByRole("dialog", { name: "Assign a Device to Demo medicine fridge 2" });
    await assign.getByRole("textbox", { name: "Device ID" }).fill("fridge-2");
    await assign.getByRole("button", { name: "Assign" }).click();
    await expect(assign).toBeHidden();
    await expect(fridge.getByText("Live", { exact: true })).toBeVisible();
    await expect(history.getByRole("row", { name: /fridge-2/ }).last()).toContainText("Current");
  } finally {
    // Leave the demo as found, even when a step failed.
    const asset = await call(request, "RegistryService/GetAsset", { assetId });
    const open = (asset.assignments as { deviceId: string; endsAt?: string }[]).some(
      (one) => one.deviceId === "fridge-2" && !one.endsAt,
    );
    if (!open) {
      await call(request, "RegistryService/AssignDevice", { deviceId: "fridge-2", assetId });
    }
  }
});
