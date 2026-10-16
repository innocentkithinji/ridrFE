import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test("the Alerting nav links to Silences", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Silences" })
    .click();
  await expect(page).toHaveURL(/\/silences$/);
  await expect(page.getByRole("heading", { name: "Silences" })).toBeVisible();
});

const pad = (n: number) => String(n).padStart(2, "0");

// localInput writes a time for a datetime-local field, in local time.
function localInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

test("an editor creates a Silence from Controlled keys, previewing its Assets", async ({ page }) => {
  const stamp = String(Date.now());
  const comment = `Planned maintenance ${stamp}`;
  await page.goto("/silences");
  await page.getByRole("button", { name: "Create Silence" }).click();
  const form = page.getByRole("dialog", { name: "Create Silence" });

  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 1" }).fill("fleet");
  await form.getByRole("combobox", { name: "Value 1" }).selectOption("fintraffic");
  const preview = form.getByRole("list", { name: "Assets this Silence covers" });
  await expect(preview.getByText("Train 27 Helsinki–Rovaniemi")).toBeVisible();

  // A key no Asset holds, so the Silence holds back nothing real.
  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 2" }).fill("e2e_silence");
  await form.getByRole("textbox", { name: "Value 2" }).fill(stamp);
  await expect(form.getByText("No Assets hold every pair yet.")).toBeVisible();

  await form.getByLabel("Ends").fill(localInput(hoursFromNow(2)));
  await form.getByLabel("Comment").fill(comment);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();

  const silence = page.getByRole("listitem").filter({ hasText: comment });
  await expect(silence).toContainText("fleet=fintraffic");
  await expect(silence).toContainText(`e2e_silence=${stamp}`);
  await expect(silence).toContainText("Active");
  await expect(silence).toContainText("by dev-user");
  await expect(silence).toContainText("Ends");
});

// createSilence creates, through the form, a Silence over a key no Asset
// holds, and returns its list item.
async function createSilence(page: Page, comment: string, startsAt?: Date) {
  await page.goto("/silences");
  await page.getByRole("button", { name: "Create Silence" }).click();
  const form = page.getByRole("dialog", { name: "Create Silence" });
  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 1" }).fill("e2e_silence");
  await form.getByRole("textbox", { name: "Value 1" }).fill(String(Date.now()));
  if (startsAt) {
    await form.getByLabel("Starts").fill(localInput(startsAt));
  }
  await form.getByLabel("Ends").fill(localInput(hoursFromNow(3)));
  await form.getByLabel("Comment").fill(comment);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();
  return page.getByRole("list", { name: "Silences" }).getByRole("listitem").filter({ hasText: comment });
}

test("an editor ends a Silence early; expired ones show on demand", async ({ page }) => {
  const comment = `End early ${Date.now()}`;
  const silence = await createSilence(page, comment);
  await expect(silence).toContainText("Active");

  await silence.getByRole("button", { name: "End early" }).click();
  await expect(silence).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Show expired" }).check();
  await expect(silence).toContainText("Expired");
  await expect(silence.getByRole("button", { name: "End early" })).toHaveCount(0);
});

test("a Silence starting later shows as pending", async ({ page }) => {
  const comment = `Pending ${Date.now()}`;
  const silence = await createSilence(page, comment, hoursFromNow(1));
  await expect(silence).toContainText("Pending");
  await silence.getByRole("button", { name: "End early" }).click();
  await expect(silence).toHaveCount(0);
});

test("picking an Asset by name copies its Attributes into the selector", async ({ page }) => {
  await page.goto("/silences");
  await page.getByRole("button", { name: "Create Silence" }).click();
  const form = page.getByRole("dialog", { name: "Create Silence" });
  await form.getByRole("combobox", { name: "Start from an Asset" }).fill("Demo medicine fridge 1");
  await expect(form.getByRole("combobox", { name: "Key 1" })).toHaveValue("kind");
  await expect(form.getByRole("textbox", { name: "Value 1" })).toHaveValue("medicine fridge");
  const preview = form.getByRole("list", { name: "Assets this Silence covers" });
  await expect(preview.getByRole("listitem")).toHaveText([
    "Demo medicine fridge 1",
    "Demo medicine fridge 2",
  ]);
});

test("a refused create shows the server's reason beside the form", async ({ page }) => {
  await page.goto("/silences");
  await page.getByRole("button", { name: "Create Silence" }).click();
  const form = page.getByRole("dialog", { name: "Create Silence" });
  await form.getByRole("button", { name: "Add Attribute" }).click();
  await form.getByRole("combobox", { name: "Key 1" }).fill("e2e_silence");
  await form.getByRole("textbox", { name: "Value 1" }).fill(String(Date.now()));
  await form.getByLabel("Ends").fill(localInput(hoursFromNow(-1)));
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form.getByRole("alert")).toContainText("must end after it starts");
  await expect(form).toBeVisible();
});

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const token = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";

