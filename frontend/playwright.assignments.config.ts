import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "assignment-workspace.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: "assignment-browser-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3001",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
