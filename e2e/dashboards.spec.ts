import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Dashboards (/dashboards) against the demo data: the demo simulator keeps
// "Demo medicine fridge 1" reporting temperature, trains 265 and 266
// reporting Locations, and devices raising Events. Each test makes its own
// Dashboard with a unique name.

const fridge = 'measurements | where asset == "Demo medicine fridge 1" and metric == temperature';

function unique(label: string) {
  return `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// createDashboard makes a Dashboard from the list and lands in its edit mode.
async function createDashboard(page: Page, name: string) {
  await page.goto("/dashboards");
  await page.getByRole("button", { name: "Create Dashboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Dashboard" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a widget" })).toBeVisible();
}

async function addWidget(page: Page, title: string, visualization: string, text: string) {
  await page.getByRole("button", { name: "Add a widget" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("combobox", { name: "Visualization" }).selectOption(visualization);
  await dialog.getByRole("textbox", { name: "Query" }).fill(text);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
}

function widget(page: Page, title: string) {
  return page.getByRole("region", { name: title, exact: true });
}

test("the Monitor nav links to Dashboards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboards" }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole("heading", { name: "Dashboards", level: 1 })).toBeVisible();
});

test("an editor builds a Dashboard with one Widget of each Visualization, and it reloads as saved", async ({
  page,
}) => {
  const name = unique("Every visualization");
  await createDashboard(page, name);
  await expect(page.getByText("No widgets.")).toBeVisible();

  await addWidget(page, "Fridge temperature", "line", `${fridge} | range last 15m`);
  await addWidget(page, "Fridge now", "stat", `${fridge} | range last 15m | rollup last every all`);
  await addWidget(page, "Fridge readings", "table", `${fridge} | range last 15m`);
  await addWidget(page, "Trains", "map", "locations | range last 2m");
  await addWidget(page, "Recent events", "events", "events | range last 6h");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

  await expect(widget(page, "Fridge temperature").getByRole("figure", { name: "Fridge temperature chart" })).toBeVisible();
  await expect(widget(page, "Fridge temperature").getByText("fridge-1 · temperature").first()).toBeVisible();
  // Its range ends now, so new Readings stream in.
  await expect(widget(page, "Fridge temperature").getByText("Live", { exact: true })).toBeVisible();
  await expect(widget(page, "Fridge now").getByRole("figure", { name: "Fridge now" })).toContainText(/\d/);
  await expect(widget(page, "Fridge readings").getByRole("table")).toContainText("temperature");
  await expect(widget(page, "Trains").getByRole("figure", { name: "Trains map" })).toBeVisible();
  await expect(widget(page, "Recent events").getByRole("list", { name: "Recent events" }).getByRole("listitem").first()).toBeVisible();

  // Each Widget sits where the grid put it: the first two share a row.
  const line = await widget(page, "Fridge temperature").boundingBox();
  const stat = await widget(page, "Fridge now").boundingBox();
  expect(line && stat && Math.abs(line.y - stat.y) < 2 && stat.x > line.x).toBe(true);

  // The list shows it with its owner, shared flag and last save.
  await page.goto("/dashboards");
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("You");
  await expect(row).toContainText("Private");
  await expect(row.getByRole("cell").last()).toHaveText(/\d{4}/);
  await row.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
});

test("saving with a bad Widget Query marks that Widget and keeps the edit", async ({ page }) => {
  const name = unique("Bad widget");
  await createDashboard(page, name);
  await addWidget(page, "Good one", "line", `${fridge} | range last 15m`);
  await addWidget(page, "Broken one", "table", "measurements\n| wher metric == temperature");

  await page.getByRole("button", { name: "Save" }).click();

  const broken = widget(page, "Broken one");
  await expect(broken.getByRole("alert").first()).toContainText('unknown stage "wher"');
  await expect(widget(page, "Good one").getByRole("alert")).toHaveCount(0);
  // Still editing, nothing lost.
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  await broken.getByRole("button", { name: "Edit Broken one" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit widget" });
  await expect(dialog.getByRole("alert")).toContainText('Line 2, column 3: unknown stage "wher"');
  await expect(dialog.locator(".cm-lintRange-error")).toHaveText("wher");
});

test("one failing Widget doesn't affect the others; a too costly one suggests a shorter range", async ({ page }) => {
  const name = unique("Failing widget");
  await createDashboard(page, name);
  await addWidget(page, "Too long", "line", "measurements | range last 40d");
  await addWidget(page, "Fine", "table", `${fridge} | range last 15m`);

  await expect(widget(page, "Too long")).toContainText("Try a shorter range");
  await expect(widget(page, "Fine").getByRole("table")).toContainText("temperature");
});

test("a Widget with nothing to show says so", async ({ page }) => {
  const name = unique("Empty widget");
  await createDashboard(page, name);
  await addWidget(page, "Nothing", "table", 'measurements | where asset == "no such asset here" | range last 5m');
  await expect(widget(page, "Nothing")).toContainText("No Readings match.");
});

test("a name is checked before sending", async ({ page }) => {
  await page.goto("/dashboards");
  await page.getByRole("button", { name: "Create Dashboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Dashboard" });
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Give the Dashboard a name.");
  await dialog.getByRole("textbox", { name: "Name" }).fill("x".repeat(201));
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("A name is at most 200 characters.");
});

test("a Dashboard that doesn't exist says so", async ({ page }) => {
  await page.goto("/dashboards/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByText("This Dashboard doesn't exist, or isn't yours to see.")).toBeVisible();
});

const api = process.env.VITE_RIDR_API_URL || "http://localhost:18095";
const adminToken = process.env.VITE_RIDR_DEV_TOKEN || "dev-user-token";
const editorToken = "dev-editor-token";

async function call(request: APIRequestContext, path: string, data: object, token: string) {
  const response = await request.post(`${api}/ridr.v1.${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}

test("a shared Dashboard shows each viewer their own Units, without changing the saved Query", async ({
  page,
  request,
}) => {
  // The dev editor (editor@localhost) prefers °F; the dev admin owns and
  // shares the Dashboard.
  // Inviting a user who is already a member is refused; that's fine.
  await request.post(`${api}/ridr.v1.AccessService/InviteUser`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: "editor@localhost", role: "ROLE_EDITOR" },
  });
  await call(request, "AccessService/GetMe", {}, editorToken);
  await call(request, "PreferenceService/SetUnitPreference", { quantityKind: "temperature", unit: "[degF]" }, editorToken);
  const text = `${fridge} | range last 15m`;
  const { dashboard } = await call(
    request,
    "DashboardService/CreateDashboard",
    {
      name: unique("Units per viewer"),
      widgets: [{ title: "Fridge", visualization: "table", query: { text }, layout: { x: 0, y: 0, width: 6, height: 4 } }],
    },
    adminToken,
  );
  await call(request, "DashboardService/ShareDashboard", { dashboardId: dashboard.id, shared: true }, adminToken);

  try {
    await page.route(`${api}/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${editorToken}` } }),
    );
    await page.goto(`/dashboards/${dashboard.id}`);
    const table = widget(page, "Fridge").getByRole("table");
    await expect(table.getByRole("cell", { name: /°F$/ }).first()).toBeVisible();
    await expect(table.getByRole("cell", { name: /°C$/ })).toHaveCount(0);

    const saved = await call(request, "DashboardService/GetDashboard", { dashboardId: dashboard.id }, adminToken);
    expect(saved.dashboard.widgets[0].query.text).toBe(text);
  } finally {
    await call(request, "PreferenceService/ClearUnitPreference", { quantityKind: "temperature" }, editorToken);
  }
});
