import { test, expect, type Page } from "@playwright/test";
const mockupAlt =
  "ResQLink emergency reporting mobile interface beside its operations command center dashboard";
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
for (const width of [375, 430, 768, 1024, 1280, 1440, 1600])
  test(`full product showcase at ${width}px`, async ({ page }, testInfo) => {
    await publicSession(page);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/#how-it-works");
    await page.evaluate(() => document.fonts.ready);
    const section = page.getByRole("region", {
      name: "A clearer path from report to response.",
    });
    await expect(section).toBeVisible();
    const steps = section
      .getByRole("list", { name: "Response workflow" })
      .getByRole("listitem");
    await expect(steps).toHaveCount(3);
    for (const title of [
      "Report an Emergency",
      "Assess Priority",
      "Coordinate Response",
    ])
      await expect(section.getByRole("heading", { name: title })).toBeVisible();
    const image = section.getByAltText(mockupAlt);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (el) =>
            el instanceof HTMLImageElement &&
            el.complete &&
            el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    const bounds = await image.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Product image has no dimensions");
    expect(bounds.width / bounds.height).toBeCloseTo(1448 / 1086, 2);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const cta = await section
      .getByRole("link", { name: "See ResQLink in Action" })
      .boundingBox();
    const copy = await section.locator(".rqHowCopy").boundingBox();
    if (width < 1100) {
      expect(bounds.y).toBeGreaterThanOrEqual(
        (cta?.y ?? 0) + (cta?.height ?? 0),
      );
    } else {
      expect(bounds.x).toBeGreaterThanOrEqual(
        (copy?.x ?? 0) + (copy?.width ?? 0),
      );
      expect(bounds.width).toBeGreaterThan(width * 0.4);
    }
    if (width >= 1280)
      expect(
        await section
          .locator("h2")
          .evaluate(
            (el) =>
              el.getBoundingClientRect().height /
              parseFloat(getComputedStyle(el).lineHeight),
          ),
      ).toBeCloseTo(2, 1);
    const note = section.getByText(/ResQLink is a demonstration platform/);
    await expect(note).toBeVisible();
    if (width < 1100) {
      const noteBounds = await note.boundingBox();
      expect(noteBounds?.y).toBeGreaterThan(bounds.y + bounds.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await section.screenshot({
      path: testInfo.outputPath(`how-it-works-${width}.png`),
      // Chromium can place offscreen fixed elements inside tall element captures.
      // The live skip link remains unchanged; landing tests verify its focus behavior.
      style: ".skip-link:not(:focus) { visibility: hidden !important; }",
    });
    expect(errors).toEqual([]);
  });
test("existing anchor and showcase CTA reach real content", async ({
  page,
}) => {
  await publicSession(page);
  await page.goto("/");
  await page
    .getByRole("link", { name: "How It Works", exact: true })
    .nth(1)
    .click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: "A clearer path from report to response.",
    }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "See ResQLink in Action" }).click();
  await expect(page).toHaveURL(/\/sos$/);
  await expect(
    page.getByRole("heading", { name: "The request portal is coming soon" }),
  ).toBeVisible();
});
test("showcase respects reduced motion and retains prototype context", async ({
  page,
}) => {
  await publicSession(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#how-it-works");
  const cta = page.getByRole("link", { name: "See ResQLink in Action" });
  await cta.hover();
  expect(await cta.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  await expect(
    page.getByText("Illustrative product mockup. Not a live incident feed."),
  ).toBeVisible();
  await expect(
    page.getByText(/The citizen submission interface is still being developed/),
  ).toBeVisible();
});
