import { test, expect, type Page } from "./map-test-fixtures";
import { districts } from "../../backend/src/APIs/weather/districts";
import type { MonitoredDistrict, RiskZone } from "../src/types/risk-zones";
function forecast(rain = 24) {
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  return {
    provider: "Open-Meteo",
    latitude: 25.4,
    longitude: 68.4,
    timezone: "Asia/Karachi",
    retrievedAt: new Date().toISOString(),
    freshness: "cached" as "cached" | "stale",
    current: {
      time: start.toISOString(),
      temperatureC: 28.4,
      weatherCode: 61,
      windKmh: 14,
    },
    next24Hours: {
      start: start.toISOString(),
      end: new Date(+start + 86400000).toISOString(),
      precipitationMm: rain,
      maxProbabilityPercent: 65,
      hourlyPeriods: 24,
    },
    hourly: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(+start + i * 3600000).toISOString(),
      precipitationMm: rain / 24,
      probabilityPercent: 65,
      windKmh: 14,
    })),
    days: Array.from({ length: 4 }, (_, i) => ({
      time: new Date(+start + i * 86400000).toISOString(),
      weatherCode: [61, 3, 2, 0][i],
      maxC: 28 + i,
      minC: 22 + i,
      precipitationMm: rain / (i + 1),
      probabilityPercent: 65 - i * 10,
    })),
  };
}
async function setup(
  page: Page,
  options: {
    configured?: boolean;
    aiFail?: boolean;
    allUnavailable?: boolean;
    cooldown?: boolean;
    stale?: boolean;
  } = {},
) {
  let aiCalls = 0;
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const communities: RiskZone[] = [];
  const items: MonitoredDistrict[] = districts.map((record, index) => {
    const level =
      options.allUnavailable || options.stale
        ? "DATA_UNAVAILABLE"
        : index === 0
          ? "ELEVATED"
          : index === 1
            ? "URGENT_REVIEW"
            : index === 2
              ? "DATA_UNAVAILABLE"
              : "ROUTINE";
    return {
      ...record,
      weather: options.stale
        ? { ...forecast(), freshness: "stale" }
        : level === "DATA_UNAVAILABLE"
          ? null
          : forecast(index === 1 ? 60 : index === 0 ? 24 : 0),
      attention: {
        level,
        reasonCode: "TEST_FORECAST",
        reasons: [
          level === "DATA_UNAVAILABLE"
            ? "Forecast provider unavailable."
            : "Fixture forecast input meets configured prototype review criteria.",
        ],
        policy: {
          version: "prototype-rainfall-v1",
          elevatedRainMm: 20,
          urgentRainMm: 50,
          disclaimer:
            "Prototype attention heuristics, not official warning thresholds.",
        },
      },
      providerState: level === "DATA_UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
      error: level === "DATA_UNAVAILABLE" ? "Provider unavailable" : "",
      aiConfigured: !!options.configured,
      model: "openai/gpt-oss-20b",
    };
  });
  await page.route("http://localhost:4000/v1/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          _id: "012345678901234567890123",
          name: "Test Coordinator",
          role: "admin",
          email: "test@example.com",
        },
      }),
    }),
  );
  await page.route("http://localhost:4000/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ success: status < 400, data }),
      });
    if (req.method() !== "GET") {
      if (path.endsWith("/ai-analysis")) {
        aiCalls++;
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (options.aiFail) return reply(null, 503);
        return reply({
          summary:
            "Open-Meteo forecast accumulation: 24 mm. Human review required.",
          reviewLevel: "ELEVATED",
          keyInsights: [
            {
              title: "Forecast accumulation",
              explanation: "Recorded forecast accumulation: 24 mm.",
              evidenceReferences: ["weather:forecast"],
            },
          ],
          preparednessActions: [
            {
              action: "Monitor updated weather forecasts.",
              reason: "General preparedness precaution.",
              priority: "REVIEW",
            },
          ],
          missingInformation: ["River levels unavailable."],
          limitations: ["Not a flood prediction."],
          provider: "Groq",
          model: "openai/gpt-oss-20b",
          generatedAt: new Date().toISOString(),
          sessionOnly: true,
        });
      }
      const body = req.postDataJSON();
      writes.push({ path, body });
      if (path === "/api/community-risk-zones") {
        const zone = {
          ...body,
          _id: "662200000000000000000099",
          assessmentStatus: "PENDING_ASSESSMENT",
          statusHistory: [],
          isSimulated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as RiskZone;
        communities.push(zone);
        return reply(zone, 201);
      }
      const zone = communities[0];
      if (zone && path.endsWith("/assessment")) {
        zone.fieldAssessment = {
          ...body,
          requestedBy: "012345678901234567890123",
          requestedAt: new Date().toISOString(),
        };
        zone.assessmentStatus = "ASSESSMENT_DISPATCHED";
        return reply(zone, 201);
      }
      return reply(null, 404);
    }
    if (path === "/api/weather/districts")
      return reply({
        items: districts,
        coverage: "Seven verified districts; partial Sindh coverage.",
        datasetVersion: "test",
      });
    if (path === "/api/weather/districts/overview")
      return reply({
        items,
        unavailable: items.filter((item) => !item.weather).length,
        coverage:
          "Verified seven-district subset; remaining Sindh districts are not configured.",
        datasetVersion: "test",
        retrievedAt: new Date().toISOString(),
        provider: options.cooldown
          ? {
              state: "COOLDOWN",
              reason: "RATE_LIMITED",
              retryAt: new Date(Date.now() + 300000).toISOString(),
              cacheTtlSeconds: 1200,
            }
          : undefined,
      });
    if (path.startsWith("/api/weather/districts/"))
      return reply(items.find((item) => item.id === path.split("/").at(-1)));
    if (path === "/api/shelters")
      return reply({
        items: [
          {
            _id: "662200000000000000000088",
            name: "Fixture Shelter",
            address: "Test shelter address",
            location: { latitude: 25.4, longitude: 68.4 },
            status: "OPEN",
            totalCapacity: 100,
            currentOccupancy: 20,
            availableSpaces: 80,
            approximateDistanceKm: 2.4,
            isSimulated: false,
          },
        ],
      });
    if (path.endsWith("/resources"))
      return reply([
        { category: "WATER", quantity: 40, unit: "liters", status: "ADEQUATE" },
      ]);
    if (path === "/api/community-risk-zones") {
      const district = url.searchParams.get("district");
      const filtered = communities.filter(
        (zone) => !district || zone.district === district,
      );
      return reply({
        items: filtered,
        pagination: {
          page: 1,
          limit: 20,
          total: filtered.length,
          totalPages: filtered.length ? 1 : 0,
        },
      });
    }
    if (path.startsWith("/api/community-risk-zones/"))
      return reply(
        communities.find((zone) => zone._id === path.split("/").at(-1)),
      );
    if (path === "/api/dashboard/summary")
      return reply({
        incidents: {
          active: 0,
          critical: 0,
          high: 0,
          resolvedToday: 0,
          total: 0,
        },
        teams: { available: 0, busy: 0, offline: 0, total: 0 },
        assignments: { active: 0 },
        trends: { last24Hours: [], last7Days: [] },
      });
    return reply({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
  return { items, writes, aiCalls: () => aiCalls };
}
async function open(page: Page) {
  await page.goto("/dashboard/risk-zones");
  await expect(
    page.getByRole("heading", {
      name: "Sindh Disaster Risk Intelligence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".siDistrictRow")).toHaveCount(7);
}

test("refresh respects the backend weather cache and completes", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/dashboard/risk-zones");
  const refresh = page.getByRole("button", {
    name: "Refresh Weather",
    exact: true,
  });
  await expect(refresh).toBeEnabled();
  const request = page.waitForRequest((req) => {
    const url = new URL(req.url());
    return (
      url.pathname === "/api/weather/districts/overview" &&
      !url.searchParams.has("refresh")
    );
  });
  await refresh.click();
  await request;
  await expect(refresh).toBeEnabled();
  await expect(page.getByText(/Last forecast update/)).toBeVisible();
});

test("automatic monitoring works with zero communities and honest partial coverage", async ({
  page,
}) => {
  const api = await setup(page);
  await open(page);
  await expect(page.locator(".siMetric strong")).toHaveText([
    "7",
    "1",
    "1",
    "4",
  ]);
  await expect(page.locator(".siCoverage")).toContainText("1 data unavailable");
  expect(api.aiCalls()).toBe(0);
  await page
    .getByRole("tab", { name: "Local Assessments", exact: true })
    .click();
  await expect(
    page.getByText("No local community assessments recorded yet."),
  ).toBeVisible();
});

test("cooldown refresh keeps stale timestamps and unavailable classification without refetching detail", async ({
  page,
}) => {
  await setup(page, { cooldown: true, stale: true, configured: true });
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/weather/districts")) reads.push(request.url());
  });
  await open(page);
  await expect(page.getByText(/Weather provider rate limited/)).toBeVisible();
  await expect(page.locator(".siMetric strong")).toHaveText([
    "7",
    "0",
    "0",
    "0",
  ]);
  await expect(
    page.getByRole("button", { name: "Generate Updated Analysis" }),
  ).toBeDisabled();
  await expect
    .poll(
      () =>
        reads.filter((url) => new URL(url).pathname.endsWith("/hyderabad"))
          .length,
    )
    .toBe(1);
  const stamp = await page.getByText(/Last forecast update/).innerText();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Refresh Weather", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Refresh Weather", exact: true }),
    ).toBeEnabled();
  }
  expect(reads.some((url) => new URL(url).searchParams.has("refresh"))).toBe(
    false,
  );
  expect(
    reads.filter((url) => new URL(url).pathname.endsWith("/hyderabad")),
  ).toHaveLength(1);
  await expect(page.getByText(/Last forecast update/)).toHaveText(stamp);
});

