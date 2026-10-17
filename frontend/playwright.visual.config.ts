import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: ["visual-restoration.spec.ts", "merged-integration.spec.ts"], workers: 1, timeout: 60000,
  use: { baseURL: "http://localhost:3000", channel: "chrome" },
});
