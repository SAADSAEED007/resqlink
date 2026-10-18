import { test as base } from "@playwright/test";
export { expect, type Page } from "@playwright/test";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=",
  "base64",
);
// Browser workflow tests do not load or pan across public tile infrastructure.
// Real provider status and visual checks are captured separately.
export const test = base.extend<{ mapTiles: void }>({
  mapTiles: [
    async ({ page }, use) => {
      await page.route(
        /https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.openstreetmap\.org|server\.arcgisonline\.com)\//,
        (route) => route.fulfill({ contentType: "image/png", body: pixel }),
      );
      await use();
    },
    { auto: true },
  ],
});
