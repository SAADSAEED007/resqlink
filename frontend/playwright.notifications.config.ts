import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "coordinator-sos-notifications.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: "notifications-browser-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3060",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev --webpack -p 3060",
    url: "http://localhost:3060",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
      NEXT_PUBLIC_AUTH_URL: "http://localhost:4000/v1",
    },
  },
});
