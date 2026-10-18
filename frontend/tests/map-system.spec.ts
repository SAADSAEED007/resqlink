import { test, expect, type Page } from "@playwright/test";
import {
  mapPosition,
  geoJsonPosition,
  validCoordinates,
  outsideOperationalRegion,
  SINDH_CENTER,
} from "../src/components/maps/map-coordinates";
import { fitMapPositions } from "../src/components/maps/map-bounds";
import type { Map as LeafletMap } from "leaflet";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=",
  "base64",
);
async function tiles(page: Page, fail = false) {
  await page.route(
    /https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com)\//,
    (route) =>
      fail
        ? route.fulfill({ status: 503, body: "QA tile outage" })
        : route.fulfill({ contentType: "image/png", body: pixel }),
  );
}
async function fixture(
  page: Page,
  options: { noLocation?: boolean; noTeams?: boolean; empty?: boolean } = {},
) {
  const date = "2026-10-18T06:00:00Z";
  const incident = {
    _id: "661100000000000000000001",
    emergencyType: "FLOOD",
    description: "QA incident",
    priorityLevel: "HIGH",
    priorityScore: 60,
    priorityReasons: [],
    confidenceLevel: "MEDIUM",
    status: "PENDING",
    assignedTeam: null,
    location: options.noLocation
      ? null
      : { latitude: 26.73, longitude: 67.77, address: "QA reported point" },
    locationVerificationRequired: !!options.noLocation,
    isSimulated: false,
    peopleAffected: 5,
    createdAt: date,
    updatedAt: date,
    verification: { status: "NEEDS_REVIEW" },
  };
  const teams =
    options.noTeams || options.empty
      ? []
      : [
          {
            _id: "662200000000000000000001",
            name: "Hyderabad Water Rescue",
            status: "AVAILABLE",
            latitude: 25.4,
            longitude: 68.37,
          },
          {
            _id: "662200000000000000000002",
            name: "Karachi Busy Team",
            status: "BUSY",
            latitude: 24.86,
            longitude: 67.01,
          },
          {
            _id: "662200000000000000000003",
            name: "Sukkur Offline Team",
            status: "OFFLINE",
            latitude: 27.7,
            longitude: 68.86,
          },
        ].map((row, index) => ({
          ...row,
          location: {
            latitude: row.latitude,
            longitude: row.longitude,
            address: "QA stored base",
          },
          teamCode: `QA-${index}`,
          capabilities: ["WATER_RESCUE"],
          capacity: 12,
          currentIncident: row.status === "BUSY" ? incident._id : null,
          isSimulated: false,
          createdAt: date,
          updatedAt: date,
        }));
  const writes: string[] = [];
  await page.route("**/v1/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          _id: "664400000000000000000001",
          name: "QA Coordinator",
          role: "admin",
          email: "qa@example.test",
        },
      },
    }),
  );
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const reply = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    const list = (items: unknown[]) => ({
      items,
      pagination: { page: 1, limit: 100, total: items.length, totalPages: 1 },
    });
    if (route.request().method() !== "GET") {
      writes.push(path);
      return route.fulfill({ status: 400, json: { success: false } });
    }
    if (path.endsWith("/recommendations"))
      return reply({
        items: teams
          .filter((t) => t.status === "AVAILABLE")
          .map((team) => ({
            team,
            approximateDistanceKm: 10,
            capacityWarning: null,
          })),
        manualSelectionRequired: true,
        distanceType: "APPROXIMATE_STRAIGHT_LINE_KM",
        message: "Manual selection required",
      });
    if (path.startsWith("/api/rescue-teams/"))
      return reply(teams.find((t) => t._id === path.split("/").at(-1)));
    if (path === "/api/rescue-teams")
      return reply(
        list(
          teams.filter(
            (t) =>
              !url.searchParams.get("status") ||
              t.status === url.searchParams.get("status"),
          ),
        ),
      );
    if (path.startsWith("/api/incidents/")) return reply(incident);
    if (path === "/api/incidents")
      return reply(list(options.empty ? [] : [incident]));
    return reply(list([]));
  });
  return { incident, teams, writes };
}

