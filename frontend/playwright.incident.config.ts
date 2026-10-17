import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["incident-workspace.spec.ts", "merged-integration.spec.ts", "api.spec.ts"],
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "retain-on-failure" },
});
