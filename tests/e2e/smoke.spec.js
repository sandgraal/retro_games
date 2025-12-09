import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__SANDGRAAL_FORCE_SAMPLE__ = true;
  });
});

test("loads sample data and opens/closes modal", async ({ page }) => {
  await page.goto("/");

  // Wait for the game grid to load
  await page.waitForSelector("#gameGrid .game-card", { timeout: 10000 });

  // Verify at least one game card is visible
  await expect(page.locator("#gameGrid .game-card").first()).toBeVisible();

  // Find and click on a game card cover (not the action buttons)
  const chronoCard = page
    .locator(".game-card")
    .filter({ hasText: "Chrono Trigger" })
    .first();
  const firstCard = page.locator("#gameGrid .game-card").first();
  const targetCard = (await chronoCard.count()) > 0 ? chronoCard : firstCard;

  // Click on the cover image area specifically to avoid action buttons
  const coverArea = targetCard.locator(".game-card-cover");
  await coverArea.click();

  // Check modal opens (wait for state change)
  const modalBackdrop = page.locator("#gameModalBackdrop");
  await expect(modalBackdrop).not.toHaveAttribute("hidden", { timeout: 3000 });
  await expect(modalBackdrop).toHaveAttribute("aria-hidden", "false");

  // Close modal via close button
  await page.locator("#gameModalClose").click();
  await expect(modalBackdrop).toHaveAttribute("hidden");
});
