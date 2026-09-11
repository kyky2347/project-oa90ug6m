import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const shots = resolve("../../docs/screenshots");
mkdirSync(shots, { recursive: true });
test.skip(
  !process.env.PULSE_E2E_REAL,
  "Requires a bootstrapped, real London warehouse",
);
test("all seven real-data journeys, custom weights and shareable site", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const health = await request.get("/api/health");
  expect((await health.json()).status).toBe("healthy");
  await page.goto("/");
  await expect(page.getByTestId("city-map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId("city-map").getAttribute("data-cells-count"),
      ),
    )
    .toBeGreaterThan(2000);
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({ path: resolve(shots, "landing-1440.png") });
  await page.getByRole("link", { name: "EXPLORE LONDON", exact: true }).click();
  await expect(page.getByLabel("Business type", { exact: true })).toHaveValue(
    "coffee",
  );
  await expect(page.getByLabel("Map legend")).toBeVisible();
  const ranked = page.getByRole("button", { name: /^Inspect / });
  await expect(ranked).toHaveCount(20);
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({ path: resolve(shots, "explore-1440.png") });
  await ranked.first().click();
  await expect(page.getByTestId("selected-score")).toBeVisible();
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({ path: resolve(shots, "selected-site-1440.png") });
  const coffee = await page.getByTestId("selected-score").innerText();
  await expect(page.getByText(/cells in view · H3 9/)).toBeVisible();
  await page.getByLabel("Business type", { exact: true }).selectOption("gym");
  await expect(
    page.getByRole("complementary", { name: "Site details" }),
  ).toContainText("Gym");
  await expect
    .poll(() => page.getByTestId("selected-score").innerText())
    .not.toBe(coffee);
  await page
    .getByLabel("Map layer", { exact: true })
    .selectOption("white_space");
  await expect(page.getByLabel("Map legend")).toContainText("WHITE SPACE");
  await page.getByLabel("Map layer", { exact: true }).selectOption("access");
  await expect(page.getByLabel("Map legend")).toContainText("ACCESS");
  await page.getByRole("button", { name: "City Pulse", exact: true }).click();
  const dock = page.getByRole("region", { name: "City Pulse" });
  await expect(dock).toContainText("Typical transport demand profile");
  const before = await dock.locator(".pulse-clock strong").innerText();
  await page.getByRole("button", { name: "Play timeline" }).click();
  await expect
    .poll(() => dock.locator(".pulse-clock strong").innerText())
    .not.toBe(before);
  await page.getByRole("button", { name: "Pause timeline" }).click();
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({ path: resolve(shots, "city-pulse-1440.png") });
  await page.getByRole("radio", { name: "Sat", exact: true }).click();
  await expect(dock).toContainText("TYPICAL SATURDAY");
  await page.getByRole("button", { name: "Close City Pulse" }).click();
  await page.getByRole("button", { name: "Compare site", exact: true }).click();
  await page.getByRole("button", { name: "Close site details" }).click();
  await ranked.nth(1).click();
  await page.getByRole("button", { name: "Compare site", exact: true }).click();
  await page
    .getByRole("link", { name: "Both sites ready. Open Site Battle" })
    .click();
  await expect(page.locator(".battle-site")).toHaveCount(2);
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({
    path: resolve(shots, "site-battle-1440.png"),
    fullPage: true,
  });
  await expect(page.locator(".tradeoff")).toContainText("Similar scores");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("pulse-site-battle.json");
  await page
    .getByRole("link", { name: "Investigate this location" })
    .first()
    .click();
  await expect(page.getByTestId("selected-score")).toBeVisible();
  await page.getByRole("button", { name: "Analyse catchment" }).click();
  await expect(
    page.getByText("Radial walking-time proxy", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/cells in view · H3 9/)).toBeVisible();
  for (const n of [5, 10, 15]) {
    await page.getByRole("radio", { name: `${n} min`, exact: true }).click();
    await expect(page.locator(".catchment-metrics").first()).toContainText(
      "Residents",
    );
    await expect(
      page.getByText("80 metres/minute straight-line distance.", {
        exact: false,
      }),
    ).toBeVisible();
  }
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page
    .getByRole("table", { name: "Catchment size comparison" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(shots, "catchment-1440.png") });
  await page.getByRole("button", { name: "Close site details" }).click();
  await page.getByRole("radio", { name: "Weights", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Demand Potential weight" });
  await slider.press("End");
  await page.getByRole("button", { name: "Apply weights to London" }).click();
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy view link" }).click();
  await expect(
    page.getByText("View link copied", { exact: true }),
  ).toBeVisible();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const parameters = new URL(sharedUrl).searchParams;
  expect(parameters.get("business")).toBe("gym");
  expect(JSON.parse(parameters.get("weights")!).demand).toBe(100);
  expect(JSON.parse(parameters.get("camera")!).zoom).toBeGreaterThan(12);
  await page.goto(sharedUrl);
  await expect(page.getByLabel("Business type", { exact: true })).toHaveValue(
    "gym",
  );
  await expect(page.getByText(/cells in view · H3 9/)).toBeVisible();
  await page.getByRole("radio", { name: "Weights", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Demand Potential weight" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page.getByRole("button", { name: "Reset to profile" }).click();
  await page.getByRole("link", { name: "Data health", exact: true }).click();
  await expect(page.locator(".source-card")).toHaveCount(7);
  await expect(
    page.getByText("7 VERIFIED SOURCES", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("2026");
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({
    path: resolve(shots, "data-health-1440.png"),
    fullPage: true,
  });
  await page.goto("/methodology");
  await page.waitForTimeout(1600); // Let camera/layer transitions settle for review artifacts.
  await page.screenshot({
    path: resolve(shots, "methodology-1440.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile filters and comparison fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await page.getByRole("button", { name: "Filters & top sites" }).click();
  await expect(page.getByLabel("Business type", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /^Inspect / })
    .first()
    .click();
  await expect(page.getByTestId("selected-score")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/compare");
  await expect(page.locator(".battle-site")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("responsive visual artifacts at 1280 and mobile", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const suffix = viewport.width === 390 ? "mobile" : "1280";
    for (const [route, name] of [
      ["/", "landing"],
      ["/explore", "explore"],
      ["/compare", "site-battle"],
      ["/methodology", "methodology"],
      ["/data", "data-health"],
      ["/about", "about"],
    ]) {
      await page.goto(route);
      if (route === "/" || route === "/explore") {
        await expect(page.getByTestId("city-map")).toHaveAttribute(
          "data-map-ready",
          "true",
        );
        await expect
          .poll(async () =>
            Number(
              await page
                .getByTestId("city-map")
                .getAttribute("data-cells-count"),
            ),
          )
          .toBeGreaterThan(2000);
      } else if (route === "/compare")
        await expect(page.locator(".battle-site")).toHaveCount(2);
      else if (route === "/data")
        await expect(page.locator(".source-card")).toHaveCount(7);
      await page.waitForTimeout(1800);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: resolve(shots, `${name}-${suffix}.png`),
        fullPage: route !== "/explore" && route !== "/",
      });
    }
    await page.goto("/explore");
    if (viewport.width === 390)
      await page.getByRole("button", { name: "Filters & top sites" }).click();
    await page
      .getByRole("button", { name: /^Inspect / })
      .first()
      .click();
    await expect(page.getByTestId("selected-score")).toBeVisible();
    await expect(page.getByText(/cells in view · H3 9/)).toBeAttached();
    await page.waitForTimeout(1800);
    await page.screenshot({
      path: resolve(shots, `selected-site-${suffix}.png`),
    });
    await page.getByRole("button", { name: "City Pulse", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "City Pulse" }),
    ).toContainText("Typical transport demand profile");
    await page.waitForTimeout(1600);
    await page.screenshot({ path: resolve(shots, `city-pulse-${suffix}.png`) });
    await page.getByRole("button", { name: "Close City Pulse" }).click();
    await page.getByRole("button", { name: "Analyse catchment" }).click();
    await page
      .getByRole("table", { name: "Catchment size comparison" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("table", { name: "Catchment size comparison" }),
    ).not.toContainText("Calculating");
    await page.waitForTimeout(1600);
    await page.screenshot({ path: resolve(shots, `catchment-${suffix}.png`) });
  }
  expect(errors).toEqual([]);
});

test("measure map readiness and City Pulse frame scheduling", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const started = Date.now();
  await page.goto("/explore");
  await expect(page.getByTestId("city-map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId("city-map").getAttribute("data-cells-count"),
      ),
    )
    .toBeGreaterThan(2000);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const mapReadyMs = Date.now() - started;
  const count = Number(
    await page.getByTestId("city-map").getAttribute("data-cells-count"),
  );
  const focusStart = Date.now();
  await page
    .getByRole("button", { name: /^Inspect / })
    .first()
    .click();
  await expect(page.getByTestId("selected-score")).toBeVisible();
  await expect(page.getByText(/cells in view · H3 9/)).toBeVisible();
  const focusMs = Date.now() - focusStart;
  await page.getByRole("button", { name: "City Pulse", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline" }).click();
  const intervals = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        let previous = performance.now();
        const tick = (t: number) => {
          values.push(t - previous);
          previous = t;
          if (values.length < 120) requestAnimationFrame(tick);
          else resolve(values.slice(1));
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.getByRole("button", { name: "Pause timeline" }).click();
  const sorted = [...intervals].sort((a, b) => a - b);
  const health = await (await request.get("/api/health")).json();
  const report = {
    measured_at: new Date().toISOString(),
    feature_version: health.feature_version,
    environment:
      "Chromium headless, SwiftShader software WebGL, 1440 × 900; Docker API with warm response caches. Not physical-device or GPU throughput.",
    overview_cells: count,
    map_ready_and_two_animation_frames_ms: mapReadyMs,
    site_detail_and_resolution9_focus_ms: focusMs,
    city_pulse_animation_frame_samples: intervals.length,
    animation_frame_interval_p50_ms: sorted[Math.floor(sorted.length * 0.5)],
    animation_frame_interval_p95_ms: sorted[Math.floor(sorted.length * 0.95)],
    mean_animation_frame_callbacks_per_second:
      1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
    note: "Readiness includes navigation, JS, verified map data and two browser animation frames. Frame callbacks measure scheduling while playback is active, not GPU-completed frames or a production FPS guarantee.",
  };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    resolve("../../docs/frontend-performance.json"),
    JSON.stringify(report, null, 2),
  );
  expect(intervals.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
});
