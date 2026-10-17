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
  for (const cleanup of cleanups.toReversed()) await cleanup().catch(() => {});
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
  // Kept by the same editor, not remounted and restored.
  await expect(restoredNotice(page)).toHaveCount(0);
});

// leaveVia follows an in-app link, as the user would.
async function leaveVia(page: Page, link: string) {
  await page.getByRole("navigation").getByRole("link", { name: link, exact: true }).first().click();
}

function discardDialog(page: Page) {
  return page.getByRole("alertdialog", { name: "Discard your unsaved changes?" });
}

// reloadAccepting reloads the page, accepting the browser's leave prompt,
// and tells whether one was shown.
async function reloadAccepting(page: Page): Promise<boolean> {
  let prompted = false;
  const onDialog = (dialog: import("@playwright/test").Dialog) => {
    if (dialog.type() === "beforeunload") prompted = true;
    void dialog.accept();
  };
  page.on("dialog", onDialog);
  await page.reload();
  page.off("dialog", onDialog);
  return prompted;
}

const restoredNotice = (page: Page) => page.getByRole("status").filter({ hasText: "Restored your unsaved draft" });

test("leaving a dirty Mapping asks first; staying keeps the draft, discarding leaves", async ({ page, request }) => {
  const adapter = await connector(request, cleanups);
  await page.goto(`/settings/data-sources/${adapter.id}`);
  const section = mappingSection(page);
  await section.getByLabel("Device ID field").fill("dev.id");

  await leaveVia(page, "Assets");
  await expect(discardDialog(page)).toBeVisible();
  await discardDialog(page).getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(new RegExp(`/settings/data-sources/${adapter.id}$`));
  await expect(section.getByLabel("Device ID field")).toHaveValue("dev.id");

  await leaveVia(page, "Assets");
  await discardDialog(page).getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/\/assets$/);

  // Discarded: coming back starts afresh.
  await page.goBack();
  await expect(section.getByLabel("Device ID field")).toHaveValue("");
  await expect(restoredNotice(page)).toHaveCount(0);
});

test("a dirty Mapping prompts on reload, comes back as a draft, and Discard clears it", async ({ page, request }) => {
  const adapter = await connector(request, cleanups);
  await page.goto(`/settings/data-sources/${adapter.id}`);
  const section = mappingSection(page);
  await expect(section.getByLabel("Device ID field")).toBeVisible();
  // Nothing typed: no prompt.
  expect(await reloadAccepting(page)).toBe(false);

  await section.getByLabel("Device ID field").fill("dev.id");
  await section.getByLabel("Device time field").fill("ts");
  expect(await reloadAccepting(page)).toBe(true);

  await expect(restoredNotice(page)).toBeVisible();
  await expect(section.getByLabel("Device ID field")).toHaveValue("dev.id");
  await expect(section.getByLabel("Device time field")).toHaveValue("ts");

  await restoredNotice(page).getByRole("button", { name: "Discard" }).click();
  await expect(section.getByLabel("Device ID field")).toHaveValue("");
  await expect(restoredNotice(page)).toHaveCount(0);
  expect(await reloadAccepting(page)).toBe(false);
  await expect(section.getByLabel("Device ID field")).toHaveValue("");
  await expect(restoredNotice(page)).toHaveCount(0);
});

test("saving a Mapping clears its draft", async ({ page, request }) => {
  const adapter = await connector(request, cleanups);
  await page.goto(`/settings/data-sources/${adapter.id}`);
  const section = mappingSection(page);
  await section.getByLabel("Device ID field").fill("dev.id");
  await section.getByLabel("Device time field").fill("ts");
  await section.getByLabel("Latitude field").fill("lat");
  await section.getByLabel("Longitude field").fill("lon");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("status")).toContainText("Saved Mapping version 1");

  // Saved: leaving asks nothing, and nothing comes back.
  expect(await reloadAccepting(page)).toBe(false);
  await expect(section.getByLabel("Latitude field")).toHaveValue("lat");
  await expect(restoredNotice(page)).toHaveCount(0);
  await leaveVia(page, "Assets");
  await expect(page).toHaveURL(/\/assets$/);
});