test("coordinate adapters reject coercion, preserve real zeros and explicitly convert GeoJSON", () => {
  for (const value of [
    null,
    undefined,
    {},
    { latitude: null, longitude: 68 },
    { latitude: "25.4", longitude: 68 },
    { latitude: "", longitude: 68 },
    { latitude: NaN, longitude: 68 },
    { latitude: Infinity, longitude: 68 },
    { latitude: 91, longitude: 68 },
    { latitude: 25, longitude: -181 },
    { latitude: 120, longitude: 25 },
  ])
    expect(validCoordinates(value)).toBe(false);
  expect(mapPosition({ latitude: 0, longitude: 0 })).toEqual([0, 0]);
  expect(mapPosition({ latitude: 25.4, longitude: 68.37 })).toEqual([
    25.4, 68.37,
  ]);
  expect(mapPosition({ latitude: 67, longitude: 24 })).toEqual([67, 24]);
  expect(outsideOperationalRegion({ latitude: 67, longitude: 24 })).toBe(true);
  expect(
    geoJsonPosition({ type: "Point", coordinates: [68.37, 25.4] }),
  ).toEqual([25.4, 68.37]);
  expect(
    geoJsonPosition({ type: "Point", coordinates: ["68", 25] }),
  ).toBeNull();
  expect(
    geoJsonPosition({ type: "LineString", coordinates: [68, 25] }),
  ).toBeNull();
});
test("viewport handles zero, one and multiple positions without a world fallback", () => {
  const calls: unknown[] = [];
  const map = {
    setView: (...args: unknown[]) => calls.push(["view", ...args]),
    fitBounds: (...args: unknown[]) => calls.push(["bounds", ...args]),
  } as unknown as LeafletMap;
  fitMapPositions(map, []);
  expect(calls[0]).toEqual(["view", SINDH_CENTER, 7, { animate: false }]);
  fitMapPositions(map, [[25.4, 68.37]]);
  expect(calls[1]).toEqual(["view", [25.4, 68.37], 12, { animate: false }]);
  fitMapPositions(map, [
    [25.4, 68.37],
    [27.7, 68.86],
  ]);
  expect(calls[2]).toEqual([
    "bounds",
    [
      [25.4, 68.37],
      [27.7, 68.86],
    ],
    { padding: [45, 45], maxZoom: 13, animate: false },
  ]);
});
test("teams fit real bases, synchronize selection and use clean theme-specific tiles", async ({
  page,
}) => {
  await tiles(page);
  await fixture(page);
  await page.goto("/dashboard/rescue-teams");
  const map = page.locator(".rtMap");
  await expect(map.locator(".leaflet-marker-icon")).toHaveCount(3);
  await expect(
    map.locator('img.leaflet-tile[src*="tile.openstreetmap.org"]').first(),
  ).toBeVisible();
  const bounds = await map.boundingBox();
  for (const marker of await map.locator(".leaflet-marker-icon").all()) {
    const box = await marker.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      bounds!.y + bounds!.height,
    );
  }
  await page
    .getByTitle("Select team Karachi Busy Team", { exact: true })
    .click();
  await expect(page.locator(".rtDetails h3")).toHaveText("Karachi Busy Team");
  await expect(map.locator(".leaflet-popup")).toContainText(
    "Stored team base location",
  );
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(
    map.locator('img.leaflet-tile[src*="World_Dark_Gray_Base"]').first(),
  ).toBeVisible();
  expect(
    await map
      .locator(".leaflet-tile-pane")
      .evaluate((el) => getComputedStyle(el).filter),
  ).toBe("none");
  await page.setViewportSize({ width: 390, height: 844 });
  await map.scrollIntoViewIfNeeded();
  await expect(map).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("tile failures expose manual retry and preserve markers", async ({
  page,
}) => {
  await tiles(page, true);
  await fixture(page);
  await page.goto("/dashboard/rescue-teams");
  await expect(
    page.getByRole("button", { name: "Retry Map", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".rtMap .leaflet-marker-icon")).toHaveCount(3);
  await tiles(page);
  await page.getByRole("button", { name: "Retry Map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry Map", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Loading basemap…", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".rtMap .leaflet-marker-icon")).toHaveCount(3);
});
test("assignments show team bases before selection and preserve unmapped incidents", async ({
  page,
}) => {
  await tiles(page);
  const data = await fixture(page, { noLocation: true });
  await page.goto("/dashboard/assignments");
  await expect(page.locator(".awMap .leaflet-marker-icon")).toHaveCount(3);
  await page.locator(".awQueueRow").first().click();
  await expect(page.locator(".awMapNotice")).toContainText(
    "Incident location has not been mapped yet",
  );
  await expect(
    page.locator('.awMap [title="Selected incident location"]'),
  ).toHaveCount(0);
  await page.getByTitle("Hyderabad Water Rescue", { exact: true }).click();
  await expect(page.locator(".awMap .leaflet-popup")).toContainText(
    "Eligible for manual selection",
  );
  expect(data.writes).toEqual([]);
  await page
    .locator(".awMap")
    .getByRole("button", { name: "Close popup" })
    .click();
  await page.getByTitle("Sukkur Offline Team", { exact: true }).click();
  await expect(page.locator(".awMap .leaflet-popup")).toContainText(
    "Not eligible",
  );
  expect(data.writes).toEqual([]);
  await expect(page.locator(".awMapNotice a")).toHaveAttribute(
    "href",
    `/dashboard/incidents/${data.incident._id}`,
  );
});
test("mapped assignment includes incident and all actual stored bases", async ({
  page,
}) => {
  await tiles(page);
  await fixture(page);
  await page.goto("/dashboard/assignments");
  await page.locator(".awQueueRow").first().click();
  await expect(page.locator(".awMap .leaflet-marker-icon")).toHaveCount(4);
  await page.getByTitle("Selected incident location", { exact: true }).click();
  await expect(page.locator(".awMap .leaflet-popup")).toContainText(
    "Reported location",
  );
  await expect(
    page
      .locator(".awMap .leaflet-popup")
      .getByRole("link", { name: "View Incident Details" }),
  ).toHaveAttribute("href", /\/dashboard\/incidents\//);
});
test("no positions uses an unmarked Sindh overview", async ({ page }) => {
  await tiles(page);
  await fixture(page, { empty: true });
  await page.goto("/dashboard/rescue-teams");
  await expect(page.locator(".rtMapEmpty")).toContainText(
    "Sindh overview shown",
  );
  await expect(page.locator(".rtMap .leaflet-marker-icon")).toHaveCount(0);
  await expect(
    page.locator('.rtMap img.leaflet-tile[src*="/7/"]').first(),
  ).toBeVisible();
});
test("public SOS only reports a chosen map pin after explicit confirmation", async ({
  page,
}) => {
  await tiles(page);
  await page.route("**/v1/**", (route) =>
    route.fulfill({ status: 401, json: { success: false } }),
  );
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/incidents", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: { success: true, data: { _id: "661100000000000000000099" } },
    });
  });
  await page.goto("/sos");
  await page.getByRole("button", { name: "SOS", exact: true }).click();
  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await page.locator(".rqQuickMap summary").click();
  const map = page.getByRole("group", { name: "Emergency location map" });
  await expect(map).toHaveClass(/leaflet-container/);
  await expect(map.locator(".rqSosMapMarker")).toHaveCount(0);
  await map.click({ position: { x: 180, y: 150 } });
  await expect(map.locator(".rqSosMapMarker")).toHaveCount(1);
  const text = await page
    .locator(".rqSosMapPicker .helper")
    .first()
    .innerText();
  const match = text.match(
    /Candidate point: (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/,
  )!;
  expect(match).toBeTruthy();
  await page.locator(".rqQuickDetails summary").click();
  await page
    .getByLabel("What happened?", { exact: true })
    .fill("QA water rising at the selected location.");
  await page.getByLabel("Your name", { exact: true }).fill("QA Reporter");
  await page.getByLabel("People affected", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Send SOS", exact: true }).click();
  await expect(
    page.getByText("Share your location or enter a village / landmark.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(payloads).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm selected location", exact: true })
    .click();
  await page.locator(".rqQuickMap summary").click();
  await page.locator(".rqQuickMap summary").click();
  await expect(map.locator(".rqSosMapMarker")).toHaveCount(1);
  await page.getByRole("button", { name: "Send SOS", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm SOS", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send SOS", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Emergency report recorded",
      exact: true,
    }),
  ).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0].location).toMatchObject({
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  });
});
test("overview plots only actual API coordinates with consistent markers", async ({
  page,
}) => {
  await tiles(page);
  await fixture(page);
  await page.goto("/dashboard");
  await expect(page.locator(".rqCommandMap .leaflet-marker-icon")).toHaveCount(
    4,
  );
  await expect(page.locator(".rqCommandMap")).toContainText("not live GPS");
  await expect(page.locator(".rqCommandMap .rqMapOffline")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Reset map view", exact: true })
    .click();
  await expect(page.locator(".rqCommandMap .leaflet-marker-icon")).toHaveCount(
    4,
  );
});