async function call(request: APIRequestContext, method: string, body: object) {
  const response = await request.post(`${api}/ridr.v1.${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return response.json();
}

// The demo fridges report temperature every few seconds; a Rule that
// always fires on them, under a Silence over them, records Alerts the
// Silence holds back. Both are removed again afterwards.
test("each Silence lists the Alerts it held back", async ({ page, request }) => {
  const stamp = Date.now();
  const comment = `Defrost ${stamp}`;
  const ruleName = `Always firing ${stamp}`;
  const { silence } = await call(request, "SilenceService/CreateSilence", {
    selector: { kind: "medicine fridge" },
    endsAt: hoursFromNow(1).toISOString(),
    comment,
  });
  const { rule } = await call(request, "RuleService/CreateRule", {
    rule: {
      name: ruleName,
      selector: { kind: "medicine fridge" },
      forDuration: "0s",
      freshness: "300s",
      threshold: {
        metric: "temperature",
        operator: "THRESHOLD_OPERATOR_ABOVE",
        value: -100,
        unit: "Cel",
      },
    },
  });
  try {
    await page.goto("/silences");
    const item = page
      .getByRole("list", { name: "Silences" })
      .getByRole("listitem")
      .filter({ hasText: comment });
    await expect(item).toContainText("Covers Demo medicine fridge 1, Demo medicine fridge 2");
    const heldBack = item.getByRole("region", { name: "Held-back Alerts" });
    // Nothing streams, so reload until the Rule has fired.
    await expect(async () => {
      await page.reload();
      await expect(heldBack).toContainText(ruleName, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(heldBack).toContainText("Demo medicine fridge");
  } finally {
    await call(request, "RuleService/DeleteRule", { ruleId: rule.id });
    await call(request, "SilenceService/EndSilence", { silenceId: silence.id });
  }
});

// Only one user exists on the local stack, a whole-Organisation admin, so
// these tests change that user's real GetMe answer to stand in for a
// viewer or a scoped editor.
async function changeMe(page: Page, change: (me: Record<string, unknown>) => void) {
  await page.route("**/ridr.v1.AccessService/GetMe", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    change(me);
    await route.fulfill({ response, json: me });
  });
}

test("a viewer sees Silences but neither create nor end", async ({ page }) => {
  const silence = await createSilence(page, `Viewer sees ${Date.now()}`);
  await changeMe(page, (me) => {
    me.permissions = (me.permissions as string[]).filter(
      (p) => p !== "ridr.v1.SilenceService/CreateSilence" && p !== "ridr.v1.SilenceService/EndSilence",
    );
  });
  await page.goto("/silences");
  await expect(silence).toContainText("Active");
  await expect(page.getByRole("button", { name: "Create Silence" })).toHaveCount(0);
  await expect(silence.getByRole("button", { name: "End early" })).toHaveCount(0);
});

test("without the list Permission there is no link and no access", async ({ page }) => {
  await changeMe(page, (me) => {
    me.permissions = (me.permissions as string[]).filter(
      (p) => p !== "ridr.v1.SilenceService/ListSilences",
    );
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Silences" })).toHaveCount(0);
  await page.goto("/silences");
  await expect(page.getByRole("alert")).toContainText("No access");
});

// The stack has no scoped user yet (docs/backend-requests.md), so Ridr's
// out-of-Scope refusal is played back for the create call.
test("a scoped editor starts from their Scope and sees an out-of-Scope refusal", async ({
  page,
}) => {
  await changeMe(page, (me) => {
    me.scope = { conditions: [{ key: "fleet", values: ["hsl"] }] };
  });
  const refusal = "selector must pin fleet to a value in your scope";
  await page.route("**/ridr.v1.SilenceService/CreateSilence", (route) =>
    route.fulfill({ status: 403, json: { code: "permission_denied", message: refusal } }),
  );
  await page.goto("/silences");
  await expect(page.getByText("You see and create Silences within your Scope only.")).toBeVisible();
  await page.getByRole("button", { name: "Create Silence" }).click();
  const form = page.getByRole("dialog", { name: "Create Silence" });
  await expect(form.getByRole("combobox", { name: "Key 1" })).toHaveValue("fleet");
  await expect(form.getByRole("combobox", { name: "Value 1" })).toHaveValue("hsl");

  await form.getByRole("combobox", { name: "Value 1" }).selectOption("fintraffic");
  await form.getByLabel("Ends").fill(localInput(hoursFromNow(1)));
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form.getByRole("alert")).toHaveText(refusal);
});
