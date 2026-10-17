import { test, expect, type Page } from "@playwright/test";

const admin = {
  _id: "012345678901234567890123",
  name: "Ayesha Khan",
  email: "admin@example.com",
  role: "admin",
};

async function mockAuth(page: Page) {
  await page.route("http://localhost:4000/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/user/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:3100",
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ success: true, data: admin }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("http://localhost:4000/api/**", async (route) => {
    // Return empty success arrays so demo fallback / live API is handled
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        success: true,
        data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      }),
    });
  });
}

test.describe("Emergency Operations Command Center Dashboard", () => {
  test("renders all key command center panels and KPI cards", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/dashboard");

    // 1. Heading & Brand
    await expect(
      page.getByRole("heading", { name: "Emergency Operations Command Center" }),
    ).toBeVisible();
    await expect(page.getByText("Simulation / Prototype")).toBeVisible();

    // 2. 4 KPI Cards
    await expect(page.getByText("Active Incidents")).toBeVisible();
    await expect(page.getByText("Critical Cases")).toBeVisible();
    await expect(page.getByText("Available Teams")).toBeVisible();
    await expect(page.getByText("Resolved Today")).toBeVisible();

    // 3. Operations Map and Legend
    await expect(
      page.getByRole("heading", { name: "Operations Map" }),
    ).toBeVisible();
    await expect(page.getByText("Map Legend")).toBeVisible();
    await expect(page.getByText("Critical Incident", { exact: true })).toBeVisible();

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-tile-pane")).toBeAttached();

    // 4. Priority Incident Queue
    await expect(
      page.getByRole("heading", { name: "Priority Incident Queue" }),
    ).toBeVisible();
    await expect(page.getByText("AI Confidence").first()).toBeVisible();

    // 5. Lower panels
    await expect(
      page.getByRole("heading", { name: "Rescue Team Availability" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Incident Trends" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent Activity & Assignments" }),
    ).toBeVisible();
  });

  test("search input filters priority incident queue in real time", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("Search locations, incidents, teams...");
    await expect(searchInput).toBeVisible();

    // Type 'Korangi'
    await searchInput.fill("Korangi");
    await expect(page.getByRole("heading", { name: "Severe Urban Flooding" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Building Structure Collapse" })).not.toBeVisible();

    // Clear search
    await searchInput.fill("");
    await expect(page.getByRole("heading", { name: "Building Structure Collapse" }).first()).toBeVisible();
  });

  test("clicking an incident opens the interactive detail modal", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/dashboard");

    // Click first incident
    await page.getByRole("heading", { name: "Severe Urban Flooding" }).first().click();

    // Verify modal content
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Risk Factor Analysis")).toBeVisible();
    await expect(dialog.getByText("Vulnerable Demographics")).toBeVisible();

    // Close modal
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("responsive viewport check: no horizontal overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await mockAuth(page);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Emergency Operations Command Center" }),
    ).toBeVisible();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    expect(noOverflow).toBe(true);
  });

  test("captures 1600px desktop reference screenshot", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await mockAuth(page);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Emergency Operations Command Center" }),
    ).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: testInfo.outputPath("dashboard-1600.png"),
      fullPage: true,
    });
  });
});
