import { expect, test, type Page } from "@playwright/test";

async function publicSession(page: Page) {
  let signedIn = false;
  await page.route("http://localhost:4000/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/login") signedIn = true;
    const isMe = path === "/v1/user/me";
    const status = isMe && !signedIn ? 401 : 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3032",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type",
      },
      body: JSON.stringify({
        success: status === 200,
        data:
          path === "/v1/login"
            ? {
                user: {
                  _id: "012345678901234567890123",
                  name: "Coordinator",
                  email: "admin@example.com",
                  role: "admin",
                },
              }
            : isMe && signedIn
              ? {
                  _id: "012345678901234567890123",
                  name: "Coordinator",
                  email: "admin@example.com",
                  role: "admin",
                }
              : null,
      }),
    });
  });
}

test("login password control stays inside the field and direct home link works", async ({
  page,
}, testInfo) => {
  await publicSession(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");

  const password = page.getByLabel(/^Password/);
  const toggle = page.getByRole("button", { name: "Show password" });
  await password.fill("A-very-long-password-that-must-not-overlap-the-icon");
  await password.focus();

  const inputBox = await password.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  expect(toggleBox!.x).toBeGreaterThan(inputBox!.x);
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(
    inputBox!.x + inputBox!.width - 4,
  );
  expect(toggleBox!.y).toBeGreaterThan(inputBox!.y);
  expect(toggleBox!.y + toggleBox!.height).toBeLessThan(inputBox!.y + inputBox!.height);

  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.screenshot({ path: testInfo.outputPath("login-mobile-375.png"), fullPage: true });
  await page.getByRole("link", { name: /Back to public portal/ }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Enter submits through the existing login form", async ({ page }) => {
  await publicSession(page);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("Demo!Pass123");
  const request = page.waitForRequest(
    (value) =>
      value.url() === "http://localhost:4000/v1/login" &&
      value.method() === "POST",
  );
  await page.getByLabel(/^Password/).press("Enter");
  await request;
});

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`public polish is complete and responsive at ${width}px`, async ({
    page,
  }, testInfo) => {
    await publicSession(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Every emergency deserves to be heard." }),
    ).toBeVisible();
    await expect(page.getByText("Explore the citizen portal")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Report an Emergency" })).toHaveAttribute(
      "href",
      "/sos",
    );
    await expect(
      page.getByRole("list", { name: "ResQLink response workflow" }).getByRole("listitem"),
    ).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Built by Zyphora" })).toBeVisible();
    const members = page.getByRole("list", { name: "Team Zyphora members" });
    await expect(members.getByRole("listitem")).toHaveCount(4);
    for (const [name, role] of [
      ["Saad", "Team Lead"],
      ["Saba", "Backend Development"],
      ["Kulsoom", "Frontend Development"],
      ["Hafsa", "Quality Assurance"],
    ]) {
      const card = members.getByRole("listitem").filter({ hasText: name });
      await expect(card).toContainText(role);
    }
    await expect(page.getByText("Hackathon prototype · Not an official emergency service")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (width === 390 || width === 1440) {
      await page.screenshot({
        path: testInfo.outputPath(`homepage-${width}.png`),
        fullPage: true,
      });
    }
  });
}

