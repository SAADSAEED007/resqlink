import { test, expect, type Page } from "@playwright/test";
import {
  MOCK_INCIDENTS,
  MOCK_RESCUE_TEAMS,
} from "../src/components/dashboard/mock-data";
const admin = {
  _id: "012345678901234567890123",
  name: "SIMULATED Coordinator",
  email: "test@example.com",
  role: "admin",
};
async function auth(page: Page) {
  await page.route("http://localhost:4000/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: admin }),
    }),
  );
}
for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920])
  test(`refined dashboard and SOS fit ${width}px`, async ({ page }, info) => {
    await auth(page);
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Command Center", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".rqCommandLeaflet.leaflet-container"),
    ).toBeVisible();
    await expect(page.getByText("AI Confidence", { exact: true })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".rqCommand")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(245, 248, 252)");
    if (width >= 1280) {
      expect(
        (await page.locator(".rqCommandMap").boundingBox())!.y,
      ).toBeLessThan(300);
      expect(
        (await page.locator(".command-header").boundingBox())!.height,
      ).toBeLessThanOrEqual(76);
    }
    await page.screenshot({
      path: info.outputPath(`command-${width}.png`),
      fullPage: true,
    });
    if (width < 1280) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(
        page.getByRole("navigation", { name: "Command center" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).press("Escape");
      await expect(
        page.getByRole("button", { name: "Menu", exact: true }),
      ).toBeFocused();
    }
    await page.goto("/sos");
    await expect(
      page.getByRole("heading", { name: "Report an Emergency", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`sos-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Add Details", exact: true })
      .click();
    await expect(page.getByLabel(/^Your name/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`sos-details-${width}.png`),
      fullPage: true,
    });
    expect(consoleErrors).toEqual([]);
  });
test("API polling preserves selected report, filters and map view, pauses hidden and retains data on failure", async ({
  page,
}) => {
  await auth(page);
  await page.clock.install();
  let calls = 0,
    fail = false;
  await page.route("http://localhost:4000/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("incidents")) calls++;
    await route.fulfill({
      status: fail ? 500 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: !fail,
        data: fail
          ? null
          : {
              items: path.endsWith("incidents")
                ? MOCK_INCIDENTS
                : path.endsWith("teams")
                  ? MOCK_RESCUE_TEAMS
                  : [],
              pagination: { page: 1, limit: 100, total: 4, totalPages: 1 },
            },
      }),
    });
  });
  await page.goto("/dashboard?demo=false");
  await expect(page.locator(".rqCommandIncident").first()).toBeVisible();
  await expect.poll(() => calls).toBe(1);
  await page
    .getByPlaceholder("Search locations, incidents, teams...")
    .fill("Korangi");
  const proxy = page.locator(".rqCommandLeaflet .leaflet-proxy");
  const originalView = await proxy.getAttribute("style");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(proxy).not.toHaveAttribute("style", originalView!);
  const zoomedView = await proxy.getAttribute("style");
  await page.locator(".rqCommandIncident").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.clock.runFor(7100);
  await expect.poll(() => calls).toBe(2);
  await expect(proxy).toHaveAttribute("style", zoomedView!);
  await expect(page.locator(".rqCommandIncident.is-selected")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByPlaceholder("Search locations, incidents, teams..."),
  ).toHaveValue("Korangi");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(22000);
  expect(calls).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toBe(3);
  fail = true;
  await page.clock.runFor(7100);
  await expect.poll(() => calls).toBe(4);
  await expect(page.locator(".rqCommandIncident").first()).toBeVisible();
  await expect(
    page.getByText("Backend API Connection Unavailable"),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated activity", { exact: true }),
  ).toHaveCount(0);
});
test("demo makes no API polling calls and map, alerts and team actions are usable", async ({
  page,
}) => {
  await auth(page);
  let requests = 0;
  await page.route("http://localhost:4000/api/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.goto("/dashboard");
  await expect(
    page.locator(".rqCommandLeaflet.leaflet-container"),
  ).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole("button", { name: "Refresh data", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(page.locator(".rqCommandMap")).toHaveClass(/is-expanded/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rqCommandMap")).not.toHaveClass(/is-expanded/);
  await page.getByRole("button", { name: "Open emergency alerts" }).click();
  await expect(
    page.getByRole("region", { name: "Critical alerts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close alerts" }).click();
  await page
    .getByRole("heading", { name: "Rescue Team Availability" })
    .locator("../..")
    .locator("..")
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Close team details" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close team details" }).click();
});

test("refresh requests do not overlap and stop after leaving the dashboard", async ({
  page,
}) => {
  await auth(page);
  await page.clock.install();
  let incidentCalls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("http://localhost:4000/api/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("incidents")) {
      incidentCalls++;
      await pending;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        },
      }),
    });
  });
  await page.goto("/dashboard?demo=false");
  await expect.poll(() => incidentCalls).toBe(1);
  await page
    .getByRole("button", { name: "Refresh data", exact: true })
    .evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
  await page.clock.runFor(21000);
  expect(incidentCalls).toBe(1);
  release!();
  await expect(
    page.getByRole("button", { name: "Refresh data", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("No incidents match current filter."),
  ).toBeVisible();
  await page.goto("/sos");
  await page.clock.runFor(21000);
  expect(incidentCalls).toBe(1);
});
