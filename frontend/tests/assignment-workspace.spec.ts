import { test, expect, type Page } from "./map-test-fixtures";

async function fixture(
  page: Page,
  options: {
    empty?: boolean;
    conflict?: boolean;
    noLocation?: boolean;
    unavailable?: boolean;
  } = {},
) {
  const location = {
    latitude: 24.86,
    longitude: 67.01,
    address: "Fictional test location, Karachi",
  };
  const incident = {
    _id: "661100000000000000000001",
    emergencyType: "FLOOD",
    priorityLevel: "CRITICAL",
    priorityScore: 80,
    status: "PENDING",
    assignedTeam: null as string | null,
    location: options.noLocation ? null : location,
    description:
      "Fictional test incident: water rising near a residential street.",
    peopleAffected: 12,
    isSimulated: false,
    createdAt: "2026-10-18T06:00:00Z",
    verification: { status: "VERIFIED" },
  };
  const team = {
    _id: "662200000000000000000001",
    name: "Test Water Rescue",
    teamCode: "TEST-01",
    capabilities: ["WATER_RESCUE"],
    status: "AVAILABLE",
    currentIncident: null as string | null,
    capacity: 15,
    location: { ...location, latitude: 24.87 },
    isSimulated: false,
  };
  const record = {
    _id: "663300000000000000000001",
    incidentId: incident,
    teamId: team,
    status: "ACTIVE",
    assignedAt: "2026-10-18T06:10:00Z",
    completedAt: null as string | null,
    notes: "",
    isSimulated: false,
  };
  let created = false;
  const writes: string[] = [],
    reads: string[] = [];
  await page.route("**/v1/user/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          _id: "664400000000000000000001",
          name: "Test Coordinator",
          email: "coordinator@example.test",
          role: "admin",
        },
      },
    }),
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, json: { success: status < 400, data } });
    const list = (items: unknown[], total = items.length) => ({
      items,
      pagination: {
        page: Number(url.searchParams.get("page") || 1),
        limit: Number(url.searchParams.get("limit") || 20),
        total,
        totalPages: Math.ceil(
          total / Number(url.searchParams.get("limit") || 20),
        ),
      },
    });
    if (req.method() !== "GET") {
      writes.push(path);
      if (options.conflict) return reply(null, 409);
      if (path === "/api/assignments") {
        created = true;
        incident.status = "ASSIGNED";
        incident.assignedTeam = team._id;
        team.status = "BUSY";
        team.currentIncident = incident._id;
        record.notes = req.postDataJSON().notes || "";
        return reply(
          { ...record, incidentId: incident._id, teamId: team._id },
          201,
        );
      }
      if (path.endsWith("/status")) {
        incident.status = req.postDataJSON().status;
        if (incident.status === "RESOLVED") {
          record.status = "COMPLETED";
          record.completedAt = new Date().toISOString();
          team.status = "AVAILABLE";
          team.currentIncident = null;
          incident.assignedTeam = null;
        }
        return reply(incident);
      }
    }
    reads.push(url.pathname + url.search);
    if (options.unavailable) return reply(null, 503);
    if (path.endsWith("/recommendations"))
      return reply({
        manualSelectionRequired: !!options.noLocation,
        distanceType: "APPROXIMATE_STRAIGHT_LINE_KM",
        message: "Test recommendation",
        items: options.noLocation
          ? []
          : [{ team, approximateDistanceKm: 1.1, capacityWarning: null }],
      });
    if (path === "/api/incidents") {
      const matches =
        !options.empty &&
        (!url.searchParams.has("unassigned") ||
          incident.status === "PENDING") &&
        (!url.searchParams.get("search") ||
          incident.description.includes(url.searchParams.get("search")!)) &&
        (!url.searchParams.get("priorityLevel") ||
          url.searchParams.get("priorityLevel") === incident.priorityLevel);
      return reply(
        list(
          matches ? [incident] : [],
          matches ? (url.searchParams.get("limit") === "1" ? 125 : 1) : 0,
        ),
      );
    }
    if (path.startsWith("/api/incidents/")) return reply(incident);
    if (path === "/api/rescue-teams")
      return reply(list(options.empty ? [] : [team]));
    if (path.startsWith("/api/rescue-teams/")) return reply(team);
    if (path === "/api/assignments")
      return reply(
        list(
          created &&
            (!url.searchParams.get("status") ||
              url.searchParams.get("status") === record.status)
            ? [record]
            : [],
        ),
      );
    if (path.startsWith("/api/assignments/")) return reply(record);
    return reply(list([]));
  });
  return { writes, reads, incident, team };
}
async function open(page: Page) {
  await page.goto("/dashboard/assignments");
  await expect(
    page.getByRole("heading", { name: "Assignment Management", exact: true }),
  ).toBeVisible();
}
test("confirmed assignment, in progress, resolution and history refresh", async ({
  page,
}) => {
  const api = await fixture(page);
  await open(page);
  await expect(page.locator(".awMetric strong").first()).toHaveText("125");
  await page.locator(".awQueueRow").click();
  await page
    .getByRole("combobox", { name: "Select rescue team", exact: true })
    .selectOption(api.team._id);
  await page.getByLabel("Additional notes (optional)").fill("Test briefing");
  await page
    .getByRole("button", { name: "Assign Rescue Team", exact: true })
    .click();
  expect(api.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm Assignment", exact: true })
    .dblclick();
  await expect(page.locator(".awTracking")).toContainText("ACTIVE");
  expect(api.writes.filter((path) => path === "/api/assignments")).toHaveLength(
    1,
  );
  await expect(page.locator(".awQueueRow")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark In Progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Status Change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resolve Incident", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Status Change", exact: true })
    .click();
  await expect(page.locator(".awTracking")).toContainText("COMPLETED");
  expect(api.team.status).toBe("AVAILABLE");
  await page
    .getByRole("button", { name: "Completed history", exact: true })
    .click();
  await expect(page.locator(".awRecord")).toContainText("Test Water Rescue");
  await page.reload();
  await expect(page.locator(".awQueueRow")).toHaveCount(0);
});
test("conflict preserves notes and never claims success", async ({ page }) => {
  const api = await fixture(page, { conflict: true });
  await open(page);
  await page.locator(".awQueueRow").click();
  await page
    .getByRole("combobox", { name: "Select rescue team", exact: true })
    .selectOption(api.team._id);
  await page.getByLabel("Additional notes (optional)").fill("Keep this note");
  await page
    .getByRole("button", { name: "Assign Rescue Team", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Assignment", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "no longer available" }),
  ).toBeVisible();
  await expect(page.getByLabel("Additional notes (optional)")).toHaveValue(
    "Keep this note",
  );
  await expect(page.locator(".awTracking")).toHaveCount(0);
});
test("missing location has no fabricated marker or recommendation", async ({
  page,
}) => {
  await fixture(page, { noLocation: true });
  await open(page);
  await page.locator(".awQueueRow").click();
  await expect(page.locator(".awMapNotice")).toContainText("requires verification");
  await expect(
    page.getByRole("button", { name: "Assign Rescue Team", exact: true }),
  ).toBeDisabled();
});
test("empty and failed API states have no fabricated values", async ({
  page,
}) => {
  await fixture(page, { empty: true });
  await open(page);
  await expect(page.locator(".awQueue")).toContainText(
    "No unassigned incidents",
  );
  await expect(page.locator(".awMetric strong")).toHaveText([
    "0",
    "0",
    "0",
    "0",
  ]);
});
test("server filters, keyboard selection, map selection and responsive themes", async ({
  page,
}) => {
  const api = await fixture(page);
  await open(page);
  await page
    .getByLabel("Search incident descriptions or locations")
    .fill("Fictional");
  await expect
    .poll(() => api.reads.some((url) => url.includes("search=Fictional")))
    .toBe(true);
  await page.locator(".awQueueRow").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".awRecommendations")).toContainText(
    "Test Water Rescue",
  );
  await page.locator(".awRecommendation").click();
  await expect(
    page.getByRole("combobox", { name: "Select rescue team", exact: true }),
  ).toHaveValue(api.team._id);
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    for (const width of [
      320, 375, 390, 430, 768, 1024, 1280, 1440, 1648, 1920,
    ]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 928 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        .toBe(true);
      if ([390, 768, 1440, 1648, 1920].includes(width))
        await page.screenshot({
          path: `test-results/assignment-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
});
