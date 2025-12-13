// @ts-check
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60 * 1000,
  use: {
    baseURL: "http://localhost:3000/retro-games/",
    trace: "retain-on-failure",
    headless: true,
  },
  webServer: {
    command: "npx vite --port 3000",
    url: "http://localhost:3000/retro-games/",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    stdout: "pipe",
  },
  reporter: [["list"]],
});
