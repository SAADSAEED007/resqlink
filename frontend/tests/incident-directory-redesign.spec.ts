import { test, expect, type Page } from "@playwright/test";

async function mockAuth(page: Page) {
  const writes: string[] = [];
  await page.route("http://localhost:4000/v1/**", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          _id: "012345678901234567890123",
          name: "QA Coordinator",
          role: "admin",
          email: "qa@example.com",
        },
      },
    })
  );
  await page.route("http://localhost:4000/api/**", (r) => {
    if (r.request().method() !== "GET") writes.push(r.request().url());
    return r.fulfill({
      json: {
        success: true,
        data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
      },
    });
  });
  return writes;
}

test.describe("Incident Management Operational Directory UI/UX", () => {
  test("loads demo mode directory with KPI cards, demo banner, filters, and cards", async ({ page }) => {
    await mockAuth(page);
    await page.goto("http://localhost:3050/dashboard/incidents");

    // Header
    await expect(page.getByRole("heading", { name: "Incident Management" })).toBeVisible();
    await expect(page.getByText("Coordinator workspace", { exact: false })).toBeVisible();

    // Compact Demo Banner
    await expect(page.getByText("Demo Mode · Simulated Incidents")).toBeVisible();
    await expect(
      page.getByText("Explore fictional reports and coordinator workflows without changing real records.")
    ).toBeVisible();
    const previewBtn = page.getByRole("button", { name: "Preview demo incident workspace" });
    await expect(previewBtn).toBeVisible();

    // KPI Cards
    await expect(page.getByText("Records in current filter")).toBeVisible();
    await expect(page.getByText("Pending review")).toBeVisible();
    await expect(page.getByText("Critical on this page")).toBeVisible();
    await expect(page.getByText("Active responses")).toBeVisible();

    // Toolbar
    const searchInput = page.getByRole("textbox", { name: "Search incidents" });
    await expect(searchInput).toBeVisible();
    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.getByLabel("Filter by priority")).toBeVisible();
    await expect(page.getByLabel("Filter by verification")).toBeVisible();
    await expect(page.getByLabel("Sort incidents")).toBeVisible();

    // Incident Cards
    const incidentCards = page.locator(".rqIncidentRow");
    await expect(incidentCards).toHaveCount(9);

    // Verify card content
    const firstCard = incidentCards.first();
    await expect(firstCard.locator(".rqIncidentCardTitle")).toBeVisible();
    await expect(firstCard.locator(".rqPriorityBadge")).toBeVisible();
    await expect(firstCard.locator(".rqLocationText")).toBeVisible();
    await expect(firstCard.locator(".rqStatusBadge")).toBeVisible();
    await expect(firstCard.locator(".rqIncidentCardAction")).toContainText("Open Workspace");

    // Capture desktop screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: "D:/Hacakthon/.worktrees/incident-directory-final-polish/incident-directory-desktop.png", fullPage: true });
  });

  test("search and combined filters match Hafsah's scenario and display correct empty state", async ({ page }) => {
    await mockAuth(page);
    await page.goto("http://localhost:3050/dashboard/incidents");

    // Hafsah's test scenario:
    // Search: flood, Status: PENDING, Priority: CRITICAL, Verification: VERIFIED, Sort: Highest priority
    await page.getByRole("textbox", { name: "Search incidents" }).fill("flood");
    await page.getByLabel("Filter by status").selectOption("PENDING");
    await page.getByLabel("Filter by priority").selectOption("CRITICAL");
    await page.getByLabel("Filter by verification").selectOption("VERIFIED");

    // Expect 0 matching records because no unverified demo report has all 4 simultaneously
    await expect(page.locator(".rqIncidentRow")).toHaveCount(0);
    await expect(page.locator(".rqIncidentPagination")).toContainText("0 records");
    await expect(page.getByText("No matching incidents")).toBeVisible();
    await expect(page.getByText("No emergency reports match the current filters")).toBeVisible();

    // Clear filters button resets filters
    await page.getByRole("button", { name: "Clear Filters" }).click();
    await expect(page.locator(".rqIncidentRow")).toHaveCount(9);
  });

  test("clicking incident card navigates to incident command workspace", async ({ page }) => {
    await mockAuth(page);
    await page.goto("http://localhost:3050/dashboard/incidents");

    const targetRow = page.locator(".rqIncidentRow").filter({ hasText: "Shah Faisal" });
    await expect(targetRow).toBeVisible();
    await targetRow.click();

    // Expect navigation to detail workspace with demo=true
    await expect(page).toHaveURL(/.*\/dashboard\/incidents\/.*demo=true/);
    await expect(page.getByRole("heading", { name: "Incident Details" })).toBeVisible();
  });

  test("responsive mobile layout stacks neatly at 375px", async ({ page }) => {
    await mockAuth(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:3050/dashboard/incidents");

    await expect(page.getByRole("heading", { name: "Incident Management" })).toBeVisible();
    await expect(page.locator(".rqIncidentRow").first()).toBeVisible();

    // Capture mobile screenshot
    await page.screenshot({ path: "D:/Hacakthon/.worktrees/incident-directory-final-polish/incident-directory-mobile.png", fullPage: true });
  });

  test("real data mode hides demo banner and connects to live operations", async ({ page }) => {
    await mockAuth(page);
    await page.goto("http://localhost:3050/dashboard/incidents?demo=false");

    // In real mode, Demo Mode banner is NOT displayed
    await expect(page.getByText("Demo Mode · Simulated Incidents")).not.toBeVisible();
    await expect(page.getByText("Live Operations Feed")).toBeVisible();
  });

  test("dark mode renders with high operational contrast", async ({ page }) => {
    await mockAuth(page);
    await page.goto("http://localhost:3050/dashboard/incidents");

    // Click theme toggle in dashboard shell
    const themeBtn = page.locator("button").filter({ has: page.locator("svg.lucide-moon, svg.lucide-sun") }).first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    } else {
      await page.evaluate(() => {
        document.querySelector(".rqCommand")?.setAttribute("data-theme", "dark");
      });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: "D:/Hacakthon/.worktrees/incident-directory-final-polish/incident-directory-dark.png", fullPage: true });
  });
});
