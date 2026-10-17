import { test, expect, type Page } from "@playwright/test";

async function publicSession(page: Page) {
  await page.route("http://localhost:4000/v1/user/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ success: false, data: null }),
    }),
  );
}
for (const width of [375, 430, 768, 1024, 1280, 1440, 1600]) {
  test(`approved homepage composition at ${width}px`, async ({
    page,
  }, testInfo) => {
    await publicSession(page);
    await page.setViewportSize({ width, height: 940 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle(
      "ResQLink | Stronger Communities. Safer Sindh.",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Stronger Communities. Safer Sindh.",
    );
    await expect(
      page.getByText("DISASTER RESPONSE PLATFORM FOR SINDH"),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Our approach" }).getByRole("listitem"),
    ).toHaveCount(4);
    await expect(
      page.getByText(
        "Hackathon prototype. No official emergency dispatch is connected.",
      ),
    ).toBeVisible();
    await page.locator("img").last().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const headingBounds = await page.locator("h1").boundingBox();
    expect(headingBounds?.x).toBeGreaterThanOrEqual(20);
    await page.screenshot({
      path: testInfo.outputPath(`homepage-${width}.png`),
      fullPage: true,
    });
    if (width === 1600)
      await page
        .locator("section")
        .first()
        .screenshot({ path: testInfo.outputPath("hero-desktop-1600.png") });
    expect(errors).toEqual([]);
  });
}
test("desktop navigation reaches real sections and public routes", async ({
  page,
}) => {
  await publicSession(page);
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto("/");
  await page
    .getByRole("link", { name: "How It Works", exact: true })
    .filter({ visible: true })
    .nth(1)
    .click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: "A clearer path from report to response.",
    }),
  ).toBeInViewport();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "For Communities" })
    .click();
  await expect(page).toHaveURL(/#communities$/);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page).toHaveURL(/#about$/);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Request Emergency Help" }).click();
  await expect(page).toHaveURL(/\/sos$/);
  await expect(
    page.getByRole("heading", { name: "Report an Emergency" }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("link", { name: "Coordinator Login", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});
test("mobile menu supports keyboard, anchors, login, and dismissal", async ({
  page,
}) => {
  await publicSession(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  const toggle = page.getByLabel("Toggle navigation");
  await toggle.focus();
  await page.keyboard.press("Enter");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await nav.getByRole("link", { name: "How It Works" }).click();
  await expect(nav).not.toBeVisible();
  await expect(page).toHaveURL(/#how-it-works$/);
  await toggle.click();
  await nav.getByRole("link", { name: "Coordinator Login" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("reduced motion disables smooth scrolling and CTA movement", async ({
  page,
}) => {
  await publicSession(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  const cta = page.getByRole("link", { name: "Request Emergency Help" });
  await cta.hover();
  expect(await cta.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
});
test("approved artwork is decorative and images reserve layout space", async ({
  page,
}) => {
  await publicSession(page);
  await page.goto("/");
  // Select by the actual approved source, not by presentation classes.
  const image = page.locator('img[src*="hero-background"]');
  await expect(image).toHaveAttribute("alt", "");
  const logo = page
    .getByAltText("ResQLink - People, Response, Safer Sindh")
    .first();
  await expect(logo).toHaveAttribute("width", "2172");
  await expect(logo).toHaveAttribute("height", "724");
  expect(
    await image.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThan(700);
  await expect(page.getByLabel("Prototype safety notice")).toContainText(
    "not connected to official emergency dispatch services",
  );
});
