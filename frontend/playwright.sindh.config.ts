import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results-sindh",
  testMatch: ["sindh-monitoring.spec.ts"],
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
});
