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
  await dialog.getByRole("button", { name: "Blank widget" }).click();
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("combobox", { name: "Visualization" }).selectOption(visualization);
  // These tests write the Query as text; the query builder has its own tests.
  await dialog.getByRole("button", { name: "Edit as text" }).click();
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

// dashboardAt makes a Dashboard through the API, owned by the dev admin,
// with one table Widget per title.
async function dashboardAt(request: APIRequestContext, name: string, titles: string[]) {
  const { dashboard } = await call(
    request,
    "DashboardService/CreateDashboard",
    { name, widgets: titles.map((title) => tableWidget(title)) },
    adminToken,
  );
  return dashboard as { id: string; version: number };
}

function tableWidget(title: string) {
  return {
    title,
    visualization: "table",
    query: { text: `${fridge} | range last 15m` },
    layout: { x: 0, y: 0, width: 6, height: 4 },
  };
}

test("a stale save shows the conflict, keeps the edit, and can save on top", async ({ browser, request }) => {
  const name = unique("Conflict");
  const { id } = await dashboardAt(request, name, ["First"]);

  const mine = await (await browser.newContext()).newPage();
  const theirs = await (await browser.newContext()).newPage();
  for (const page of [mine, theirs]) {
    await page.goto(`/dashboards/${id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
  }

  await theirs.getByRole("textbox", { name: "Name" }).fill(`${name} theirs`);
  await theirs.getByRole("button", { name: "Save" }).click();
  await expect(theirs.getByText(/version 2,/)).toBeVisible();

  await mine.getByRole("textbox", { name: "Name" }).fill(`${name} mine`);
  await mine.getByRole("button", { name: "Save" }).click();
  const conflict = mine.getByRole("alert").filter({ hasText: "Someone saved a newer version" });
  await expect(conflict).toBeVisible();
  await expect(mine.getByRole("textbox", { name: "Name" })).toHaveValue(`${name} mine`);

  await conflict.getByRole("button", { name: "Save on top" }).click();
  await expect(mine.getByRole("heading", { name: `${name} mine`, level: 1 })).toBeVisible();
  await expect(mine.getByText(/version 3,/)).toBeVisible();
});

test("after a conflict, reloading drops the edit and shows the newer version", async ({ page, request }) => {
  const name = unique("Reload conflict");
  const { id } = await dashboardAt(request, name, ["First"]);
  await page.goto(`/dashboards/${id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(`${name} mine`);

  await call(
    request,
    "DashboardService/SaveDashboard",
    { dashboardId: id, baseVersion: 1, name: `${name} theirs`, widgets: [tableWidget("First")] },
    adminToken,
  );

  await page.getByRole("button", { name: "Save" }).click();
  const conflict = page.getByRole("alert").filter({ hasText: "Someone saved a newer version" });
  await conflict.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: `${name} theirs`, level: 1 })).toBeVisible();
  await expect(page.getByText(/version 2,/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
});

test("version history opens an earlier version read-only, and an editor restores it", async ({ page, request }) => {
  const name = unique("Versions");
  const { id } = await dashboardAt(request, name, ["Old widget"]);
  await call(
    request,
    "DashboardService/SaveDashboard",
    { dashboardId: id, baseVersion: 1, name: `${name} v2`, widgets: [tableWidget("New widget")] },
    adminToken,
  );

  await page.goto(`/dashboards/${id}`);
  await page.getByRole("button", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history.getByRole("link", { name: /Version 1/ }).click();

  await expect(page).toHaveURL(new RegExp(`/dashboards/${id}\\?version=1$`));
  await expect(page.getByText("Version 1 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(widget(page, "Old widget")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboards/${id}$`));
  await expect(page.getByText(/version 3,/)).toBeVisible();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(widget(page, "Old widget")).toBeVisible();
});

test("the owner shares a Dashboard and makes it private again; others see no Share", async ({ page, request }) => {
  const name = unique("Sharing");
  const { id } = await dashboardAt(request, name, ["First"]);

  await page.goto(`/dashboards/${id}`);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText(/^Shared with the Organisation/)).toBeVisible();
  await page.getByRole("button", { name: "Make private" }).click();
  await expect(page.getByText(/^Private/)).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText(/^Shared with the Organisation/)).toBeVisible();

  // The dev editor sees the shared Dashboard but may not share it.
  await request.post(`${api}/ridr.v1.AccessService/InviteUser`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: "editor@localhost", role: "ROLE_EDITOR" },
  });
  await call(request, "AccessService/GetMe", {}, editorToken);
  const editor = await (await page.context().browser()!.newContext()).newPage();
  await editor.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${editorToken}` } }),
  );
  await editor.goto(`/dashboards/${id}`);
  await expect(editor.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Make private" })).toHaveCount(0);
});

test("an editor deletes a Dashboard after confirming, and it is gone", async ({ page, request }) => {
  const name = unique("Delete me");
  const { id } = await dashboardAt(request, name, ["First"]);

  await page.goto(`/dashboards/${id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this Dashboard?" });
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole("heading", { name: "Dashboards", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name })).toHaveCount(0);

  await page.goto(`/dashboards/${id}`);
  await expect(page.getByText("This Dashboard doesn't exist, or isn't yours to see.")).toBeVisible();
});
