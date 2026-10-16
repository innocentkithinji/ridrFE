import { expect, test, type Page } from "@playwright/test";

// The map of Locations in Explore, against the demo data: the Fintraffic
// bridge keeps "Ship Megastar" (MMSI 276829000) reporting its position.

const megastarQuery = 'locations | where asset == "Ship Megastar" | range last 1h';
const megastarDevice = "276829000";

function map(page: Page) {
  return page.getByRole("figure", { name: "Query answer map" });
}

// brightness is how light the drawn map looks, from 0 (black) to 255.
async function brightness(page: Page): Promise<number> {
  const png = (await map(page).locator("canvas").screenshot()).toString("base64");
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

test("a locations Query draws a demo vehicle on the map", async ({ page }) => {
  await page.goto(`/explore?q=${encodeURIComponent(megastarQuery)}`);

  await expect(page.getByRole("tab", { name: "Map", selected: true })).toBeVisible();
  await expect(page.getByText("so keep the range short")).toBeVisible();
  await expect(map(page).locator("canvas")).toBeVisible();
  await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });

  await map(page).getByText("Show as list").click();
  const latest = map(page).getByRole("list", { name: "Latest positions" });
  await expect(latest.getByRole("listitem").filter({ hasText: megastarDevice })).toContainText(/60\.\d+° N, 24\.\d+° E/);
});

test("live Locations move the vehicle without redrawing the map", async ({ page }) => {
  await page.goto(`/explore?q=${encodeURIComponent(megastarQuery)}`);
  await expect(page.getByRole("status").filter({ hasText: /^Live$/ })).toBeVisible();
  await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  // Mark the map's canvas: a map rebuilt for new data would lose the mark.
  await map(page).locator("canvas").evaluate((canvas) => canvas.setAttribute("data-first", ""));

  await map(page).getByText("Show as list").click();
  const megastar = map(page).getByRole("list", { name: "Latest positions" }).getByRole("listitem").filter({ hasText: megastarDevice });
  const time = megastar.locator("time");
  const before = await time.getAttribute("datetime");

  await expect.poll(() => time.getAttribute("datetime"), { timeout: 60_000 }).not.toBe(before);
  await expect(map(page).locator("canvas[data-first]")).toHaveCount(1);
});

test("the map follows the light and dark theme", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/explore?q=${encodeURIComponent(megastarQuery)}`);
  await expect(map(page)).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  expect(await brightness(page)).toBeLessThan(100);

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();

  await expect.poll(() => brightness(page), { timeout: 20_000 }).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});
