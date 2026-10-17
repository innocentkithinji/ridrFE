import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminToken, api } from "./users";

// A live map stays live once it is, however many Readings stream into
// it, and its viewer may pause it: on a Dashboard Widget and on Home. Each
// test makes its own fleet and Dashboard, and removes both.

async function call<T>(request: APIRequestContext, method: string, data: object, token = adminToken): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

// fleetOnDashboard makes a fleet of ten vehicles that has already
// reported `history` Locations in the last minute, and a Dashboard with
// one live map Widget of it. report sends one more Location per vehicle.
async function fleetOnDashboard(request: APIRequestContext, history: number) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { adapter, ingestKey } = await call<{ adapter: { id: string }; ingestKey: { plaintext: string } }>(
    request,
    "AdapterService/RegisterAdapter",
    { name: `e2e-live-widgets-${stamp}` },
  );
  const ingest = (locations: object[]) =>
    call(request, "IngestService/Ingest", { locations }, ingestKey.plaintext);
  const location = (vehicle: number, at: Date, step: number) => ({
    deviceId: `e2e-car-${vehicle}-${stamp}`,
    deviceTime: at.toISOString(),
    latitude: 60.17 + vehicle * 0.01 + step * 0.0001,
    longitude: 24.94,
  });
  // Ridr takes 250 Readings a second from one Adapter, so the history
  // goes in batches of 200, a second apart.
  const start = Date.now() - 60_000;
  const all = Array.from({ length: history }, (_, i) =>
    location(i % 10, new Date(start + Math.floor(i / 10) * 500), Math.floor(i / 10)),
  );
  for (let i = 0; i < all.length; i += 200) {
    await ingest(all.slice(i, i + 200));
    await new Promise((resolve) => setTimeout(resolve, 1_100));
  }
  let step = Math.ceil(history / 10);
  const report = () => {
    step++;
    return ingest(Array.from({ length: 10 }, (_, vehicle) => location(vehicle, new Date(), step)));
  };

  const title = `Cars ${stamp}`;
  const { dashboard } = await call<{ dashboard: { id: string } }>(request, "DashboardService/CreateDashboard", {
    name: `e2e live widgets ${stamp}`,
    widgets: [
      {
        title,
        visualization: "map",
        query: { text: `locations | where adapter == "${adapter.id}" | range last 5m` },
        layout: { x: 0, y: 0, width: 12, height: 8 },
      },
    ],
  });
  return {
    title,
    path: `/dashboards/${dashboard.id}`,
    report,
    remove: async () => {
      await call(request, "DashboardService/DeleteDashboard", { dashboardId: dashboard.id });
      await call(request, "AdapterService/RetireAdapter", { adapterId: adapter.id });
    },
  };
}

function widget(page: Page, title: string) {
  return page.getByRole("region", { name: title, exact: true });
}

// A live map's list names select vehicles, so they are buttons; a
// static map's are plain text.
function vehicleButtons(page: Page, title: string) {
  return widget(page, title).getByRole("list", { name: "Latest positions" }).getByRole("button");
}

test("a map Widget whose answer holds over 500 Locations stays live as more arrive", async ({ page, request }) => {
  const fleet = await fleetOnDashboard(request, 600);
  try {
    await page.goto(fleet.path);
    const cars = widget(page, fleet.title);
    await expect(cars.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible({ timeout: 20_000 });
    await cars.getByText("Show as list").click();
    await expect(vehicleButtons(page, fleet.title)).toHaveCount(10);

    // Each round of Locations grows the streamed answer past the 500 it
    // keeps; the Widget must not drop back to a static map.
    for (let round = 0; round < 8; round++) {
      await fleet.report();
      await page.waitForTimeout(1_000);
      await expect(cars.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();
      await expect(vehicleButtons(page, fleet.title)).toHaveCount(10);
    }
  } finally {
    await fleet.remove();
  }
});

test("a viewer pauses a live Widget and resumes it", async ({ page, request }) => {
  const fleet = await fleetOnDashboard(request, 20);
  try {
    await page.goto(fleet.path);
    const cars = widget(page, fleet.title);
    const live = cars.getByRole("switch", { name: "Live updates" });
    await expect(live).toBeChecked();
    await expect(cars.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible({ timeout: 20_000 });
    await cars.getByText("Show as list").click();
    await expect(vehicleButtons(page, fleet.title)).toHaveCount(10);

    await live.click();
    await expect(live).not.toBeChecked();
    await expect(cars.getByRole("status").filter({ hasText: "Paused" })).toBeVisible();
    await expect(vehicleButtons(page, fleet.title)).toHaveCount(0);
    const positions = cars.getByRole("list", { name: "Latest positions" });
    const before = await positions.textContent();
    await fleet.report();
    await page.waitForTimeout(3_000);
    expect(await positions.textContent()).toBe(before);

    await live.click();
    await expect(cars.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible({ timeout: 20_000 });
    await expect(vehicleButtons(page, fleet.title)).toHaveCount(10);
  } finally {
    await fleet.remove();
  }
});

test("Home's fleet map pauses and resumes", async ({ page, request }) => {
  const fleet = await fleetOnDashboard(request, 20);
  try {
    await page.goto("/");
    const map = page.getByRole("region", { name: "Fleet map" });
    const live = map.getByRole("switch", { name: "Live updates" });
    await expect(map.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible({ timeout: 20_000 });

    await live.click();
    await expect(map.getByRole("status").filter({ hasText: "Paused" })).toBeVisible();
    await expect(map.getByRole("status").filter({ hasText: /^Live$/ })).toHaveCount(0);

    await live.click();
    await expect(map.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible({ timeout: 20_000 });
  } finally {
    await fleet.remove();
  }
});
