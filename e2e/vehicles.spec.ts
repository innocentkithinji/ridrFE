import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminToken, api } from "./users";

// Live maps draw each Track as a vehicle moving between its reported
// Locations. Each test drives its own vehicle, reporting on cue, and
// reads where the vehicle is shown from the bubble pinned above it when
// selected (the map itself is a canvas).

async function call<T>(request: APIRequestContext, method: string, data: object, token = adminToken): Promise<T> {
  const response = await request.post(`${api}/ridr.v1.${method}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

type Report = { latitude: number; longitude: number; at?: Date; mode?: string };

// vehicle makes a Device (from a new Adapter) that has reported once, at
// `since` (now unless given), and returns the live Query for its
// Locations and report to send another. Its Locations carry `tags`, and
// a `mode` Tag when given one.
async function vehicle(
  request: APIRequestContext,
  mode?: string,
  since = new Date(),
  tags: Record<string, string> = {},
) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const deviceId = `e2e-tram-${stamp}`;
  const { adapter, ingestKey } = await call<{ adapter: { id: string }; ingestKey: { plaintext: string } }>(
    request,
    "AdapterService/RegisterAdapter",
    { name: `e2e-vehicles-${stamp}` },
  );
  const report = ({ latitude, longitude, at = new Date() }: Report) =>
    call(
      request,
      "IngestService/Ingest",
      {
        locations: [
          { deviceId, deviceTime: at.toISOString(), latitude, longitude, tags: mode ? { ...tags, mode } : tags },
        ],
      },
      ingestKey.plaintext,
    );
  await report({ latitude: 60.17, longitude: 24.94, at: since });
  return {
    deviceId,
    query: `locations | where device == "${deviceId}" | range last 10m`,
    report,
    retire: () => call(request, "AdapterService/RetireAdapter", { adapterId: adapter.id }),
  };
}

function map(page: Page) {
  return page.getByRole("figure", { name: "Query answer map" });
}

// fact is what the bubble says for one of its terms, such as "Motion".
function fact(page: Page, term: string) {
  return card(page)
    .locator("dt", { hasText: new RegExp(`^${term}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

function card(page: Page) {
  return page.getByRole("region", { name: "Selected vehicle" });
}

// open opens the vehicle's live map in Explore and selects it from the
// list of positions.
async function open(page: Page, van: { query: string; deviceId: string }) {
  await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);
  await expect(page.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();
  await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  await map(page).getByText("Show as list").click();
  await map(page).getByRole("button", { name: van.deviceId }).click();
  await expect(card(page)).toBeVisible();
}

// shownLatitude is the latitude the card says the vehicle is at.
async function shownLatitude(page: Page): Promise<number> {
  const text = (await fact(page, "Position").textContent()) ?? "";
  return Number(text.match(/^([\d.]+)° N/)?.[1]);
}

// sampleWhile reads the shown latitude every 100 ms while reporting runs.
async function sampleWhile(page: Page, reporting: Promise<unknown>, extraMs: number): Promise<number[]> {
  const seen: number[] = [];
  const state = { done: false };
  const finished = reporting.then(() => page.waitForTimeout(extraMs)).then(() => (state.done = true));
  while (!state.done) {
    seen.push(await shownLatitude(page));
    await page.waitForTimeout(100);
  }
  await finished;
  return seen;
}

test("a live vehicle glides between its reports and never steps back", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await open(page, van);
    const reported = [60.17];
    const reporting = (async () => {
      for (let step = 1; step <= 6; step++) {
        await page.waitForTimeout(1_000);
        const latitude = 60.17 + step * 0.001;
        reported.push(latitude);
        await van.report({ latitude, longitude: 24.94 });
      }
    })();
    const seen = await sampleWhile(page, reporting, 5_000);

    // Somewhere between two reports, not only on them.
    const between = seen.filter((latitude) => !reported.some((r) => Math.abs(r - latitude) < 0.00005));
    expect(between.length, `shown: ${seen.join(", ")}`).toBeGreaterThan(3);
    // Always forward.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    await expect(card(page)).toContainText("60.1760° N");
  } finally {
    await van.retire();
  }
});

test("a Location too far to have travelled to is placed, not glided to", async ({ page, request }) => {
  const van = await vehicle(request, "tram");
  try {
    await open(page, van);
    await expect(card(page)).toContainText("Tram");
    // Waiting at a stop, reporting each second, then 5 km north in a
    // second: no tram goes 18,000 km/h.
    const reporting = (async () => {
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(1_000);
        await van.report({ latitude: 60.17, longitude: 24.94 });
      }
      await page.waitForTimeout(1_000);
      await van.report({ latitude: 60.215, longitude: 24.94 });
    })();
    const seen = await sampleWhile(page, reporting, 6_000);

    expect(seen.at(-1)).toBeCloseTo(60.215, 3);
    const between = seen.filter((latitude) => latitude > 60.1701 && latitude < 60.2149);
    expect(between, `shown: ${seen.join(", ")}`).toEqual([]);
  } finally {
    await van.retire();
  }
});

