import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "public-polish.spec.ts",
  fullyParallel: false,
  workers: 1,
  // First navigation compiles the public route in Next development mode.
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3032",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev --webpack -p 3032",
    url: "http://localhost:3032",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
      NEXT_PUBLIC_AUTH_URL: "http://localhost:4000/v1",
    },
  },
});
