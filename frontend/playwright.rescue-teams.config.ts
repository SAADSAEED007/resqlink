import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: ["rescue-teams.spec.ts", "api.spec.ts"], workers: 1, timeout: 60000,
  use: { baseURL: "http://localhost:3200", channel: "chrome", trace: "retain-on-failure" },
});
