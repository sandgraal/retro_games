const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__SANDGRAAL_FORCE_SAMPLE__ = true;
  });
});

test("loads sample data and opens/closes modal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#romTable tbody tr").first()).toBeVisible();

  const chronoCell = page
    .locator("table#romTable td")
    .filter({ hasText: "Chrono Trigger" })
    .first();
  await chronoCell.click();

  const modal = page.locator("#gameModal");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Chrono Trigger");

  await page.locator("#gameModal .modal-close").click();
  await expect(modal).toBeHidden();
});
