import { test, expect } from "@playwright/test";

test.describe("Coordinator Notification System & Emergency SOS Popup", () => {
  let currentNotifications: any[] = [];
  let currentUnreadCount = 2;

  test.beforeEach(async ({ page }) => {
    // Default baseline notifications
    currentNotifications = [
      {
        id: "notif-001",
        type: "INCIDENT_CREATED",
        severity: "MEDIUM",
        title: "New SOS Report",
        message: "New FLOOD incident reported near Korangi (RESQ-000001).",
        incidentId: "671158d60c2d3a95bf0a1101",
        teamId: null,
        assignmentId: null,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "notif-002",
        type: "INCIDENT_REVIEW_REQUIRED",
        severity: "HIGH",
        title: "Incident Verification Required",
        message: "FLOOD incident RESQ-000001 flagged for coordinator verification.",
        incidentId: "671158d60c2d3a95bf0a1101",
        teamId: null,
        assignmentId: null,
        isRead: false,
        readAt: null,
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
    ];
    currentUnreadCount = 2;

    // 1. Mock user profile authentication
    await page.route(/\/v1\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: {
            _id: "012345678901234567890123",
            name: "Saad Coordinator",
            email: "coordinator@resqlink.org",
            role: "admin",
          },
        }),
      });
    });

    // 2. Mock unread count endpoint (reads from current state)
    await page.route(/\/api\/notifications\/unread-count/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: { unreadCount: currentUnreadCount },
        }),
      });
    });

    // 3. Mock notifications list endpoint (reads from current state)
    await page.route((url) => url.pathname === "/api/notifications", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: {
            items: currentNotifications,
            pagination: { page: 1, limit: 10, total: currentNotifications.length, totalPages: 1 },
          },
        }),
      });
    });

    // 4. Default fallback for other dashboard API calls to avoid 401s
    await page.route((url) => url.pathname.startsWith("/api/") && !url.pathname.includes("/notifications"), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
      });
    });
  });

  test("renders single notification bell with accurate unread badge and suppresses initial backlog toasts", async ({ page }) => {
    await page.goto("/dashboard");

    // Bell button should render exactly once
    const bellBtn = page.getByRole("button", { name: /Notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 15000 });

    // Verify unread badge shows count of 2
    const badge = bellBtn.locator(".rqNotificationBadge");
    await expect(badge).toHaveText("2", { timeout: 10000 });

    // Backlog notifications should NOT trigger emergency toast popups on initial load
    const toasts = page.locator(".rqEmergencyToast");
    await expect(toasts).toHaveCount(0);
  });

  test("opens notification dropdown, displays notifications, and allows marking all as read", async ({ page }) => {
    // Mock mark-all-read endpoint
    await page.route(/\/api\/notifications\/read-all/, async (route) => {
      currentNotifications = currentNotifications.map((n) => ({ ...n, isRead: true }));
      currentUnreadCount = 0;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: { success: true, updatedCount: 2 },
        }),
      });
    });

    await page.goto("/dashboard");

    const bellBtn = page.getByRole("button", { name: /Notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 15000 });

    // Verify badge shows 2 first
    const badge = bellBtn.locator(".rqNotificationBadge");
    await expect(badge).toHaveText("2", { timeout: 10000 });

    await bellBtn.click();

    // Popover dialog should open
    const popover = page.getByRole("dialog", { name: "Coordinator Notifications" });
    await expect(popover).toBeVisible();
    await expect(popover.getByText("Notifications")).toBeVisible();

    // Notification items should be visible
    await expect(popover.getByText("New SOS Report")).toBeVisible();
    await expect(popover.getByText("Incident Verification Required")).toBeVisible();

    // Click "Mark all read"
    const markAllBtn = popover.getByRole("button", { name: /Mark all read/i });
    await markAllBtn.click();

    // Badge should be hidden or removed
    await expect(bellBtn.locator(".rqNotificationBadge")).toHaveCount(0);
  });

  test("subsequent poll discovering new SOS displays emergency toast with review action", async ({ page }) => {
    // Start with 1 baseline notification
    currentNotifications = [
      {
        id: "notif-001",
        type: "INCIDENT_CREATED",
        severity: "MEDIUM",
        title: "New SOS Report",
        message: "Initial baseline report.",
        incidentId: "671158d60c2d3a95bf0a1101",
        teamId: null,
        assignmentId: null,
        isRead: true,
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    let pollCount = 0;
    const freshSosItem = {
      id: "notif-fresh-sos-999",
      type: "CRITICAL_INCIDENT",
      severity: "CRITICAL",
      title: "Urgent SOS — Coordinator Review Required",
      message: "Critical FLOOD incident reported near Malir, Karachi (RESQ-000123). Immediate coordinator review required.",
      incidentId: "671158d60c2d3a95bf0a9999",
      teamId: null,
      assignmentId: null,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    // Override list route for this test to switch data after initial baseline mounts
    await page.route((url) => url.pathname === "/api/notifications", async (route) => {
      pollCount++;
      const isFreshArrival = pollCount > 2;
      const items = isFreshArrival ? [freshSosItem, ...currentNotifications] : currentNotifications;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: {
            items,
            pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 },
          },
        }),
      });
    });

    // Override unread count route to match
    await page.route(/\/api\/notifications\/unread-count/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: { unreadCount: pollCount > 2 ? 1 : 0 },
        }),
      });
    });

    // Mock mark single read endpoint
    await page.route(/\/api\/notifications\/[^\/]+\/read/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          statusCode: 200,
          data: { id: "notif-fresh-sos-999", isRead: true },
        }),
      });
    });

    await page.goto("/dashboard");

    const bellBtn = page.getByRole("button", { name: /Notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 15000 });

    // Initial load: no emergency toasts should pop up for baseline items
    await expect(page.locator(".rqEmergencyToast")).toHaveCount(0);

    // Wait for subsequent poll (5s interval) to discover the new SOS arrival
    const toast = page.locator(".rqEmergencyToast");
    await expect(toast).toBeVisible({ timeout: 15000 });

    // Verify toast contents
    await expect(toast.getByText("Urgent SOS — Coordinator Review Required")).toBeVisible();
    await expect(toast.locator(".rqToastRefBadge")).toHaveText("RESQ-000123");
    await expect(toast.locator(".rqToastRealBadge")).toHaveText("Real SOS");

    // Verify Review action button is present and clickable
    const reviewBtn = toast.getByRole("button", { name: /Review/i });
    await expect(reviewBtn).toBeVisible();

    // Verify bell badge also automatically updated to 1
    const badge = bellBtn.locator(".rqNotificationBadge");
    await expect(badge).toHaveText("1");

    // Dismiss button dismisses the toast
    const dismissBtn = toast.locator(".rqEmergencyToastDismiss");
    await dismissBtn.click();
    await expect(page.locator(".rqEmergencyToast")).toHaveCount(0);
  });
});
