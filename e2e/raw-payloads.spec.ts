import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { signInAs, signInAsAdmin } from "./users";

// Raw payloads on a Connector's page. The demo's Connectors keep
// receiving payloads; tests that need problems or plain text make their
// own Webhook connector, with a unique name, and post to it.

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

async function demoAdapter(request: APIRequestContext, name: string): Promise<Adapter> {
  const { adapters } = await call<{ adapters: Adapter[] }>(
    request,
    "AdapterService/ListAdapters",
    {},
  );
  const found = adapters.find((a) => a.name === name);
  expect(found, `the demo's "${name}" (run make demo)`).toBeTruthy();
  return found!;
}

// webhook creates a Webhook connector with no Mapping, so every payload
// posted to it has a problem, and returns a way to post to it.
async function webhook(request: APIRequestContext) {
  const name = `e2e raw payloads ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const created = await call<{ adapter: Adapter; ingestKey: { plaintext: string } }>(
    request,
    "ConnectorService/CreateWebhookConnector",
    { name },
  );
  const post = async (body: string, contentType = "application/json") => {
    const response = await request.post(`${api}/v1/webhooks/${created.ingestKey.plaintext}`, {
      headers: { "Content-Type": contentType },
      data: body,
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  return { adapter: created.adapter, post };
}

function rawPayloads(page: Page) {
  return page.getByRole("region", { name: "Raw payloads" });
}

test("a Hosted MQTT connector's payloads show newest first with topic, Mapping version and pretty JSON", async ({
  page,
  request,
}) => {
  const adapter = await demoAdapter(request, "Demo health devices");
  await page.goto(`/settings/data-sources/${adapter.id}`);

  const section = rawPayloads(page);
  const payloads = section.getByRole("listitem");
  await expect(payloads.first()).toBeVisible();
  const first = payloads.first();
  await expect(first).toContainText(`adapters/${adapter.id}/`);
  await expect(first).toContainText("Mapping version 1");
  // Pretty-printed: one key per line, indented.
  await expect(first.locator("pre")).toContainText('\n  "device": "');

  const times = await payloads.locator("time").evaluateAll((els) =>
    els.map((el) => Date.parse(el.getAttribute("datetime") ?? "")),
  );
  expect(times.length).toBeGreaterThan(1);
  expect(times).toEqual(times.toSorted((a, b) => b - a));
});

test("a Webhook connector's payloads show pretty JSON without a topic", async ({
  page,
  request,
}) => {
  const adapter = await demoAdapter(request, "Demo factory machines");
  await page.goto(`/settings/data-sources/${adapter.id}`);

  const first = rawPayloads(page).getByRole("listitem").first();
  await expect(first.locator("pre")).toContainText('\n  "machine": {\n    "model": "');
  await expect(first).toContainText("Mapping version 1");
  await expect(first).not.toContainText("Topic");
});

test("plain text shows as it came, problems show beside their payload, and Refresh fetches new ones", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await hook.post("hello, not json", "text/plain");

  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  const section = rawPayloads(page);
  const payloads = section.getByRole("listitem");
  await expect(payloads).toHaveCount(1);
  await expect(payloads.first().locator("pre")).toHaveText("hello, not json");
  await expect(payloads.first()).toContainText("Problem: connector has no mapping");
  await expect(payloads.first()).toContainText("No Mapping");

  await section.getByLabel("Problems only").check();
  await expect(payloads).toHaveCount(1);
  await expect(payloads.first()).toContainText("connector has no mapping");

  // A new payload shows only on Refresh: nothing polls.
  await hook.post('{"n":2}');
  await page.waitForTimeout(1500);
  await expect(payloads).toHaveCount(1);
  await section.getByRole("button", { name: "Refresh" }).click();
  await expect(payloads).toHaveCount(2);
  await expect(payloads.first().locator("pre")).toHaveText('{\n  "n": 2\n}');
});

test("Newest N asks for that many, 100 by default", async ({ page, request }) => {
  const hook = await webhook(request);
  for (let n = 1; n <= 12; n++) await hook.post(`{"n":${n}}`);

  const limits: number[] = [];
  page.on("request", (r) => {
    // The Mapping editor asks for the newest one on its own.
    if (r.url().endsWith("/ListRawPayloads") && r.postDataJSON()?.limit !== 1) {
      limits.push(r.postDataJSON()?.limit);
    }
  });
  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  const section = rawPayloads(page);
  await expect(section.getByRole("listitem")).toHaveCount(12);
  await expect(section.getByLabel("Newest")).toHaveValue("100");

  await section.getByLabel("Newest").selectOption("10");
  await expect(section.getByRole("listitem")).toHaveCount(10);
  await expect(section.getByRole("listitem").first().locator("pre")).toContainText('"n": 12');
  expect(limits).toEqual([100, 10]);
  await expect(section.getByRole("option")).toHaveText(["10", "50", "100", "500", "1000"]);
});

test("hidden from non-admins, and on retired Adapters", async ({
  page,
  request,
}) => {
  const hook = await webhook(request);
  await hook.post('{"n":1}');

  // Raw payloads are for whole-Organisation admins only.
  await signInAs(page, "editor");
  let listed = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/ListRawPayloads")) listed = true;
  });
  await page.goto(`/settings/data-sources/${hook.adapter.id}`);
  await expect(page.getByRole("heading", { name: hook.adapter.name })).toBeVisible();
  await expect(page.getByRole("region", { name: "Manifests" })).toBeVisible();
  await expect(rawPayloads(page)).toHaveCount(0);
  expect(listed).toBe(false);

  await signInAsAdmin(page);
  await call(request, "AdapterService/RetireAdapter", { adapterId: hook.adapter.id });
  await page.reload();
  await expect(page.getByRole("heading", { name: hook.adapter.name })).toBeVisible();
  await expect(page.getByRole("region", { name: "Manifests" })).toBeVisible();
  await expect(rawPayloads(page)).toHaveCount(0);
});
