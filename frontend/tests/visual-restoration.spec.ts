import { test, expect } from "@playwright/test";

test("dashboard visual review", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://localhost:4000/**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { _id: "012345678901234567890123", name: "Ayesha Khan", role: "admin", email: "admin@example.com" } }),
  }));
  await page.route("http://localhost:4000/api/**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } } }),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard?demo=true");
  await expect(page.locator(".rqCommandIncident").first()).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  // Development chrome is outside the application and obscures the sidebar footer.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(1500);
  await expect(page.locator(".rqCommandPromo img")).toBeVisible();
  await expect(page.locator(".rqMapMarker").first()).toBeVisible();
  expect(await page.locator(".rqMapMarker svg").count()).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("final-dark-1440.png"), fullPage: true });
  await page.locator(".rqCommandPromo").screenshot({ path: info.outputPath("sidebar-detail.png") });
  await page.locator(".rqCommandMap").screenshot({ path: info.outputPath("map-detail.png") });
  await page.locator(".rqCommandQueue").screenshot({ path: info.outputPath("queue-detail.png") });
  await page.locator(".rqMapMarker").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(page.locator(".rqCommandMap")).toHaveClass(/is-expanded/);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Reset map view", exact: true }).click();
  await page.waitForTimeout(350);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.locator(".rqTeamRoster button").first().click();
  await expect(page.locator(".rqCommandTeamDetail")).toBeVisible();
  await page.getByRole("button", { name: "Close team details" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({ path: info.outputPath("final-light-1440.png"), fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1920 ? 1080 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
    if (width === 390 || width === 1920) {
      await page.screenshot({ path: info.outputPath(`final-dark-${width}.png`), fullPage: true });
    }
    if (width < 1280) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(page.getByRole("link", { name: "Public Portal" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1440, height: 600 });
  const sidebar = page.locator(".rqCommandSidebar");
  await sidebar.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator(".rqCommandPromo")).toBeInViewport();
  await page.getByRole("button", { name: "Connect to API" }).click();
  await expect(page.locator(".rqMapMarker")).toHaveCount(0);
  await expect(page.getByText("Historical trend data is not available from the current API.")).toBeVisible();
  expect(errors).toEqual([]);
});
