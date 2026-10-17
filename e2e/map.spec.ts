import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminToken, api } from "./users";

// The map of Locations in Explore. Each test drives its own vehicle, so
// positions arrive on cue rather than whenever a demo ship reports.

async function call<T>(request: APIRequestContext, method: string, data: object, token = adminToken): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

// vehicle makes an Asset whose one Device (from a new Adapter) has
// reported a position in Helsinki, and returns the Query for its
// Locations, its Device ID, and moveTo to report another position.
async function vehicle(request: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const deviceId = `e2e-van-${stamp}`;
  const { adapter, ingestKey } = await call<{ adapter: { id: string }; ingestKey: { plaintext: string } }>(
    request,
    "AdapterService/RegisterAdapter",
    { name: `e2e-map-${stamp}` },
  );
  const moveTo = (latitude: number, longitude: number) =>
    call(
      request,
      "IngestService/Ingest",
      { locations: [{ deviceId, deviceTime: new Date().toISOString(), latitude, longitude }] },
      ingestKey.plaintext,
    );
  const { asset } = await call<{ asset: { id: string; name: string } }>(request, "RegistryService/CreateAsset", {
    name: `Map van ${stamp}`,
  });
  // Ridr registers the Device as it stores its first Reading.
  await moveTo(60.1699, 24.9384);
  await expect
    .poll(async () => (await call<{ health: string }>(request, "RegistryService/GetDeviceHealth", { deviceId })).health)
    .not.toBe("DEVICE_HEALTH_NEVER_SEEN");
  await call(request, "RegistryService/AssignDevice", { deviceId, assetId: asset.id });
  // Readings count for the Asset only from the Assignment on, so report
  // the position again.
  await moveTo(60.1699, 24.9384);
  return {
    deviceId,
    query: `locations | where asset == "${asset.name}" | range last 1h`,
    moveTo,
    retire: () => call(request, "AdapterService/RetireAdapter", { adapterId: adapter.id }),
  };
}

function map(page: Page) {
  return page.getByRole("figure", { name: "Query answer map" });
}

// The base map's canvas; a live map draws its vehicles on a second one.
function baseCanvas(page: Page) {
  return map(page).locator("canvas").first();
}

// brightness is how light the drawn map looks, from 0 (black) to 255.
async function brightness(page: Page): Promise<number> {
  const png = (await baseCanvas(page).screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    return sum / (pixels.length / 4);
  }, png);
}

test("a locations Query draws a vehicle on the map", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);

    await expect(page.getByRole("tab", { name: "Map", selected: true })).toBeVisible();
    await expect(page.getByText("so keep the range short")).toBeVisible();
    await expect(baseCanvas(page)).toBeVisible();
    await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });

    await map(page).getByText("Show as list").click();
    const latest = map(page).getByRole("list", { name: "Latest positions" });
    await expect(latest.getByRole("listitem").filter({ hasText: van.deviceId })).toContainText("60.1699° N, 24.9384° E");
  } finally {
    await van.retire();
  }
});

test("live Locations move the vehicle without redrawing the map", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);
    await expect(page.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();
    await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    // Mark the map's canvas: a map rebuilt for new data would lose the mark.
    await baseCanvas(page).evaluate((canvas) => canvas.setAttribute("data-first", ""));

    await map(page).getByText("Show as list").click();
    const position = map(page)
      .getByRole("list", { name: "Latest positions" })
      .getByRole("listitem")
      .filter({ hasText: van.deviceId });
    await expect(position).toContainText("60.1699° N, 24.9384° E");

    await van.moveTo(60.171, 24.9412);
    await expect(position).toContainText("60.1710° N, 24.9412° E", { timeout: 15_000 });
    await expect(map(page).locator("canvas[data-first]")).toHaveCount(1);
  } finally {
    await van.retire();
  }
});

test("the map follows the light and dark theme", async ({ page, request }) => {
  const van = await vehicle(request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);
  await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  expect(await brightness(page)).toBeLessThan(100);

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();

  await expect.poll(() => brightness(page), { timeout: 20_000 }).toBeGreaterThan(150);
  expect(errors).toEqual([]);
  await van.retire();
});

test("without a Google Maps key, maps use the keyless base map and never ask Google", async ({ page, request }) => {
  const van = await vehicle(request);
  const google: string[] = [];
  page.on("request", (sent) => {
    if (/googleapis\.com|gstatic\.com\/maps/.test(sent.url())) google.push(sent.url());
  });
  try {
    await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);
    await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    await expect(map(page).getByText("OpenStreetMap").first()).toBeAttached();
    expect(google).toEqual([]);
  } finally {
    await van.retire();
  }
});
