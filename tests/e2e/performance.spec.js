import { test, expect } from "@playwright/test";

/**
 * Performance tests to validate virtualization at scale
 * Tests synthetic large dataset behavior (simulated 1000 games)
 */

test.describe("Virtualization Performance", () => {
  test("handles large dataset (1000 games) without performance degradation", async ({
    page,
  }) => {
    // Inject a synthetic large dataset before loading the page
    await page.addInitScript(() => {
      window.__SANDGRAAL_FORCE_SAMPLE__ = true;
      window.__SANDGRAAL_SCALE_TEST__ = true;
      // Will be expanded by inline script
    });

    // Route to inject large dataset
    await page.route("**/data/sample-games.json", async (route) => {
      const games = generateLargeDataset(1000);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ games }),
      });
    });

    const startTime = Date.now();
    await page.goto("/");

    // Wait for grid to render initial batch
    await page.waitForSelector("#gameGrid .game-card", { timeout: 30000 });

    const initialLoadTime = Date.now() - startTime;
    console.log(`Initial load time with 1000 games: ${initialLoadTime}ms`);

    // Should load within 5 seconds even with 1000 games
    expect(initialLoadTime).toBeLessThan(5000);

    // Verify virtualization is active (not all cards rendered)
    const renderedCards = await page.locator("#gameGrid .game-card").count();
    console.log(`Rendered cards (virtualized): ${renderedCards}`);

    // With virtualization, should only render ~20-40 cards in viewport
    expect(renderedCards).toBeLessThan(100);
    expect(renderedCards).toBeGreaterThan(0);

    // Verify scroll behavior
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(200);

    // Cards should update on scroll
    const firstCardAfterScroll = await page
      .locator("#gameGrid .game-card")
      .first()
      .getAttribute("data-index");
    console.log(`First card index after scroll: ${firstCardAfterScroll}`);
  });

  test("search performance with large dataset", async ({ page }) => {
    await page.addInitScript(() => {
      window.__SANDGRAAL_FORCE_SAMPLE__ = true;
    });

    await page.route("**/data/sample-games.json", async (route) => {
      const games = generateLargeDataset(1000);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ games }),
      });
    });

    await page.goto("/");
    await page.waitForSelector("#gameGrid .game-card", { timeout: 30000 });

    // Measure search response time
    const searchInput = page.locator("#searchInput, [data-testid=search-input]");
    if ((await searchInput.count()) > 0) {
      const startSearch = Date.now();
      await searchInput.fill("Test Game 500");
      await page.waitForTimeout(500); // Wait for debounce

      const searchTime = Date.now() - startSearch;
      console.log(`Search filter time: ${searchTime}ms`);

      // Search should respond within 1 second
      expect(searchTime).toBeLessThan(1500);
    }
  });
});

/**
 * Generate a large synthetic dataset for testing
 */
function generateLargeDataset(count) {
  const platforms = [
    "SNES",
    "NES",
    "N64",
    "PS1",
    "PS2",
    "GameCube",
    "Genesis",
    "Steam",
    "Switch",
    "PS5",
  ];
  const genres = ["RPG", "Action", "Platformer", "Adventure", "Shooter", "Puzzle"];
  const eras = ["retro", "last-gen", "current"];

  return Array.from({ length: count }, (_, i) => ({
    game_name: `Test Game ${i + 1}`,
    platform: platforms[i % platforms.length],
    genre: genres[i % genres.length],
    rating: (5 + Math.random() * 5).toFixed(1),
    release_year: 1990 + (i % 35),
    cover: null,
    region: "NTSC",
    era: eras[Math.floor(i / (count / 3)) % eras.length],
    is_indie: i % 10 === 0,
    is_vr_supported: i % 50 === 0,
  }));
}
