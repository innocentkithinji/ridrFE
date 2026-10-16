import { expect, test } from "@playwright/test";

const apiUrl = process.env.VITE_RIDR_API_URL || "http://localhost:18095";

test("anyone can read the Agent guide without a Session or any Ridr call", async ({ page }) => {
  const ridrCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(apiUrl)) ridrCalls.push(request.url());
  });

  await page.goto("/docs/agents");
  await expect(page.getByRole("heading", { name: "Build an Agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "User menu" })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(ridrCalls).toEqual([]);
});

const examples = [
  { tab: "Go", lines: ["ridr.New(ridr.Config{", "agent.QueueMeasurement(", "agent.QueueLocation(", "agent.QueueEvent(", "agent.Flush("] },
  { tab: "Python", lines: ["ridr.Agent(", "agent.queue_measurement(", "agent.queue_location(", "agent.queue_event(", "agent.flush()"] },
  { tab: "TypeScript", lines: ["new Agent({", "agent.queueMeasurement(", "agent.queueLocation(", "agent.queueEvent(", "agent.flush("] },
];

for (const { tab, lines } of examples) {
  test(`the ${tab} tab gives a complete example to copy`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/docs/agents");
    await page.getByRole("tab", { name: tab }).click();

    const example = page.getByRole("tabpanel", { name: tab });
    for (const line of lines) await expect(example).toContainText(line);

    await example.getByRole("button", { name: "Copy example" }).click();
    await expect(example.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    for (const line of lines) expect(copied).toContain(line);
    expect(copied).toContain("<INGEST_KEY>");
  });
}

test("placeholders stand out until the guide is given an Adapter ID and an Ingest key", async ({
  page,
  context,
}) => {
  await page.goto("/docs/agents");
  const panel = page.getByRole("tabpanel", { name: "Go" });
  await expect(panel.locator("mark", { hasText: "<INGEST_KEY>" })).toBeVisible();
  await expect(panel.locator("mark", { hasText: "<ADAPTER_ID>" })).toBeVisible();

  // A dev-only mount of the same guide with real-looking values, standing
  // in for the screen shown after an Adapter is registered.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/test-only/agent-guide");
  const filled = page.getByRole("tabpanel", { name: "Go" });
  await expect(filled).toContainText('IngestKey: "rik_test_secret"');
  await expect(filled).toContainText("Adapter adp_test_1");
  await expect(page.locator("mark")).toHaveCount(0);

  await filled.getByRole("button", { name: "Copy example" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('IngestKey: "rik_test_secret"');
  expect(copied).not.toContain("<INGEST_KEY>");
});
