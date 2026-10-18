import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  outputDir: "./test-results-maps",
  reporter: "list",
  use: {
    baseURL: "http://localhost:3016",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3016",
    url: "http://localhost:3016",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
      NEXT_PUBLIC_AUTH_URL: "http://localhost:4000/v1",
    },
  },
});
