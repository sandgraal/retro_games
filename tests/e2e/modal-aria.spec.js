const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__SANDGRAAL_FORCE_SAMPLE__ = true;
  });
});

test("gameModalBackdrop aria-hidden state changes correctly", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Wait for the game grid to load with cards
  await page.waitForSelector("#gameGrid .game-card", { timeout: 10000 });

  // Check initial state of modal backdrop (should be hidden)
  const modalBackdrop = page.locator("#gameModalBackdrop");
  await expect(modalBackdrop).toHaveAttribute("hidden");
  await expect(modalBackdrop).toHaveAttribute("aria-hidden", "true");

  // Find and click a game card to open the modal
  const gameCards = page.locator(".game-card");
  const count = await gameCards.count();

  if (count > 0) {
    // Click on the cover area specifically to avoid action buttons
    const coverArea = gameCards.first().locator(".game-card-cover");
    await coverArea.click();

    // Wait for modal to be visible (hidden attribute removed)
    await expect(modalBackdrop).not.toHaveAttribute("hidden", { timeout: 3000 });
    await expect(modalBackdrop).toHaveAttribute("aria-hidden", "false");

    // Close the modal by pressing ESC
    await page.keyboard.press("Escape");

    // Wait for modal to close
    await expect(modalBackdrop).toHaveAttribute("hidden");
    await expect(modalBackdrop).toHaveAttribute("aria-hidden", "true");
  } else {
    test.skip("No game cards found to test with");
  }
});
