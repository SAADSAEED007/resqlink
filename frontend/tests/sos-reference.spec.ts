import { test, expect, type Page } from "@playwright/test";

async function mockApiAndTiles(page: Page, mockReference = "RESQ-000123") {
  await page.route("http://localhost:4000/v1/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ success: false, data: null }),
    })
  );

  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ZkAAAAASUVORK5CYII=",
        "base64"
      ),
    })
  );

  await page.route("http://localhost:4000/api/incidents", async (route) => {
    if (route.request().method() !== "POST") return route.abort();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          _id: "6ad4be5712078cdf7ae6dc0f",
          reportReference: mockReference,
          emergencyType: "FLOOD",
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
}

test.describe("Citizen SOS Report Reference Number & Confirmation", () => {
  test("displays SOS Report Submitted, Your Report Reference RESQ-000123, and Copy Reference Number button", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockApiAndTiles(page, "RESQ-000123");

    await page.goto("/sos");

    // Click SOS emergency button to open form
    await page.getByRole("button", { name: "SOS", exact: true }).click();

    // Select Flood
    await page.getByRole("button", { name: /Flood/i }).click();

    // Enter area/landmark
    await page.getByPlaceholder(/Village, district, road/i).fill("Near Indus Highway km 42");

    // Click Send SOS to go to confirm screen
    await page.getByRole("button", { name: "Send SOS" }).click();

    // Confirm screen
    await expect(page.getByRole("heading", { name: /Confirm SOS/i })).toBeVisible();

    // Submit report
    await page.getByRole("button", { name: "Send SOS" }).click();

    // Verify confirmation screen requirements
    await expect(
      page.getByRole("heading", { name: "SOS Report Submitted" })
    ).toBeVisible();

    await expect(page.getByText("Your Report Reference")).toBeVisible();
    await expect(page.getByText("RESQ-000123")).toBeVisible();

    const copyBtn = page.getByRole("button", { name: "Copy Reference Number" });
    await expect(copyBtn).toBeVisible();

    // Click copy button
    await copyBtn.click();
    await expect(page.getByRole("button", { name: "Reference Copied!" })).toBeVisible();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe("RESQ-000123");
  });

  test("gracefully falls back to raw ID when reportReference is missing without manufacturing a fake reference", async ({
    page,
  }) => {
    await page.route("http://localhost:4000/v1/**", (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ success: false }) })
    );

    // Backend returns incident without reportReference field
    await page.route("http://localhost:4000/api/incidents", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            _id: "6ad4be5712078cdf7ae6dc0f",
            emergencyType: "MEDICAL",
          },
        }),
      });
    });

    await page.goto("/sos");
    await page.getByRole("button", { name: "SOS", exact: true }).click();
    await page.getByRole("button", { name: /Medical/i }).click();
    await page.getByPlaceholder(/Village, district, road/i).fill("Local clinic");
    await page.getByRole("button", { name: "Send SOS" }).click();
    await page.getByRole("button", { name: "Send SOS" }).click();

    await expect(
      page.getByRole("heading", { name: "SOS Report Submitted" })
    ).toBeVisible();

    // Retains valid internal recovery identifier and does not make up a random RESQ- number
    await expect(page.getByText("6ad4be5712078cdf7ae6dc0f")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Reference Number" })).toBeVisible();
  });
});
