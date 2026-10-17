import { test, expect, type Page } from "@playwright/test";
const admin = {
  _id: "012345678901234567890123",
  name: "SIMULATED Coordinator",
  email: "admin@example.com",
  role: "admin",
};
async function mockAuth(
  page: Page,
  options: {
    signedIn?: boolean;
    role?: string;
    invalid?: boolean;
    offline?: boolean;
    logoutFails?: boolean;
  } = {},
) {
  let signedIn = options.signedIn ?? false;
  await page.route("http://localhost:4000/v1/**", async (route) => {
    if (options.offline) return route.abort("connectionfailed");
    const path = new URL(route.request().url()).pathname;
    let status = 200;
    let data: unknown = null;
    if (path === "/v1/login") {
      if (options.invalid) status = 400;
      else {
        signedIn = true;
        data = {
          user: admin,
          accessToken: "discard-me",
          refreshToken: "discard-me",
        };
      }
    } else if (path === "/v1/user/me") {
      if (!signedIn) status = 401;
      else data = { ...admin, role: options.role ?? "admin" };
    } else if (path === "/v1/logout") {
      if (options.logoutFails) status = 500;
      else signedIn = false;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ success: status === 200, data }),
    });
  });
}
for (const width of [375, 768, 1280, 1440])
  test(`public and protected layouts fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockAuth(page);
    for (const path of ["/", "/login", "/sos"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${path.replaceAll("/", "") || "landing"}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    await page.unrouteAll();
    await mockAuth(page, { signedIn: true });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", {
        name: "Command Center",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(
        page.getByRole("navigation", { name: "Command center" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).click();
    }
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    });
  });
test("public navigation and keyboard skip link", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Request Emergency Help" }).click();
  await expect(page).toHaveURL(/\/sos$/);
  await expect(
    page.getByRole("heading", {
      name: "Report an Emergency",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
});
test("validates fields, toggles password, and reports invalid login", async ({
  page,
}) => {
  await mockAuth(page, { invalid: true });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("Demo!Pass123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel(/^Password/)).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Sign-in could not be verified",
  );
  await expect(page).toHaveURL(/\/login$/);
});
test("mocked cookie session flow, dialog keyboard behavior, logout, and no token storage", async ({
  page,
}) => {
  await mockAuth(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("Demo!Pass123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
test("rejects ordinary users and recovers from network errors", async ({
  page,
}) => {
  await mockAuth(page, { signedIn: true, role: "user" });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Coordinator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Command center" }),
  ).not.toBeVisible();
  await page.unrouteAll();
  await mockAuth(page, { offline: true });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Connection unavailable" }),
  ).toBeVisible();
  await page.unrouteAll();
  await mockAuth(page, { signedIn: true });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Command Center",
    }),
  ).toBeVisible();
});
test("handles expiry and preserves session when logout fails", async ({
  page,
}) => {
  await mockAuth(page, { signedIn: true, logoutFails: true });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("resqlink:session-expired")),
  );
  await expect(page).toHaveURL(/reason=expired/);
  await expect(
    page.getByText("Your session expired. Please sign in again."),
  ).toBeVisible();
});
test("respects reduced motion", async ({ page }) => {
  await mockAuth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .getByRole("link", { name: "Request Emergency Help" })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("1e-05s");
});

test("loading keeps button dimensions and unavailable login reports failure", async ({
  page,
}) => {
  await mockAuth(page);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("Demo!Pass123");
  await page.route("http://localhost:4000/v1/login", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.abort("connectionfailed");
  });
  const button = page.getByRole("button", { name: "Sign in", exact: true });
  const before = await button.boundingBox();
  await button.click();
  const loading = page.getByRole("button", { name: "Signing in" });
  await expect(loading).toBeDisabled();
  const during = await loading.boundingBox();
  expect(during?.width).toBe(before?.width);
  expect(during?.height).toBe(before?.height);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Unable to reach the service",
  );
  await expect(button).toBeEnabled();
});
test("does not report success when login cookies are rejected", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route("http://localhost:4000/v1/login", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: admin } }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("Demo!Pass123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Sign-in could not be verified",
  );
  await expect(page).toHaveURL(/\/login$/);
});
