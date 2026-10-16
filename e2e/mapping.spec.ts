import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// The Mapping editor on a Connector's page. Each test makes its own
// Webhook connector, with a unique name, and posts known payloads to it.

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
// to post to it.
async function webhook(request: APIRequestContext) {
  const created = await call<{ adapter: Adapter; ingestKey: { plaintext: string } }>(
    request,
    "ConnectorService/CreateWebhookConnector",
    { name: `e2e mapping ${unique()}` },
  );
  const post = async (body: object) => {
    const response = await request.post(`${api}/v1/webhooks/${created.ingestKey.plaintext}`, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(body),
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  return { adapter: created.adapter, post };
}

function mappingSection(page: Page) {
  return page.getByRole("region", { name: "Mapping" });
}

test("a Connector without a Mapping says its payloads make no Readings", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  await expect(mappingSection(page)).toContainText(
    "No Mapping yet; payloads are kept but make no Readings.",
  );
});

type LatestReading = {
  reading?: { deviceId: string; measurement?: { metric: string; value: number; unit: string } };
};

test("an admin previews a Mapping against the newest payload, saves it and Readings arrive", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  const deviceId = `e2e-mapping-${unique()}`;
  await hook.post({ dev: { id: deviceId }, ts: new Date().toISOString(), t: 21.5 });

  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  const section = mappingSection(page);
  await section.getByLabel("Device ID field").fill("dev.id");
  await section.getByLabel("Device time field").fill("ts");
  await section.getByRole("button", { name: "Add a Metric" }).click();
  const metric = section.getByRole("group", { name: "Metric 1" });
  await metric.getByLabel("Field").fill("t");
  await metric.getByLabel("Metric", { exact: true }).selectOption("temperature");
  // Only Units of the Metric's Quantity kind, or none.
  const units = await metric
    .getByLabel("Unit", { exact: true })
    .locator("option")
    .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  expect(units).toEqual(["", "K", "Cel", "[degF]"]);
  await metric.getByLabel("Unit", { exact: true }).selectOption("Cel");

  await section.getByRole("button", { name: "Preview" }).click();
  const preview = section.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText(deviceId);
  await expect(preview).toContainText("temperature");
  await expect(preview).toContainText("21.5 °C");
  // Preview saved nothing.
  await expect(section).toContainText("No Mapping yet");

  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("status")).toContainText("Saved Mapping version 1");
  await expect(section.getByRole("link", { name: "Reprocess payloads" })).toBeVisible();
  await expect(section).not.toContainText("No Mapping yet");

  await hook.post({ dev: { id: deviceId }, ts: new Date().toISOString(), t: 22 });
  await expect
    .poll(async () => {
      // NotFound until the first Reading is stored.
      const response = await request.post(`${api}/ridr.v1.QueryService/GetLatestReading`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { deviceId },
      });
      if (!response.ok()) return undefined;
      return ((await response.json()) as LatestReading).reading?.measurement;
    })
    .toEqual({ metric: "temperature", value: 22, unit: "Cel" });
});

test("the current Mapping opens in the editor and topic levels of a recent payload fill a field as $topic.N", async ({
  page,
  request,
}) => {
  const { adapters } = await call<{ adapters: Adapter[] }>(request, "AdapterService/ListAdapters", {});
  const adapter = adapters.find((a) => a.name === "Demo health devices");
  expect(adapter, 'the demo\'s "Demo health devices" (run make demo)').toBeTruthy();

  await page.goto(`/settings/data-sources/${adapter!.id}`);
  const section = mappingSection(page);
  const deviceId = section.getByLabel("Device ID field");
  await expect(deviceId).toHaveValue("device");
  await expect(section.getByRole("group", { name: "Metric 1" }).getByLabel("Field")).toHaveValue(
    "temperature_c",
  );

  const chips = section.getByRole("list", { name: "Topic levels" }).getByRole("button");
  await expect(chips.first()).toHaveText("$topic.0 adapters");
  await expect(chips.nth(1)).toHaveText(`$topic.1 ${adapter!.id}`);

  await deviceId.focus();
  await chips.nth(1).click();
  await expect(deviceId).toHaveValue("$topic.1");

  // Previewed, not saved: the demo's Mapping stays as it is.
  await section.getByRole("button", { name: "Preview" }).click();
  await expect(section.getByRole("region", { name: "Preview" }).getByRole("listitem").first()).toContainText(
    adapter!.id,
  );
});

test("a pasted sample previews its problem, and a refused save shows its reason beside the field", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  const section = mappingSection(page);
  // No payloads yet, so the sample is pasted.
  await expect(section.getByLabel("Paste a sample")).toBeChecked();
  await section.getByLabel("Device ID field").fill("id");
  await section.getByLabel("Device time field").fill("ts");
  await section.getByRole("button", { name: "Add a Metric" }).click();
  const metric = section.getByRole("group", { name: "Metric 1" });
  await metric.getByLabel("Field").fill("t");
  await metric.getByLabel("Metric", { exact: true }).selectOption("temperature");
  await section.getByLabel("Sample payload").fill('{"t": 3}');
  await section.getByRole("button", { name: "Preview" }).click();
  await expect(section.getByRole("region", { name: "Preview" })).toContainText("Problem:");

  await section.getByLabel("Device time field").fill("");
  await section.getByRole("button", { name: "Save" }).click();
  const timeField = section.getByLabel("Device time field").locator("..");
  await expect(timeField.getByRole("alert")).toContainText("device time field is missing");
  await expect(section).toContainText("No Mapping yet");
});

test("users without SetMapping see the current Mapping, without a form", async ({ page, request }) => {
  const { adapters } = await call<{ adapters: Adapter[] }>(request, "AdapterService/ListAdapters", {});
  const adapter = adapters.find((a) => a.name === "Demo health devices")!;
  await page.route("**/ridr.v1.AccessService/GetMe", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    me.permissions = me.permissions.filter(
      (p: string) => !p.endsWith("/SetMapping") && !p.endsWith("/PreviewMapping"),
    );
    await route.fulfill({ response, json: me });
  });
  await page.goto(`/settings/data-sources/${adapter.id}`);
  const section = mappingSection(page);
  await expect(section.getByRole("definition").first()).toHaveText("device");
  await expect(section).toContainText("temperature_c → temperature in °C");
  await expect(section.getByRole("textbox")).toHaveCount(0);
  await expect(section.getByRole("button")).toHaveCount(0);
});
