import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { callAs, expect, test, users } from "./users";

// The visual query builder, in the Dashboard Widget editor and in Explore.
// Each test drives its own fleet: a new Adapter (a data source) whose one
// Device, assigned to a new Asset, reports a temperature, a position and
// an Event, so answers arrive on cue without demo data. Tests retire their
// Adapter and delete their Dashboards when done.

// A Controlled key the tests share, declared once, so reruns don't leave
// a new key each time.
const zoneKey = "e2e_qb_zone";
const zones = ["north", "south"];

type Fleet = {
  stamp: string;
  adapterId: string;
  adapterName: string;
  assetName: string;
  deviceId: string;
  route: string;
  report: () => Promise<unknown>;
  retire: () => Promise<unknown>;
};

async function fleet(request: APIRequestContext): Promise<Fleet> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const deviceId = `qb-truck-${stamp}`;
  const route = `r${stamp}`;
  const adapterName = `QB source ${stamp}`;
  const { adapter, ingestKey } = await callAs<{ adapter: { id: string }; ingestKey: { plaintext: string } }>(
    request,
    "AdapterService/RegisterAdapter",
    { name: adapterName },
  );
  const report = () => {
    const deviceTime = new Date().toISOString();
    return callAs(
      request,
      "IngestService/Ingest",
      {
        measurements: [{ deviceId, metric: "temperature", value: 21.5, unit: "Cel", deviceTime, tags: { route } }],
        locations: [{ deviceId, deviceTime, latitude: 60.1699, longitude: 24.9384, tags: { route } }],
        events: [{ deviceId, deviceTime, name: "door_opened", tags: { route } }],
      },
      ingestKey.plaintext,
    );
  };
  await declareZones(request);
  const { asset } = await callAs<{ asset: { id: string; name: string } }>(request, "RegistryService/CreateAsset", {
    name: `QB truck ${stamp}`,
    attributes: { [zoneKey]: "north" },
  });
  // Ridr registers the Device as it stores its first Reading.
  await report();
  await expect
    .poll(async () => (await callAs<{ health: string }>(request, "RegistryService/GetDeviceHealth", { deviceId })).health)
    .not.toBe("DEVICE_HEALTH_NEVER_SEEN");
  await callAs(request, "RegistryService/AssignDevice", { deviceId, assetId: asset.id });
  // Readings count for the Asset only from the Assignment on.
  await report();
  // Wait until Ridr has stored them, so a test's first answer holds them.
  for (const source of ["measurements", "locations", "events"]) {
    await expect
      .poll(async () => {
        const answer = await callAs<{ readings?: unknown[] }>(request, "QueryService/RunQuery", {
          text: `${source} | where asset == "${asset.name}" | range last 15m`,
        });
        return answer.readings?.length ?? 0;
      })
      .toBeGreaterThan(0);
  }
  return {
    stamp,
    adapterId: adapter.id,
    adapterName,
    assetName: asset.name,
    deviceId,
    route,
    report,
    retire: () => callAs(request, "AdapterService/RetireAdapter", { adapterId: adapter.id }),
  };
}

async function declareZones(request: APIRequestContext) {
  const { controlledKeys } = await callAs<{ controlledKeys?: { key: string }[] }>(
    request,
    "RegistryService/ListControlledKeys",
    {},
  );
  if ((controlledKeys ?? []).some((controlled) => controlled.key === zoneKey)) {
    await callAs(request, "RegistryService/AddAllowedValues", { key: zoneKey, values: zones });
  } else {
    await callAs(request, "RegistryService/DeclareControlledKey", { key: zoneKey, allowedValues: zones });
  }
}

// it is test with its own fleet, retired after the test.
const it = test.extend<{ trucks: Fleet }>({
  trucks: async ({ request }, provide) => {
    const made = await fleet(request);
    await provide(made);
    await made.retire();
  },
});

// Dashboards a test made, deleted after it.
const made: string[] = [];
test.afterEach(async ({ request }) => {
  for (const dashboardId of made.splice(0)) {
    await callAs(request, "DashboardService/DeleteDashboard", { dashboardId });
  }
});

