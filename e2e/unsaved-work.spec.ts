import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Unsaved work in the long forms survives tab switches, asks before it
// is left behind, and comes back as a draft. Each test makes, and
// cleans up, its own records with unique names.

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

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Adapter = { id: string; name: string };

// connector makes a Webhook connector with no Mapping, retired after the test.
async function connector(request: APIRequestContext, cleanups: (() => Promise<unknown>)[]) {
  const { adapter } = await call<{ adapter: Adapter }>(
    request,
    "ConnectorService/CreateWebhookConnector",
    { name: `e2e drafts ${unique()}` },
  );
  cleanups.push(() =>
    call(request, "AdapterService/RetireAdapter", { adapterId: adapter.id }),
  );
  return adapter;
}

let cleanups: (() => Promise<unknown>)[] = [];
test.beforeEach(() => {
  cleanups = [];
});
test.afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup().catch(() => {});
});

// switchTabAway makes the page hidden, as when the user switches to another
// tab or window, and visible again later: TanStack Query refetches stale
// queries on the way back.
async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => s === "hidden" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, state);
}

function mappingSection(page: Page) {
  return page.getByRole("region", { name: "Mapping" });
}

test("typing in a new Connector's Mapping survives switching tabs past the refetch window", async ({
  page,
  request,
}) => {
  test.slow();
  const adapter = await connector(request, cleanups);
  await page.goto(`/settings/data-sources/${adapter.id}`);
  const section = mappingSection(page);
  await section.getByLabel("Device ID field").fill("dev.id");
  await section.getByLabel("Device time field").fill("ts");

  await setVisibility(page, "hidden");
  await page.waitForTimeout(11_000); // past the 10 s staleTime
  await setVisibility(page, "visible");
  // Give the refetch time to land.
  await page.waitForTimeout(1_500);

  await expect(section.getByLabel("Device ID field")).toHaveValue("dev.id");
  await expect(section.getByLabel("Device time field")).toHaveValue("ts");
  await expect(section).toContainText("No Mapping yet");
});
