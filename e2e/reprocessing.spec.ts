import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Reprocessing and Corrections on an Adapter's page, and Raw payload
// retention on the Data sources list. Each test makes its own Webhook
// connector and Devices, with unique names: Corrections can't be undone,
// so they only ever touch Measurements these tests made.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call<T>(request: APIRequestContext, path: string, body: object): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

type Adapter = { id: string; name: string };

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// webhook creates a Webhook connector with no Mapping and returns a way
// to post to it and to give it a Mapping reading {id, ts, t} as
// temperature in Cel.
async function webhook(request: APIRequestContext) {
  const created = await call<{ adapter: Adapter; ingestKey: { plaintext: string } }>(
    request,
    "ConnectorService/CreateWebhookConnector",
    { name: `e2e reprocessing ${unique()}` },
  );
  const post = async (body: object) => {
    const response = await request.post(`${api}/v1/webhooks/${created.ingestKey.plaintext}`, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(body),
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  const map = () =>
    call(request, "ConnectorService/SetMapping", {
      adapterId: created.adapter.id,
      mapping: {
        deviceIdField: "id",
        deviceTimeField: "ts",
        metrics: [{ field: "t", metric: "temperature", unit: "Cel" }],
      },
    });
  return { adapter: created.adapter, post, map };
}

// local writes a moment as a datetime-local value in the browser's zone.
function local(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

const hour = 60 * 60_000;

// hold is a promise and the call that settles it, to keep a request
// waiting.
function hold() {
  let settle: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { held, release: () => settle?.() };
}

function region(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

// withoutPermission serves GetMe without the Permissions ending in names.
async function withoutPermission(page: Page, ...names: string[]) {
  await page.route("**/ridr.v1.AccessService/GetMe", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    me.permissions = me.permissions.filter(
      (p: string) => !names.some((name) => p.endsWith(`/${name}`)),
    );
    await route.fulfill({ response, json: me });
  });
}

test("an admin reprocesses a window with the current Mapping and sees the counts", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  const deviceId = `e2e-reprocess-${unique()}`;
  // Received before any Mapping, so it made no Readings.
  await hook.post({ id: deviceId, ts: new Date().toISOString(), t: 19.5 });
  await hook.map();

  await page.goto(`/settings/data-sources/${hook.adapter.id}#reprocessing`);
  const section = region(page, "Reprocessing");
  await expect(section).toHaveAttribute("id", "reprocessing");
  await section.getByLabel("From", { exact: true }).fill(local(Date.now() - hour));
  await section.getByLabel("To", { exact: true }).fill(local(Date.now() + hour));

  const { held, release } = hold();
  await page.route("**/ridr.v1.ConnectorService/ReprocessRawPayloads", async (route) => {
    await held;
    await route.continue();
  });
  const button = section.getByRole("button", { name: /Reprocess/ });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveText(/Reprocessing/);
  release();

  const result = section.getByRole("status");
  await expect(result).toContainText("1 payload reprocessed");
  await expect(result).toContainText("1 Reading");
  await expect(result).toContainText("0 problems");
  await expect(button).toBeEnabled();
});

type LatestReading = {
  reading?: { measurement?: { metric: string; value: number; unit: string } };
};

// latestMeasurement is a Device's newest Measurement, once stored.
async function latestMeasurement(request: APIRequestContext, deviceId: string) {
  const response = await request.post(`${api}/ridr.v1.QueryService/GetLatestReading`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { deviceId },
  });
  if (!response.ok()) return undefined;
  return ((await response.json()) as LatestReading).reading?.measurement;
}

test("an admin corrects the Unit of a Device's Measurements after confirming", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await hook.map();
  // A Device only this test sends for: Corrections can't be undone.
  const deviceId = `e2e-correct-${unique()}`;
  const at = Date.now() - 10 * 60_000;
  await hook.post({ id: deviceId, ts: new Date(at).toISOString(), t: 280 });
  await hook.post({ id: deviceId, ts: new Date(at + 60_000).toISOString(), t: 281 });
  await expect
    .poll(() => latestMeasurement(request, deviceId))
    .toEqual({ metric: "temperature", value: 281, unit: "Cel" });

  let sent: unknown;
  page.on("request", (r) => {
    if (r.url().endsWith("/CorrectMeasurements")) sent = r.postDataJSON();
  });
  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  const section = region(page, "Corrections");
  await section.getByLabel("Metric", { exact: true }).selectOption("temperature");
  await section.getByLabel("From", { exact: true }).fill(local(at - hour));
  await section.getByLabel("To", { exact: true }).fill(local(at + hour));
  await section.getByLabel("Only in Unit").selectOption("Cel");
  await expect(section.getByLabel("Only from this Adapter")).toBeChecked();
  await section.getByLabel("Devices").fill(deviceId);
  await section.getByLabel("New Unit").selectOption("K");

  // Cancelling sends nothing.
  await section.getByRole("button", { name: "Correct" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("can't be undone");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(sent).toBeUndefined();

  await section.getByRole("button", { name: "Correct" }).click();
  await dialog.getByRole("button", { name: "Correct" }).click();
  await expect(section.getByRole("status")).toContainText("2 Measurements corrected");
  expect(sent).toMatchObject({
    metric: "temperature",
    unit: "Cel",
    adapterId: hook.adapter.id,
    deviceIds: [deviceId],
    toUnit: "K",
  });
  expect(sent).not.toHaveProperty("toMetric");
  await expect
    .poll(() => latestMeasurement(request, deviceId))
    .toEqual({ metric: "temperature", value: 281, unit: "K" });
});

test("an admin reads and sets Raw payload retention on the Data sources list", async ({
  page,
  request,
}) => {
  const { days: before } = await call<{ days: number }>(
    request,
    "ConnectorService/GetRawPayloadRetention",
    {},
  );
  // Only ever raised, never shortened, and put back: it's the whole
  // Organisation's.
  const raised = Math.min(before + 1, 3650);
  try {
    await page.goto("/settings/data-sources");
    const section = region(page, "Raw payload retention");
    const days = section.getByLabel("Days");
    await expect(days).toHaveValue(String(before));

    await days.fill("0");
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByRole("alert")).toContainText("1 to 3650");
    await days.fill("3651");
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByRole("alert")).toContainText("1 to 3650");

    await days.fill(String(raised));
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByRole("status")).toContainText(`Kept for ${raised} days`);
    await expect
      .poll(async () =>
        (await call<{ days: number }>(request, "ConnectorService/GetRawPayloadRetention", {}))
          .days,
      )
      .toBe(raised);
  } finally {
    await call(request, "ConnectorService/SetRawPayloadRetention", { days: before });
  }
});

test("each control is hidden without its Permission; retention then reads only", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await withoutPermission(
    page,
    "ReprocessRawPayloads",
    "CorrectMeasurements",
    "SetRawPayloadRetention",
  );
  const { days } = await call<{ days: number }>(
    request,
    "ConnectorService/GetRawPayloadRetention",
    {},
  );

  await page.goto("/settings/data-sources");
  const retention = region(page, "Raw payload retention");
  await expect(retention).toContainText(`kept for ${days} days`);
  await expect(retention.getByRole("textbox")).toHaveCount(0);
  await expect(retention.getByRole("spinbutton")).toHaveCount(0);
  await expect(retention.getByRole("button")).toHaveCount(0);

  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  await expect(region(page, "Raw payloads")).toBeVisible();
  await expect(region(page, "Reprocessing")).toHaveCount(0);
  await expect(region(page, "Corrections")).toHaveCount(0);

  await page.unroute("**/ridr.v1.AccessService/GetMe");
  await withoutPermission(page, "GetRawPayloadRetention");
  await page.goto("/settings/data-sources");
  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();
  await expect(region(page, "Raw payload retention")).toHaveCount(0);
});
