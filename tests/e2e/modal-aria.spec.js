const { test, expect } = require("@playwright/test");

test("modalBg aria-hidden state changes correctly", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Wait for the page to load
  await page.waitForSelector("#gameGrid", { timeout: 10000 });

  // Check initial state of modalBg
  const initialAriaHidden = await page.getAttribute("#modalBg", "aria-hidden");
  console.log("Initial modalBg aria-hidden:", initialAriaHidden);
  expect(initialAriaHidden).toBe("true");

  // Wait a bit for data to load
  await page.waitForTimeout(2000);

  // Find and click a game card to open the modal
  const gameCards = page.locator(".game-card");
  const count = await gameCards.count();

  if (count > 0) {
    await gameCards.first().click();

    // Wait for modal to appear
    await page.waitForSelector('#gameModal[aria-hidden="false"]', { timeout: 5000 });

    // Check modalBg aria-hidden when modal is open
    const modalOpenAriaHidden = await page.getAttribute("#modalBg", "aria-hidden");
    console.log("modalBg aria-hidden when modal open:", modalOpenAriaHidden);
    expect(modalOpenAriaHidden).toBe("false");

    // Close the modal by pressing ESC
    await page.keyboard.press("Escape");

    // Wait a bit for the modal to close
    await page.waitForTimeout(500);

    // Check modalBg aria-hidden when modal is closed
    const modalClosedAriaHidden = await page.getAttribute("#modalBg", "aria-hidden");
    console.log("modalBg aria-hidden when modal closed:", modalClosedAriaHidden);
    expect(modalClosedAriaHidden).toBe("true");
  } else {
    test.skip("No game cards found to test with");
  }
});