test("the card says whether a vehicle is en route, stopped or silent", async ({ page, request }) => {
  const van = await vehicle(request, "rail");
  try {
    await open(page, van);
    await expect(card(page)).toContainText("Train");
    const motion = fact(page, "Motion");

    await van.report({ latitude: 60.171, longitude: 24.94 });
    await expect(motion).toHaveText("EN ROUTE", { timeout: 15_000 });

    await page.waitForTimeout(1_000);
    await van.report({ latitude: 60.171, longitude: 24.94 });
    await page.waitForTimeout(1_000);
    await van.report({ latitude: 60.171, longitude: 24.94 });
    await expect(motion).toHaveText("STOPPED", { timeout: 15_000 });
  } finally {
    await van.retire();
  }
});

test("a vehicle that last reported over 90 seconds ago has no fix", async ({ page, request }) => {
  const quiet = await vehicle(request, undefined, new Date(Date.now() - 120_000));
  try {
    await open(page, quiet);
    await expect(fact(page, "Motion")).toHaveText("NO FIX");
  } finally {
    await quiet.retire();
  }
});

test("Close and Escape clear the selected vehicle", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await open(page, van);
    const name = map(page).getByRole("button", { name: van.deviceId });
    await expect(name).toHaveAttribute("aria-pressed", "true");
    await card(page).getByRole("button", { name: "Close" }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(name).toHaveAttribute("aria-pressed", "false");

    await name.click();
    await expect(card(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
  } finally {
    await van.retire();
  }
});

test("under reduced motion a vehicle steps from report to report", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const van = await vehicle(request);
  try {
    await open(page, van);
    const reported = [60.17];
    const reporting = (async () => {
      for (let step = 1; step <= 4; step++) {
        await page.waitForTimeout(1_000);
        const latitude = 60.17 + step * 0.001;
        reported.push(latitude);
        await van.report({ latitude, longitude: 24.94 });
      }
    })();
    const seen = await sampleWhile(page, reporting, 8_000);

    const between = seen.filter((latitude) => !reported.some((r) => Math.abs(r - latitude) < 0.00005));
    expect(between, `shown: ${seen.join(", ")}`).toEqual([]);
    expect(seen.at(-1)).toBeCloseTo(60.174, 4);
  } finally {
    await van.retire();
  }
});

test("historical maps draw Tracks, not vehicles", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await page.goto(`/explore?q=${encodeURIComponent(van.query)}`);
    await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    await page.getByRole("checkbox", { name: "Live" }).uncheck();
    await map(page).getByText("Show as list").click();
    const list = map(page).getByRole("list", { name: "Latest positions" });
    await expect(list.getByText(van.deviceId)).toBeVisible();
    await expect(list.getByRole("button")).toHaveCount(0);
  } finally {
    await van.retire();
  }
});

test("the bubble on a selected vehicle gives its name, speed and Tags", async ({ page, request }) => {
  const train = await vehicle(request, "rail", new Date(), { Line: "I", Route: "3002I" });
  try {
    await open(page, train);
    await expect(card(page).getByRole("heading", { name: train.deviceId })).toBeVisible();
    await expect(fact(page, "Mode")).toHaveText("Train");
    await expect(fact(page, "Line")).toHaveText("I");
    await expect(fact(page, "Route")).toHaveText("3002I");
    // About 33 m a second: some 120 km/h.
    for (let step = 1; step <= 4; step++) {
      await page.waitForTimeout(1_000);
      await train.report({ latitude: 60.17 + step * 0.0003, longitude: 24.94 });
    }
    await expect(fact(page, "Speed")).toHaveText(/^\d{2,3} km\/h$/, { timeout: 15_000 });
  } finally {
    await train.retire();
  }
});

test("the map follows the selected vehicle until it is dragged", async ({ page, request }) => {
  const van = await vehicle(request);
  try {
    await open(page, van);
    const follow = card(page).getByRole("button", { name: "Follow" });
    await expect(follow).toHaveAttribute("aria-pressed", "true");

    // 30 km north, well out of the view fitted to where it was.
    await page.waitForTimeout(1_000);
    await van.report({ latitude: 60.44, longitude: 24.94 });
    await expect(fact(page, "Position")).toContainText("60.4400° N", { timeout: 15_000 });
    const inView = async () => {
      const shown = await map(page).locator("canvas").first().boundingBox();
      const bubble = await card(page).boundingBox();
      if (!shown || !bubble) return false;
      const middle = bubble.x + bubble.width / 2;
      return middle > shown.x && middle < shown.x + shown.width && bubble.y + bubble.height > shown.y;
    };
    await expect.poll(inView).toBe(true);

    const shown = (await map(page).locator("canvas").first().boundingBox())!;
    // Drag the map down and right, from a corner clear of the bubble.
    await page.mouse.move(shown.x + 60, shown.y + 40);
    await page.mouse.down();
    await page.mouse.move(shown.x + 260, shown.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await follow.click();
    await expect(follow).toHaveAttribute("aria-pressed", "true");
  } finally {
    await van.retire();
  }
});
