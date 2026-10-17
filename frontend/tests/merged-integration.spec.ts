import { test, expect, type Page, type Route } from "@playwright/test";
import {
  MOCK_INCIDENTS,
  MOCK_RESCUE_TEAMS,
} from "../src/components/dashboard/mock-data";
import type { Incident, RescueTeam } from "../src/types/api";
import type { RiskZone } from "../src/types/risk-zones";
import { emptyZone, zoneInput } from "../src/components/risk-zones/zone-form";
const id = "661200000000000000000099";
const zone: RiskZone = {
  _id: id,
  communityName: "SIMULATED Field Community",
  district: "Dadu",
  approximateLocation: {
    landmarkDescription: "SIMULATED river bridge",
    isLocationEstimated: true,
  },
  hazardType: "FLOOD_INUNDATION",
  hazardSeverity: "HIGH",
  connectivityStatus: "NO_CELL_COVERAGE",
  informationConfidence: "MEDIUM",
  confidenceReasons: ["Coordinates unavailable"],
  assessmentStatus: "PENDING_ASSESSMENT",
  statusHistory: [],
  isSimulated: true,
  createdAt: "2026-10-17T10:00:00Z",
  updatedAt: "2026-10-17T10:00:00Z",
};
async function reply(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: status < 400, data }),
  });
}
async function auth(page: Page, role = "admin") {
  await page.route("http://localhost:4000/v1/**", (route) =>
    reply(route, {
      _id: id,
      name: "SIMULATED Coordinator",
      email: "test@example.com",
      role,
    }),
  );
}
async function setup(page: Page, fail?: number | "network") {
  await auth(page);
  let incident: Incident = {
    ...structuredClone(MOCK_INCIDENTS[0]),
    isSimulated: false,
    verification: {
      status: "NEEDS_REVIEW",
      requiresManualReview: true,
      isPotentialDuplicate: true,
      potentialDuplicateIncidents: [id],
      missingFields: [],
      warnings: ["Possible duplicate needs coordinator review"],
    },
  };
  let team: RescueTeam = {
    ...structuredClone(MOCK_RESCUE_TEAMS[0]),
    status: "AVAILABLE",
    currentIncident: null,
    isSimulated: false,
  };
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("http://localhost:4000/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method !== "GET") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (fail === "network") return route.abort("connectionfailed");
      if (fail) return reply(route, null, fail);
      if (path.endsWith("verification")) {
        incident = {
          ...incident,
          verification: {
            ...incident.verification!,
            status: body.status,
            reviewNotes: body.notes,
          },
        };
        return reply(route, incident);
      }
      if (path.endsWith("assignments")) {
        incident = { ...incident, status: "ASSIGNED", assignedTeam: team._id };
        team = { ...team, status: "BUSY", currentIncident: incident._id };
        return reply(
          route,
          {
            _id: id,
            incidentId: incident._id,
            teamId: team._id,
            status: "ACTIVE",
          },
          201,
        );
      }
      if (path.endsWith("status")) {
        incident = { ...incident, status: body.status };
        if (body.status === "RESOLVED") {
          incident.assignedTeam = null;
          team = { ...team, status: "AVAILABLE", currentIncident: null };
        }
        return reply(route, incident);
      }
      return reply(route, null, 404);
    }
    if (path.endsWith("recommendations"))
      return reply(route, {
        manualSelectionRequired: false,
        distanceType: "APPROXIMATE_STRAIGHT_LINE_KM",
        message: "Manual coordinator selection required.",
        items: [
          {
            team,
            approximateDistanceKm: 2.5,
            capacityWarning: "Multiple trips may be needed",
          },
        ],
      });
    if (path.endsWith(incident._id)) return reply(route, incident);
    return reply(route, {
      items: path.endsWith("incidents")
        ? [incident]
        : path.endsWith("rescue-teams")
          ? [team]
          : [],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });
  return { writes, teamId: team._id };
}
async function openIncident(page: Page) {
  await page.goto("/dashboard?demo=false");
  await page.locator(".rqCommandIncident").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("merged verification, recommendations, assignment and lifecycle clients use confirmed routes", async ({
  page,
}) => {
  const { writes, teamId } = await setup(page);
  await openIncident(page);
  await expect(
    page.getByText("Possible duplicate needs coordinator review"),
  ).toBeVisible();
  await page
    .getByLabel("Verification decision", { exact: false })
    .selectOption("VERIFIED");
  await page
    .getByLabel("Review notes", { exact: false })
    .fill("SIMULATED reviewed via radio");
  await page
    .getByRole("button", { name: "Record verification", exact: true })
    .click();
  await expect(page.getByText("Verification review recorded.")).toBeVisible();
  await page.getByRole("button", { name: "Load team recommendations" }).click();
  await expect(
    page.getByText(/Distances are approximate straight-line/),
  ).toBeVisible();
  await page.getByLabel("Available team", { exact: false }).selectOption(teamId);
  await page.getByRole("button", { name: "Confirm team assignment" }).click();
  await expect(
    page.getByLabel("New incident status", { exact: false }),
  ).toContainText("IN PROGRESS");
  await page
    .getByLabel("New incident status", { exact: false })
    .selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Confirm status change" }).click();
  await expect(
    page.getByLabel("New incident status", { exact: false }),
  ).toContainText("RESOLVED");
  await page
    .getByLabel("New incident status", { exact: false })
    .selectOption("RESOLVED");
  await page.getByRole("button", { name: "Confirm status change" }).click();
  await expect(page.getByText("Incident status updated.")).toBeVisible();
  await expect(
    page.getByLabel("New incident status", { exact: false }),
  ).toHaveCount(0);
  expect(writes.map((w) => w.path)).toEqual([
    `/api/incidents/${MOCK_INCIDENTS[0]._id}/verification`,
    "/api/assignments",
    `/api/incidents/${MOCK_INCIDENTS[0]._id}/status`,
    `/api/incidents/${MOCK_INCIDENTS[0]._id}/status`,
  ]);
  expect(writes[0].body).toEqual({
    status: "VERIFIED",
    notes: "SIMULATED reviewed via radio",
  });
  expect(writes[1].body).toEqual({ incidentId: MOCK_INCIDENTS[0]._id, teamId });
});
for (const failure of [400, 409, "network"] as const)
  test(`incident mutation failure ${failure} preserves notes without false success`, async ({
    page,
  }) => {
    const { writes } = await setup(page, failure);
    await openIncident(page);
    await page
      .getByLabel("Verification decision", { exact: false })
      .selectOption("VERIFIED");
    await page
      .getByLabel("Review notes", { exact: false })
      .fill("SIMULATED retained review notes");
    await page
      .getByRole("button", { name: "Record verification", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Review notes", { exact: false })).toHaveValue(
      "SIMULATED retained review notes",
    );
    await expect(page.getByText("Verification review recorded.")).toHaveCount(
      0,
    );
    expect(writes).toHaveLength(1);
    if (failure === "network") {
      await expect(
        page.getByRole("button", { name: "Record verification", exact: true }),
      ).toBeDisabled();
      await page.getByLabel(/I reviewed current records/).check();
      await expect(
        page.getByRole("button", { name: "Record verification", exact: true }),
      ).toBeEnabled();
    }
  });
test("demo incident actions stay read-only", async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto("/dashboard");
  await page.locator(".rqCommandIncident").first().click();
  await expect(page.getByText(/Demo records are read-only/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record verification", exact: true }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

async function riskSetup(page: Page, failMutation = false) {
  await auth(page);
  let current = structuredClone(zone);
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const queries: string[] = [];
  await page.route("http://localhost:4000/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (!path.includes("community-risk-zones"))
      return reply(route, {
        items: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });
    if (method !== "GET") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (failMutation) return reply(route, null, 400);
      if (method === "POST" && path.endsWith("community-risk-zones")) {
        current = { ...current, ...body, isSimulated: false };
        return reply(route, current, 201);
      }
      if (path.endsWith("assessment")) {
        current = {
          ...current,
          assessmentStatus: "ASSESSMENT_DISPATCHED",
          fieldAssessment: {
            ...body,
            requestedAt: "2026-10-17T12:00:00Z",
            requestedBy: id,
          },
        };
        return reply(route, current, 201);
      }
      if (path.endsWith("status")) {
        current = { ...current, assessmentStatus: body.status };
        return reply(route, current);
      }
      return reply(route, null, 404);
    }
    if (path.endsWith(id)) return reply(route, current);
    queries.push(url.search);
    return reply(route, {
      items: [current],
      pagination: {
        page: Number(url.searchParams.get("page") || 1),
        limit: 20,
        total: 21,
        totalPages: 2,
      },
    });
  });
  return { writes, queries };
}
async function fillZone(page: Page) {
  await page
    .getByRole("button", { name: "Register community", exact: true })
    .click();
  await page
    .getByLabel("Community name", { exact: false })
    .fill("SIMULATED New Community");
  await page.getByRole("textbox", { name: "District", exact: true }).fill("Dadu");
  await page
    .getByLabel("Approximate landmark", { exact: false })
    .fill("SIMULATED bridge landmark");
  await page
    .getByLabel("Hazard type", { exact: false })
    .selectOption("FLOOD_INUNDATION");
  await page
    .getByLabel("Hazard severity", { exact: false })
    .selectOption("HIGH");
  await page
    .getByLabel("Information confidence", { exact: false })
    .selectOption("MEDIUM");
}
for (const width of [320, 768, 1440])
  test(`risk-zone registration, details and assessment actions fit ${width}px`, async ({
    page,
  }, info) => {
    const { writes, queries } = await riskSetup(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard/risk-zones");
    await expect(
      page.getByRole("heading", { name: "Community Risk Zones", exact: true }),
    ).toBeVisible();
    await fillZone(page);
    await page
      .getByLabel("Estimated vulnerable population (optional)", { exact: false })
      .fill("0");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`risk-registration-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Save community risk zone", exact: true })
      .click();
    await expect(
      page.getByText("Community risk zone registered."),
    ).toBeVisible();
    expect(writes[0].body).toMatchObject({
      approximateLocation: {
        landmarkDescription: "SIMULATED bridge landmark",
        isLocationEstimated: true,
      },
      vulnerablePopulation: { estimatedVulnerableCount: 0 },
    });
    expect(writes[0].body).not.toHaveProperty("isSimulated");
    expect(writes[0].body.approximateLocation).not.toHaveProperty("latitude");
    await page
      .getByLabel("Assessment urgency", { exact: false })
      .selectOption("URGENT");
    await page
      .getByLabel("Assessment request notes", { exact: false })
      .fill("SIMULATED field verification needed");
    await page
      .getByRole("button", { name: "Record assessment request", exact: true })
      .click();
    await expect(
      page.getByText(
        "Field assessment request recorded; no official dispatch performed.",
      ),
    ).toBeVisible();
    await page
      .getByLabel("New assessment status", { exact: false })
      .selectOption("ASSESSMENT_COMPLETED");
    await page
      .getByLabel("Assessment status notes", { exact: false })
      .fill("SIMULATED field visit recorded");
    await page
      .getByRole("button", { name: "Save assessment status", exact: true })
      .click();
    await expect(page.getByText("Assessment status updated.")).toBeVisible();
    expect(writes.map((w) => w.path)).toEqual([
      "/api/community-risk-zones",
      `/api/community-risk-zones/${id}/assessment`,
      `/api/community-risk-zones/${id}/status`,
    ]);
    await page.getByLabel("Filter district", { exact: false }).fill("Dadu");
    await page.getByRole("button", { name: "Apply district" }).click();
    await expect
      .poll(() => queries.some((q) => q.includes("district=Dadu")))
      .toBe(true);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect
      .poll(() => queries.some((q) => q.includes("page=2")))
      .toBe(true);
    await page.screenshot({
      path: info.outputPath(`risk-detail-${width}.png`),
      fullPage: true,
    });
  });
test("risk-zone validation and backend rejection preserve the registration draft", async ({
  page,
}) => {
  const { writes } = await riskSetup(page, true);
  await page.goto("/dashboard/risk-zones");
  await fillZone(page);
  await page.getByLabel("Latitude (optional)", { exact: false }).fill("95");
  await page.getByLabel("Longitude (optional)", { exact: false }).fill("67");
  await page
    .getByRole("button", { name: "Save community risk zone", exact: true })
    .click();
  await expect(page.getByText(/Enter both valid coordinates/)).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByLabel("Latitude (optional)", { exact: false }).fill("");
  await page.getByLabel("Longitude (optional)", { exact: false }).fill("");
  await page
    .getByRole("button", { name: "Save community risk zone", exact: true })
    .click();
  await expect(page.getByText(/Check the submitted details/)).toBeVisible();
  await expect(page.getByLabel("Community name", { exact: false })).toHaveValue(
    "SIMULATED New Community",
  );
  await expect(page.getByText("Community risk zone registered.")).toHaveCount(
    0,
  );
});
test("risk zones stay behind coordinator access control", async ({ page }) => {
  await auth(page, "user");
  await page.goto("/dashboard/risk-zones");
  await expect(
    page.getByRole("heading", { name: "Coordinator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register community", exact: true }),
  ).toHaveCount(0);
});

test("risk-zone payload preserves unknowns, known zero and valid zero coordinates", () => {
  const draft = {
    ...emptyZone,
    communityName: "SIMULATED Community",
    district: "Dadu",
    landmark: "SIMULATED bridge",
    hazardType: "FLOOD_INUNDATION",
    hazardSeverity: "HIGH",
    confidence: "MEDIUM",
  };
  const input = zoneInput(draft);
  expect(input).not.toHaveProperty("vulnerablePopulation");
  expect(input.approximateLocation).not.toHaveProperty("latitude");
  expect(
    zoneInput({ ...draft, latitude: "0", longitude: "0", vulnerable: "0" }),
  ).toMatchObject({
    approximateLocation: { latitude: 0, longitude: 0 },
    vulnerablePopulation: { estimatedVulnerableCount: 0 },
  });
  expect(() => zoneInput({ ...draft, latitude: "91", longitude: "0" })).toThrow(
    /coordinates/,
  );
  expect(() => zoneInput({ ...draft, population: "-1" })).toThrow(/Population/);
  expect(() => zoneInput({ ...draft, communityName: "<script>" })).toThrow(
    /angle/,
  );
});
