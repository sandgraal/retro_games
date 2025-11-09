// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60 * 1000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    headless: true,
  },
  webServer: {
    command: "npx http-server . -p 4173 -c-1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
  reporter: [["list"]],
});
