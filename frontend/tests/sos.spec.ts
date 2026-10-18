import { test, expect, type Page } from "@playwright/test";
const reference = "65f012345678901234567890";
async function publicPage(page: Page) {
  await page.route("http://localhost:4000/v1/**", (route) =>
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
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
}
async function recordRoute(
  page: Page,
  handler?: (attempt: number) => "network" | number | "invalid",
) {
  const payloads: Record<string, unknown>[] = [];
  await page.route("http://localhost:4000/api/incidents", async (route) => {
    if (route.request().method() !== "POST") return route.abort();
    payloads.push(route.request().postDataJSON() as Record<string, unknown>);
    const result = handler?.(payloads.length) ?? 201;
    if (result === "network") return route.abort("connectionfailed");
    if (result === "invalid")
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    await route.fulfill({
      status: result,
      contentType: "application/json",
      body: JSON.stringify({
        success: result === 201,
        data: result === 201 ? { _id: reference } : null,
      }),
    });
  });
  return payloads;
}
async function start(page: Page) {
  await page.goto("/sos");
  await page
    .getByRole("button", { name: "SOS - begin emergency report" })
    .click();
}
async function manualLocation(page: Page) {
  await page.getByRole("button", { name: "Enter Location Manually" }).click();
  await page
    .getByLabel(/^Area, address/)
    .fill("SIMULATED village near the bridge");
  await page.getByRole("button", { name: "Continue to Details" }).click();
}
async function details(page: Page) {
  await page.getByLabel(/^Your name/).fill("SIMULATED Reporter");
  await page.getByLabel(/^Type of emergency/).selectOption("FLOOD");
  await page
    .getByLabel(/^What happened/)
    .fill("SIMULATED rising water near the road");
  await page.getByLabel(/^People affected/).fill("3");
}
async function review(page: Page) {
  await details(page);
  await page.getByRole("button", { name: "Review Report" }).click();
}
for (const width of [375, 430, 768, 1440])
  test(`SOS app and flow fit ${width}px`, async ({ page }, testInfo) => {
    await publicPage(page);
    const payloads = await recordRoute(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/sos");
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", { name: "Report an Emergency", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Prototype safety notice")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`sos-start-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "SOS - begin emergency report" })
      .click();
    expect(payloads).toHaveLength(0);
    await manualLocation(page);
    await review(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`sos-review-${width}.png`),
      fullPage: true,
    });
  });
test("records a public manual report, omits unknown fields, and uses the server reference", async ({
  page,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page);
  await start(page);
  await manualLocation(page);
  await review(page);
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0].location).toBeNull();
  expect(payloads[0].description).toContain(
    "SIMULATED village near the bridge",
  );
  expect(payloads[0]).not.toHaveProperty("reporterPhone");
  expect(payloads[0]).not.toHaveProperty("immediateDanger");
  expect(payloads[0]).not.toHaveProperty("vulnerablePeople");
  await expect(
    page.getByText("It has not been sent to official emergency services.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("validates coordinates and required fields, keeps zero assistance counts, and supports reporting for someone else", async ({
  page,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page);
  await page.goto("/sos");
  await page
    .getByRole("button", { name: "Report for Someone Else", exact: true })
    .click();
  await page.getByText("Enter coordinates (optional)", { exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("95");
  await page.getByLabel("Longitude", { exact: true }).fill("67");
  await page.getByRole("button", { name: "Continue to Details" }).click();
  await expect(
    page.getByText("Enter a latitude between -90 and 90."),
  ).toBeVisible();
  expect(payloads).toHaveLength(0);
  await page.getByLabel("Latitude", { exact: true }).fill("27.7");
  await page.getByRole("button", { name: "Continue to Details" }).click();
  await page.getByRole("button", { name: "Review Report" }).click();
  await expect(page.getByLabel(/^Your name/)).toBeFocused();
  await details(page);
  await page.getByLabel("Children", { exact: true }).fill("0");
  await page.getByLabel(/^Contact phone/).fill("invalid");
  await page.getByRole("button", { name: "Review Report" }).click();
  await expect(page.getByText(/Use 5 to 32 phone characters/)).toBeVisible();
  await page.getByLabel(/^Contact phone/).fill("");
  await page.getByRole("button", { name: "Review Report" }).click();
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  expect(payloads[0].vulnerablePeople).toEqual({ children: 0 });
  expect(payloads[0].description).toContain(
    "Reporting on behalf of someone else.",
  );
});
test("geolocation uses only explicitly granted device coordinates", async ({
  page,
  context,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 27.7052, longitude: 68.8574 });
  await start(page);
  await page.getByRole("button", { name: "Use My Current Location" }).click();
  await expect(page.getByText(/27.70520, 68.85740/)).toBeVisible();
  await page.getByRole("button", { name: "Continue to Details" }).click();
  await review(page);
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  expect(payloads[0].location).toEqual({
    latitude: 27.7052,
    longitude: 68.8574,
  });
});
for (const [code, message] of [
  [1, "permission was denied"],
  [2, "temporarily unavailable"],
  [3, "took too long"],
] as const)
  test(`geolocation failure ${code} allows manual fallback`, async ({
    page,
  }) => {
    await publicPage(page);
    await page.addInitScript(
      (code) =>
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: {
            getCurrentPosition: (
              _success: unknown,
              fail: (error: { code: number }) => void,
            ) => fail({ code }),
          },
        }),
      code,
    );
    await start(page);
    await page.getByRole("button", { name: "Use My Current Location" }).click();
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    await manualLocation(page);
    await expect(
      page.getByRole("heading", { name: "Tell us what happened" }),
    ).toBeVisible();
  });
test("map starts without reporting a default location and records only a selected point", async ({
  page,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page);
  await start(page);
  await page.getByRole("button", { name: "Select on Map" }).click();
  await expect(page.getByText(/Starting view: Karachi/)).toBeVisible();
  await expect(page.getByText("No location shared yet")).toBeVisible();
  const map = page.getByRole("group", { name: "Emergency location map" });
  await expect(map).toHaveClass(/leaflet-container/);
  await expect(map.locator(".leaflet-control-zoom-in")).toBeVisible();
  await map.click({ position: { x: 180, y: 150 } });
  await expect(page.getByText(/No location shared yet/)).not.toBeVisible();
  await expect(map.locator(".rqSosMapMarker")).toBeVisible();
  await expect(map.getByRole("link", { name: "OpenStreetMap" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to Details" }).click();
  await review(page);
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  const location = payloads[0].location as {
    latitude: number;
    longitude: number;
  };
  expect(Number.isFinite(location.latitude)).toBe(true);
  expect(Number.isFinite(location.longitude)).toBe(true);
});
test("unknown location is explicit and photo availability is honest", async ({
  page,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page);
  await page.goto("/sos");
  await page.getByRole("button", { name: /Add Photo/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "cannot securely upload or save media",
  );
  await page.getByRole("button", { name: "Understood" }).click();
  expect(payloads).toHaveLength(0);
  await page.getByRole("button", { name: "Continue Emergency Report" }).click();
  await page
    .getByLabel("I don't know the exact location", { exact: false })
    .check();
  await page.getByRole("button", { name: "Continue to Details" }).click();
  await review(page);
  await expect(
    page.getByText(/No GPS coordinates are available/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  expect(payloads[0].location).toBeNull();
  expect(payloads[0]).not.toHaveProperty("attachments");
});
test("backend validation failure preserves data and allows a deliberate retry", async ({
  page,
}) => {
  await publicPage(page);
  const payloads = await recordRoute(page, (attempt) =>
    attempt === 1 ? 400 : 201,
  );
  await start(page);
  await manualLocation(page);
  await review(page);
  await page.getByRole("button", { name: "Record Emergency Report" }).click();
  await expect(page.getByText(/The server rejected this report/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Retry submission" }).click();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
});
for (const failure of ["network", 500, "invalid"] as const)
  test(`uncertain ${failure} response never shows false success and requires retry acknowledgement`, async ({
    page,
  }) => {
    await publicPage(page);
    const payloads = await recordRoute(page, (attempt) =>
      attempt === 1 ? failure : 201,
    );
    await start(page);
    await manualLocation(page);
    await review(page);
    await page.getByRole("button", { name: "Record Emergency Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Report not confirmed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry submission" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Edit details" }).click();
    await page
      .getByLabel(/^What happened/)
      .fill("SIMULATED updated flood report after failed confirmation");
    await page.getByRole("button", { name: "Review Report" }).click();
    await page
      .getByLabel("I understand a retry may create another report.")
      .check();
    await page.getByRole("button", { name: "Retry submission" }).click();
    await expect(
      page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
    ).toBeVisible();
    expect(payloads).toHaveLength(2);
    expect(payloads[1].description).toContain("updated flood report");
  });
test("submission loading and synchronous guard prevent double posting", async ({
  page,
}) => {
  await publicPage(page);
  let attempts = 0;
  await page.route("http://localhost:4000/api/incidents", async (route) => {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { _id: reference } }),
    });
  });
  await start(page);
  await manualLocation(page);
  await review(page);
  await page
    .getByRole("button", { name: "Record Emergency Report" })
    .evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("button", { name: "Recording report" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: /SOS Report Submitted|Emergency report recorded/ }),
  ).toBeVisible();
  expect(attempts).toBe(1);
});
