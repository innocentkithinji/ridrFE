import { expect, test, type APIRequestContext } from "@playwright/test";

// MQTT bridges against the local stack. The stack's own broker is
// reachable inside Docker as mqtt://nats:1883, but at a private address,
// which this Ridr refuses when it dials: such a bridge stays
// DISCONNECTED with "address not allowed", retrying. The demo's HSL and
// Fintraffic bridges connect to public brokers. Every bridge a test
// creates is deleted afterwards, so none keeps retrying.

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";
const localBroker = "mqtt://nats:1883";

async function call<T>(request: APIRequestContext, method: string, body: object): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.ConnectorService/${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

function unique(label: string) {
  return `e2e bridge ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type Bridge = { adapter: { id: string; name: string; retiredAt?: string } };

async function bridgeNamed(request: APIRequestContext, name: string) {
  const { bridges = [] } = await call<{ bridges?: Bridge[] }>(request, "ListMqttBridges", {});
  return bridges.find((b) => b.adapter.name === name);
}

async function createBridge(request: APIRequestContext, name: string, password = "") {
  const { bridge } = await call<{ bridge: Bridge }>(request, "CreateMqttBridge", {
    name,
    brokerUrl: localBroker,
    username: "e2e",
    password,
    topicFilter: "e2e/#",
  });
  return bridge.adapter.id;
}

// Deletes whatever bridge a test left behind under its name.
const created: string[] = [];
test.afterEach(async ({ request }) => {
  for (const name of created.splice(0)) {
    const bridge = await bridgeNamed(request, name);
    if (bridge && !bridge.adapter.retiredAt) {
      await call(request, "DeleteMqttBridge", { adapterId: bridge.adapter.id });
    }
  }
});

test("create an MQTT bridge and watch it report it can't reach a private broker", async ({
  page,
}) => {
  test.slow(); // the status refetches every 10 s
  const name = unique("create");
  created.push(name);

  await page.goto("/settings/data-sources/new");
  await page.getByRole("radio", { name: /MQTT bridge/ }).check();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Broker URL").fill(localBroker);
  await page.getByLabel("Username").fill("e2e");
  await page.getByLabel("Password").fill("secret");
  await page.getByLabel("Topic filter").fill("e2e/#");
  await page.getByRole("button", { name: "Create bridge" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  const bridge = page.getByRole("region", { name: "MQTT bridge" });
  await expect(bridge).toContainText(localBroker);
  await expect(bridge).toContainText("e2e/#");
  await expect(bridge).toContainText("Password set");
  // It starts CONNECTING; the page refetches until the dial is refused.
  const status = bridge.getByRole("status");
  await expect(status).toContainText("Disconnected", { timeout: 25_000 });
  await expect(status).toContainText("address not allowed");
  await expect(status).toContainText("retrying");

  await page.goto("/settings/data-sources");
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("MQTT bridge");
  await expect(row).toContainText("Disconnected");
});

test("refused broker URLs and topic filters show Ridr's reason beside the field", async ({
  page,
}) => {
  const name = unique("refused");
  created.push(name);
  await page.goto("/settings/data-sources/new");
  await page.getByRole("radio", { name: /MQTT bridge/ }).check();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Topic filter").fill("e2e/#");

  const brokerUrl = page.getByLabel("Broker URL");
  for (const [url, reason] of [
    ["http://broker.example.com:1883", "scheme must be one of"],
    ["mqtt://broker.example.com:1883/feed", "only ws and wss broker URLs have a path"],
    ["mqtt://user:pass@broker.example.com:1883", "not the URL"],
  ]) {
    await brokerUrl.fill(url);
    await page.getByRole("button", { name: "Create bridge" }).click();
    await expect(brokerUrl).toHaveAccessibleDescription(new RegExp(reason));
  }

  await brokerUrl.fill("mqtt://broker.example.com:1883");
  await page.getByLabel("Topic filter").fill("e2e/#/late");
  await page.getByRole("button", { name: "Create bridge" }).click();
  await expect(page.getByLabel("Topic filter")).toHaveAccessibleDescription(/misplaces a wildcard/);
  await expect(brokerUrl).not.toHaveAttribute("aria-invalid");
  await expect(page.getByRole("alert")).toHaveCount(1);
});

test("edit a bridge, keeping, removing and replacing its password", async ({ page, request }) => {
  const name = unique("edit");
  created.push(name);
  const adapterId = await createBridge(request, name, "secret");

  await page.goto(`/settings/data-sources/${adapterId}`);
  const bridge = page.getByRole("region", { name: "MQTT bridge" });
  await expect(bridge).toContainText("Password set");

  // Leaving the password alone keeps it.
  await bridge.getByRole("button", { name: "Edit" }).click();
  await expect(bridge.getByLabel("Broker URL")).toHaveValue(localBroker);
  await bridge.getByLabel("Topic filter").fill("e2e/changed/#");
  await bridge.getByRole("button", { name: "Save" }).click();
  await expect(bridge).toContainText("e2e/changed/#");
  await expect(bridge).toContainText("Password set");

  // A refused change says why beside the field and keeps the form open.
  await bridge.getByRole("button", { name: "Edit" }).click();
  await bridge.getByLabel("Broker URL").fill("http://broker.example.com:1883");
  await bridge.getByRole("button", { name: "Save" }).click();
  await expect(bridge.getByLabel("Broker URL")).toHaveAccessibleDescription(/scheme must be one of/);
  await bridge.getByLabel("Broker URL").fill(localBroker);

  await bridge.getByRole("radio", { name: "Remove the password" }).check();
  await bridge.getByRole("button", { name: "Save" }).click();
  await expect(bridge).toContainText("No password");

  await bridge.getByRole("button", { name: "Edit" }).click();
  await bridge.getByRole("radio", { name: "Set a new password" }).check();
  await bridge.getByLabel("New password", { exact: true }).fill("another");
  await bridge.getByRole("button", { name: "Save" }).click();
  await expect(bridge).toContainText("Password set");
  await expect(bridge.getByRole("button", { name: "Save" })).toHaveCount(0);
});

test("deleting a bridge asks first, says Readings stay, and retires its Adapter", async ({
  page,
  request,
}) => {
  const name = unique("delete");
  created.push(name);
  const adapterId = await createBridge(request, name);

  await page.goto(`/settings/data-sources/${adapterId}`);
  const bridge = page.getByRole("region", { name: "MQTT bridge" });
  await bridge.getByRole("button", { name: "Delete bridge" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Readings stay");
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Retired");
  await expect(row).not.toContainText("MQTT bridge");
  expect(await bridgeNamed(request, name)).toBeUndefined();
});