test("cooldown with no cache finishes loading and does not request district weather", async ({
  page,
}) => {
  await setup(page, { cooldown: true, allUnavailable: true });
  const details: string[] = [];
  page.on("request", (request) => {
    if (/\/weather\/districts\/hyderabad/.test(request.url()))
      details.push(request.url());
  });
  await open(page);
  await expect(page.getByText(/Weather provider rate limited/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh Weather", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".siCoverage")).toContainText(
    "No successful forecast update",
  );
  await expect(page.locator(".siMetric strong")).toHaveText([
    "7",
    "0",
    "0",
    "0",
  ]);
  expect(details).toEqual([]);
});
test("search, attention filter and map-directory selection synchronize", async ({
  page,
}) => {
  await setup(page);
  await open(page);
  await page.getByLabel("Search districts").fill("Badin");
  await expect(page.locator(".siDistrictRow")).toHaveCount(1);
  await page.locator(".siDistrictRow").click();
  await expect(page.locator(".siDistrictIntro h3")).toHaveText("Badin");
  await page.getByLabel("Search districts").fill("");
  await page
    .getByLabel("Filter weather attention")
    .selectOption("URGENT_REVIEW");
  await expect(page.locator(".siDistrictRow")).toHaveCount(1);
  await page.getByLabel("Filter weather attention").selectOption("");
  await page
    .getByRole("button", {
      name: "Show Sindh monitoring locations",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select district Sukkur", exact: true })
    .click();
  await expect(page.locator(".siDistrictIntro h3")).toHaveText("Sukkur");
  await expect(page.locator(".siDistrictRow[aria-pressed=true]")).toContainText(
    "Sukkur",
  );
});
test("missing key disables AI and failed forecasts never count as routine", async ({
  page,
}) => {
  const api = await setup(page, { allUnavailable: true });
  await open(page);
  await expect(page.locator(".siMetric strong")).toHaveText([
    "7",
    "0",
    "0",
    "0",
  ]);
  await expect(page.locator(".siCoverage")).toContainText("7 data unavailable");
  await expect(
    page.getByRole("button", { name: "Generate Updated Analysis" }),
  ).toBeDisabled();
  await expect(
    page.getByText("AI analysis is not configured.", { exact: true }),
  ).toBeVisible();
  expect(api.aiCalls()).toBe(0);
});
test("AI action is explicit, duplicate protected, cited and independent of refresh", async ({
  page,
}) => {
  const api = await setup(page, { configured: true });
  await open(page);
  expect(api.aiCalls()).toBe(0);
  await page.getByRole("button", { name: "Generate Updated Analysis" }).click();
  await expect(
    page.getByRole("button", { name: /Analyzing forecast evidence/ }),
  ).toBeDisabled();
  await expect(page.locator(".siAnalysisSummary")).toContainText("24 mm");
  await expect(page.locator(".siAi")).toContainText("weather:forecast");
  expect(api.aiCalls()).toBe(1);
  await page
    .getByRole("button", { name: "Refresh Weather", exact: true })
    .click();
  await expect(page.locator(".siDistrictRow")).toHaveCount(7);
  expect(api.aiCalls()).toBe(1);
});
test("AI errors do not fabricate results", async ({ page }) => {
  await setup(page, { configured: true, aiFail: true });
  await open(page);
  await page.getByRole("button", { name: "Generate Updated Analysis" }).click();
  await expect(page.locator(".siAi [role=alert]")).toBeVisible();
  await expect(page.locator(".siAnalysisSummary")).toHaveCount(0);
});
test("forecast evidence and nearby shelter inventory use supported fields", async ({
  page,
}) => {
  await setup(page);
  await open(page);
  await page
    .getByRole("tab", { name: "Forecast Evidence", exact: true })
    .click();
  await expect(
    page.getByText("24 mm / 24 hourly periods", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("14 km/h", { exact: true })).toBeVisible();
  await page
    .getByRole("tab", { name: "Nearby Resources", exact: true })
    .click();
  await expect(
    page.getByText("Fixture Shelter", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".siDetailBody")).toContainText(
    "2.4 km straight-line",
  );
  await page.getByText("Relief inventory", { exact: true }).click();
  await expect(page.locator(".siDetailBody")).toContainText("40 liters");
});
test("secondary community registration remains functional", async ({
  page,
}) => {
  const api = await setup(page);
  await open(page);
  await page
    .getByRole("tab", { name: "Community Assessments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Register community", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Community name", exact: true })
    .fill("Fictional test community");
  await page
    .getByRole("textbox", { name: "District", exact: true })
    .fill("Hyderabad");
  await page
    .getByRole("textbox", { name: "Approximate landmark", exact: true })
    .fill("Fictional test landmark");
  await page
    .getByRole("combobox", { name: "Hazard type", exact: true })
    .selectOption("FLASH_FLOOD");
  await page
    .getByRole("combobox", { name: "Hazard severity", exact: true })
    .selectOption("HIGH");
  await page
    .getByRole("combobox", { name: "Information confidence", exact: true })
    .selectOption("MEDIUM");
  await page
    .getByRole("button", { name: "Save community risk zone", exact: true })
    .click();
  await expect(
    page.getByText("Community risk zone registered.", { exact: true }),
  ).toBeVisible();
  expect(api.writes[0].body.communityName).toBe("Fictional test community");
  await page
    .getByRole("combobox", { name: "Assessment urgency", exact: true })
    .selectOption("URGENT");
  await page
    .getByRole("textbox", { name: "Assessment request notes", exact: true })
    .fill("Fictional field observation for automated test.");
  await page
    .getByRole("button", { name: "Record assessment request", exact: true })
    .click();
  await expect(
    page.getByText(
      "Field assessment request recorded; no official dispatch performed.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(api.writes.at(-1)?.body.priorityUrgency).toBe("URGENT");
});
test("responsive light-first and dark visual comparison", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await setup(page, { configured: true });
  await page.setViewportSize({ width: 1648, height: 928 });
  await open(page);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await expect(page.locator(".siMap.leaflet-container")).toBeVisible();
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1648, 1920]) {
    await page.setViewportSize({
      width,
      height: width === 390 ? 844 : width === 1648 ? 928 : 900,
    });
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
    if ([390, 768, 1440, 1648].includes(width))
      await page.screenshot({
        path: info.outputPath(`sindh-light-${width}.png`),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1648, height: 928 });
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: info.outputPath("sindh-dark-1648.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: info.outputPath("sindh-dark-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Generate Updated Analysis" }).click();
  await page.screenshot({
    path: info.outputPath("sindh-ai-loading.png"),
    fullPage: true,
  });
  await expect(page.locator(".siAnalysisSummary")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("sindh-ai-result.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Incidents", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/incidents$/);
  expect(errors).toEqual([]);
});