async function createDashboard(page: Page, name: string) {
  await page.goto("/dashboards");
  await page.getByRole("button", { name: "Create Dashboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Dashboard" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  made.push(new URL(page.url()).pathname.split("/").at(-1)!);
}

// reopen opens the Dashboard afresh from the list, and edits it.
async function reopen(page: Page) {
  const name = await page.getByRole("heading", { level: 1 }).innerText();
  await page.goto("/dashboards");
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
}

function widget(page: Page, title: string) {
  return page.getByRole("region", { name: title, exact: true });
}

function builder(scope: Page | Locator) {
  return scope.getByRole("group", { name: "Query builder" });
}

// addCondition adds a condition to the builder and returns it.
async function addCondition(scope: Locator, kind: string) {
  await scope.getByRole("button", { name: "Add a condition" }).click();
  const condition = scope.getByRole("group", { name: /^Condition \d+$/ }).last();
  await condition.getByRole("combobox", { name: "Filter by" }).selectOption(kind);
  return condition;
}

async function blankWidget(page: Page, title: string, visualization: string) {
  await page.getByRole("button", { name: "Add a widget" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  await dialog.getByRole("button", { name: "Blank widget" }).click();
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("combobox", { name: "Visualization" }).selectOption(visualization);
  return dialog;
}

it("a line Widget is built through the builder alone, saved, and draws its answer", async ({ page, trucks }) => {
  await createDashboard(page, `Builder line ${trucks.stamp}`);
  const dialog = await blankWidget(page, "Truck temperature", "line");
  const built = builder(dialog);
  await built.getByRole("combobox", { name: "Metric" }).selectOption("temperature");
  const asset = await addCondition(built, "Asset");
  await asset.getByRole("combobox", { name: "Asset" }).selectOption(trucks.assetName);
  await built.getByRole("combobox", { name: "Range" }).selectOption("15m");

  const text = dialog.getByRole("region", { name: "Query text" });
  await expect(text).toContainText(`where metric == temperature and asset == "${trucks.assetName}"`);
  await expect(text).toContainText("range last 15m");

  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(
    widget(page, "Truck temperature").getByRole("figure", { name: "Truck temperature chart" }),
  ).toBeVisible();
  await expect(widget(page, "Truck temperature").getByText(`${trucks.deviceId} · temperature`).first()).toBeVisible();
});

it("stat, table, map and events Widgets are built through the builder alone, and each draws its answer", async ({
  page,
  trucks,
}) => {
  // Four Widgets, each built option by option.
  it.slow();
  await createDashboard(page, `Builder every kind ${trucks.stamp}`);

  // A stat: the latest temperature, summarised over the whole range.
  let dialog = await blankWidget(page, "Truck now", "stat");
  let built = builder(dialog);
  await expect(built).toContainText("Measurements");
  await built.getByRole("combobox", { name: "Metric" }).selectOption("temperature");
  await (await addCondition(built, "Device")).getByRole("combobox", { name: "Device" }).fill(trucks.deviceId);
  await built.getByRole("radio", { name: "Summarise every bucket" }).check();
  await built.getByRole("checkbox", { name: "avg" }).uncheck();
  await built.getByRole("checkbox", { name: "last" }).check();
  await built.getByRole("combobox", { name: "Bucket" }).selectOption("all");
  await expect(dialog.getByRole("region", { name: "Query text" })).toContainText("| rollup last every all");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  // A table of the data source's Readings.
  dialog = await blankWidget(page, "Truck readings", "table");
  built = builder(dialog);
  await (await addCondition(built, "Data source"))
    .getByRole("combobox", { name: "Data source" })
    .selectOption({ label: trucks.adapterName });
  await built.getByRole("combobox", { name: "Range" }).selectOption("15m");
  await expect(dialog.getByRole("region", { name: "Query text" })).toContainText(
    // Bare when the ID is a plain word, quoted when it starts with a digit.
    new RegExp(`adapter == "?${trucks.adapterId}"?`),
  );
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  // A map reads Locations: no Metric, no summarising, short ranges.
  dialog = await blankWidget(page, "Truck map", "map");
  built = builder(dialog);
  await expect(built).toContainText("Locations");
  await expect(built.getByRole("combobox", { name: "Metric" })).toHaveCount(0);
  await expect(built.getByRole("radio", { name: "Summarise every bucket" })).toHaveCount(0);
  await expect(built).toContainText("only Measurements can be summarised");
  await expect(built).toContainText("a short range keeps the answer small");
  const tag = await addCondition(built, "Tag");
  await tag.getByRole("textbox", { name: "Tag key" }).fill("route");
  await tag.getByRole("textbox", { name: "Tag value" }).fill(trucks.route);
  await expect(built).toContainText("at most 31 days");
  await built.getByRole("combobox", { name: "Range" }).selectOption("15m");
  await expect(dialog.getByRole("region", { name: "Query text" })).toContainText(
    `locations\n| where tag.route == ${trucks.route}\n| range last 15m`,
  );
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  // Events of the Asset's Attribute: the Controlled key offers only its values.
  dialog = await blankWidget(page, "Truck events", "events");
  built = builder(dialog);
  await expect(built).toContainText("Events");
  const zone = await addCondition(built, "Attribute");
  await zone.getByRole("combobox", { name: "Attribute key" }).selectOption(zoneKey);
  await expect(zone.getByRole("combobox", { name: "Attribute value" }).getByRole("option")).toHaveText([
    "Choose…",
    ...zones,
  ]);
  await zone.getByRole("combobox", { name: "Attribute value" }).selectOption("north");
  await (await addCondition(built, "Asset")).getByRole("combobox", { name: "Asset" }).selectOption(trucks.assetName);
  await expect(dialog.getByRole("region", { name: "Query text" })).toContainText(
    `events\n| where asset.${zoneKey} == north and asset == "${trucks.assetName}"`,
  );
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(widget(page, "Truck now").getByRole("figure", { name: "Truck now" })).toContainText("21.5");
  await expect(widget(page, "Truck readings").getByRole("table")).toContainText("temperature");
  await expect(widget(page, "Truck map").getByRole("figure", { name: "Truck map map" })).toBeVisible();
  await expect(widget(page, "Truck events").getByRole("list", { name: "Truck events" })).toContainText("door_opened");
});

it("Edit as text and back restores every option; a Query the builder can't show stays as text and says why", async ({
  page,
  trucks,
}) => {
  it.slow();
  await createDashboard(page, `Builder round trip ${trucks.stamp}`);
  const dialog = await blankWidget(page, "Round trip", "line");
  let built = builder(dialog);
  await built.getByRole("combobox", { name: "Metric" }).selectOption("temperature");
  const zone = await addCondition(built, "Attribute");
  await zone.getByRole("combobox", { name: "Attribute key" }).selectOption(zoneKey);
  await zone.getByRole("combobox", { name: "Attribute value" }).selectOption("north");
  const tag = await addCondition(built, "Tag");
  await tag.getByRole("textbox", { name: "Tag key" }).fill("route");
  await tag.getByRole("textbox", { name: "Tag value" }).fill(trucks.route);
  await (await addCondition(built, "Device")).getByRole("combobox", { name: "Device" }).fill(trucks.deviceId);
  await (await addCondition(built, "Data source"))
    .getByRole("combobox", { name: "Data source" })
    .selectOption({ label: trucks.adapterName });
  await built.getByRole("combobox", { name: "Range" }).selectOption("Between two times…");
  const from = await built.getByLabel("From").inputValue();
  const to = await built.getByLabel("To").inputValue();
  await built.getByRole("radio", { name: "Summarise every bucket" }).check();
  await built.getByRole("checkbox", { name: "max" }).check();
  await built.getByRole("combobox", { name: "Bucket" }).selectOption("15m");
  await built.getByRole("checkbox", { name: "Asset" }).check();
  await built.getByRole("combobox", { name: "Unit" }).selectOption("[degF]");
  await built.getByRole("spinbutton", { name: "Limit" }).fill("50");
  const text = await dialog.getByRole("region", { name: "Query text" }).locator("pre").innerText();

  await dialog.getByRole("button", { name: "Edit as text" }).click();
  await expect(dialog.getByRole("textbox", { name: "Query" })).toContainText("rollup avg, max every 15m by asset");
  await dialog.getByRole("button", { name: "Use the builder" }).click();

  built = builder(dialog);
  await expect(built.getByRole("combobox", { name: "Metric" })).toHaveValue("temperature");
  const conditions = built.getByRole("group", { name: /^Condition \d+$/ });
  await expect(conditions).toHaveCount(4);
  await expect(conditions.nth(0).getByRole("combobox", { name: "Attribute key" })).toHaveValue(zoneKey);
  await expect(conditions.nth(0).getByRole("combobox", { name: "Attribute value" })).toHaveValue("north");
  await expect(conditions.nth(1).getByRole("textbox", { name: "Tag key" })).toHaveValue("route");
  await expect(conditions.nth(1).getByRole("textbox", { name: "Tag value" })).toHaveValue(trucks.route);
  await expect(conditions.nth(2).getByRole("combobox", { name: "Device" })).toHaveValue(trucks.deviceId);
  await expect(conditions.nth(3).getByRole("combobox", { name: "Data source" })).toHaveValue(trucks.adapterId);
  await expect(built.getByLabel("From")).toHaveValue(from);
  await expect(built.getByLabel("To")).toHaveValue(to);
  await expect(built.getByRole("checkbox", { name: "avg" })).toBeChecked();
  await expect(built.getByRole("checkbox", { name: "max" })).toBeChecked();
  await expect(built.getByRole("combobox", { name: "Bucket" })).toHaveValue("15m");
  await expect(built.getByRole("checkbox", { name: "Asset" })).toBeChecked();
  await expect(built.getByRole("combobox", { name: "Unit" })).toHaveValue("[degF]");
  await expect(built.getByRole("spinbutton", { name: "Limit" })).toHaveValue("50");
  await expect(dialog.getByRole("region", { name: "Query text" }).locator("pre")).toHaveText(text);

  // Several values for one field is more than the builder shows.
  await dialog.getByRole("button", { name: "Edit as text" }).click();
  await dialog.getByRole("textbox", { name: "Query" }).fill(
    `measurements | where asset in ("${trucks.assetName}", other) | range last 1h`,
  );
  await dialog.getByRole("button", { name: "Use the builder" }).click();
  await expect(dialog.getByRole("status")).toContainText("This Query stays as text");
  await expect(dialog.getByRole("status")).toContainText("asset against several values");
  await expect(builder(dialog)).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: "Query" })).toContainText("asset in");

  // Saved, it reopens as text, still saying why.
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await reopen(page);
  await widget(page, "Round trip").getByRole("button", { name: "Edit Round trip" }).click();
  const edit = page.getByRole("dialog", { name: "Edit widget" });
  await expect(edit.getByRole("status")).toContainText("asset against several values");
  await expect(edit.getByRole("textbox", { name: "Query" })).toContainText("asset in");
});

it("a saved Widget the builder can show opens in the builder, with its options", async ({ page, trucks }) => {
  await createDashboard(page, `Builder reopen ${trucks.stamp}`);
  const dialog = await blankWidget(page, "Reopened", "table");
  await builder(dialog).getByRole("combobox", { name: "Metric" }).selectOption("temperature");
  await (await addCondition(builder(dialog), "Asset")).getByRole("combobox", { name: "Asset" }).selectOption(trucks.assetName);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(widget(page, "Reopened").getByRole("table")).toContainText("temperature");

  await reopen(page);
  await widget(page, "Reopened").getByRole("button", { name: "Edit Reopened" }).click();
  const built = builder(page.getByRole("dialog", { name: "Edit widget" }));
  await expect(built.getByRole("combobox", { name: "Metric" })).toHaveValue("temperature");
  await expect(built.getByRole("group", { name: "Condition 1" }).getByRole("combobox", { name: "Asset" })).toHaveValue(
    trucks.assetName,
  );
});

it("the four templates open the builder filled in, and each makes a working Widget", async ({ page, trucks }) => {
  it.slow();
  await createDashboard(page, `Builder templates ${trucks.stamp}`);
  const fromTemplate = async (template: string, visualization: string) => {
    await page.getByRole("button", { name: "Add a widget" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a widget" });
    await dialog.getByRole("button", { name: template }).click();
    await expect(dialog.getByRole("combobox", { name: "Visualization" })).toHaveValue(visualization);
    // Narrowed to this test's truck, so other Devices don't crowd it out.
    await (await addCondition(builder(dialog), "Device")).getByRole("combobox", { name: "Device" }).fill(trucks.deviceId);
    return dialog;
  };

  let dialog = await fromTemplate("Live map of a fleet", "map");
  await expect(builder(dialog).getByRole("combobox", { name: "Range" })).toHaveValue("2m");
  await dialog.getByRole("textbox", { name: "Title" }).fill("Template map");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  dialog = await fromTemplate("One Metric over time", "line");
  await expect(builder(dialog).getByRole("combobox", { name: "Metric" })).toHaveValue("temperature");
  await expect(builder(dialog).getByRole("radio", { name: "Summarise every bucket" })).toBeChecked();
  await dialog.getByRole("textbox", { name: "Title" }).fill("Template line");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  dialog = await fromTemplate("Latest value", "stat");
  await expect(builder(dialog).getByRole("checkbox", { name: "last" })).toBeChecked();
  await dialog.getByRole("textbox", { name: "Title" }).fill("Template stat");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  dialog = await fromTemplate("Recent events", "events");
  await dialog.getByRole("textbox", { name: "Title" }).fill("Template events");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(widget(page, "Template map").getByRole("figure", { name: "Template map map" })).toBeVisible();
  await expect(widget(page, "Template line").getByRole("figure", { name: "Template line chart" })).toBeVisible();
  await expect(widget(page, "Template stat").getByRole("figure", { name: "Template stat" })).toContainText("21.5");
  await expect(widget(page, "Template events").getByRole("list", { name: "Template events" })).toContainText(
    "door_opened",
  );
});

it.describe("in Explore, as an editor whose Unit preference for temperature is °F", () => {
  it.use({ user: "editor" });
  it.beforeEach(async ({ request }) => {
    await callAs(request, "PreferenceService/SetUnitPreference", { quantityKind: "temperature", unit: "[degF]" }, users.editor.token);
  });
  it.afterEach(async ({ request }) => {
    await callAs(request, "PreferenceService/ClearUnitPreference", { quantityKind: "temperature" }, users.editor.token);
  });

  it("the same builder writes the Query, which runs and stays in the URL; the Unit starts on the preference", async ({
    page,
    request,
    trucks,
  }) => {
    await page.goto("/explore");
    const built = builder(page);
    await built.getByRole("radio", { name: "Locations" }).check();
    await expect(built.getByRole("combobox", { name: "Metric" })).toHaveCount(0);
    await built.getByRole("radio", { name: "Measurements" }).check();
    await built.getByRole("combobox", { name: "Metric" }).selectOption("temperature");

    // Only Units of temperature's Quantity kind, starting on the preference.
    const unit = built.getByRole("combobox", { name: "Unit" });
    await expect(unit).toHaveValue("");
    await expect(unit.getByRole("option").first()).toHaveText("Your Unit preference (°F)");
    const { units } = await callAs<{ units: { code: string; quantityKind: string }[] }>(request, "CatalogService/ListUnits", {});
    const temperatures = units.filter((one) => one.quantityKind === "temperature").map((one) => one.code);
    const offered = await unit.getByRole("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter((value) => value !== ""),
    );
    expect(offered.toSorted()).toEqual(temperatures.toSorted());

    await (await addCondition(built, "Asset")).getByRole("combobox", { name: "Asset" }).selectOption(trucks.assetName);
    await built.getByRole("radio", { name: "Raw values" }).check();
    await built.getByRole("combobox", { name: "Range" }).selectOption("15m");
    await expect(page.getByRole("region", { name: "Query text" })).toContainText("| unit [degF]");
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page).toHaveURL(/[?&]q=.*unit/);
    await page.getByRole("tab", { name: "Table" }).click();
    await expect(page.getByRole("table", { name: "Query answer" }).getByRole("cell", { name: /°F$/ }).first()).toBeVisible();

    // The URL brings the builder back as it was.
    await page.reload();
    await expect(builder(page).getByRole("combobox", { name: "Metric" })).toHaveValue("temperature");
    await expect(builder(page).getByRole("combobox", { name: "Unit" })).toHaveValue("");
    await expect(
      builder(page).getByRole("group", { name: "Condition 1" }).getByRole("combobox", { name: "Asset" }),
    ).toHaveValue(trucks.assetName);
  });
});

it("an Explore Query the builder can't show opens as text, and says why", async ({ page, trucks }) => {
  await page.goto(`/explore?q=${encodeURIComponent(`events | where name == door_opened and device == "${trucks.deviceId}"`)}`);
  await expect(page.getByRole("status").filter({ hasText: "stays as text" })).toContainText("filters Events by name");
  await expect(page.getByRole("textbox", { name: "Query" })).toContainText("name == door_opened");
  await expect(builder(page)).toHaveCount(0);
  // It still runs as written.
  await expect(page.getByRole("region", { name: "Answer" })).toContainText("door_opened");
});
