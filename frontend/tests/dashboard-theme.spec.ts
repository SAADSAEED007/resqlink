import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.route("http://localhost:4000/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          _id: "012345678901234567890123",
          name: "Test Coordinator",
          email: "test@example.com",
          role: "admin",
        },
      }),
    }),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Command Center", exact: true }),
  ).toBeVisible();
}
test("dashboard switches theme, persists across reload and themes incident details", async ({
  page,
}, info) => {
  await open(page);
  const shell = page.locator(".rqCommand");
  await expect(shell).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(shell).toHaveAttribute("data-theme", "dark");
  expect(
    await shell.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(6, 20, 37)");
  await page.screenshot({
    path: info.outputPath("dashboard-dark.png"),
    fullPage: true,
  });
  await page.locator(".rqCommandIncident").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(15, 34, 57)");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(shell).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(shell).toHaveAttribute("data-theme", "light");
});
test("theme toggle fits 320px and stays usable when storage is blocked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("resqlink:dashboard-theme", "light");
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("Storage unavailable");
      },
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator(".rqCommand")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator(".rqCommand")).toHaveAttribute(
    "data-theme",
    "light",
  );
});
