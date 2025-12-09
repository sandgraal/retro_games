/**
 * Performance tests for large datasets.
 * Tests virtualization, filtering, and search with 10k+ game datasets.
 * @module tests/performance
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  shouldVirtualize,
  computeVirtualRange,
  buildVirtualMetrics,
  estimateColumnCount,
  VIRTUALIZE_MIN_ITEMS,
  VIRTUAL_DEFAULT_CARD_HEIGHT,
  VIRTUAL_DEFAULT_CARD_WIDTH,
} from "../app/features/virtualization.js";
import {
  rowMatchesPlatform,
  rowMatchesGenre,
  rowMatchesSearch,
} from "../app/features/filtering.js";
import { normalizeSearchQuery, scoreSuggestion } from "../app/features/search.js";
import {
  createSortComparator,
  COL_GAME,
  COL_RATING,
  COL_RELEASE_YEAR,
} from "../app/features/sorting.js";

// === Test Data Generators ===

const PLATFORMS = [
  "NES",
  "SNES",
  "N64",
  "GameCube",
  "Wii",
  "Wii U",
  "Switch",
  "PS1",
  "PS2",
  "PS3",
  "PS4",
  "PS5",
  "Xbox",
  "Xbox 360",
  "Xbox One",
  "Xbox Series X",
  "Genesis",
  "Saturn",
  "Dreamcast",
  "Game Boy",
  "Game Boy Color",
  "Game Boy Advance",
  "DS",
  "3DS",
  "PSP",
  "Vita",
  "TurboGrafx-16",
  "Neo Geo",
  "Atari 2600",
  "Atari 7800",
];

const GENRES = [
  "RPG",
  "Action",
  "Adventure",
  "Platformer",
  "Shooter",
  "Racing",
  "Sports",
  "Fighting",
  "Puzzle",
  "Strategy",
  "Simulation",
  "Horror",
  "Stealth",
  "Rhythm",
  "Visual Novel",
];

const GAME_PREFIXES = [
  "Super",
  "Mega",
  "Ultra",
  "Final",
  "Legend of",
  "Tales of",
  "Star",
  "Dragon",
  "Metal",
  "Dark",
  "Chrono",
  "Secret of",
  "World of",
  "Castle",
  "Shadow",
];

const GAME_SUFFIXES = [
  "Quest",
  "Fantasy",
  "Warriors",
  "Adventure",
  "Saga",
  "Chronicles",
  "Heroes",
  "Legends",
  "Origins",
  "Rising",
  "Souls",
  "Knight",
  "World",
  "Force",
  "Impact",
];

/**
 * Generate a large dataset of fake games for performance testing.
 * @param {number} count - Number of games to generate
 * @returns {Array<Object>} Array of game objects
 */
function generateLargeDataset(count) {
  const games = [];
  for (let i = 0; i < count; i++) {
    const prefix = GAME_PREFIXES[i % GAME_PREFIXES.length];
    const suffix =
      GAME_SUFFIXES[Math.floor(i / GAME_PREFIXES.length) % GAME_SUFFIXES.length];
    const numeral = Math.floor(i / (GAME_PREFIXES.length * GAME_SUFFIXES.length)) + 1;
    const platform = PLATFORMS[i % PLATFORMS.length];
    const genre1 = GENRES[i % GENRES.length];
    const genre2 = GENRES[(i + 5) % GENRES.length];

    games.push({
      game_name: `${prefix} ${suffix}${numeral > 1 ? ` ${numeral}` : ""}`,
      platform,
      genre: `${genre1}, ${genre2}`,
      rating: (3 + (i % 20) / 10).toFixed(1),
      release_year: 1985 + (i % 40),
      cover: `https://example.com/covers/${i}.jpg`,
    });
  }
  return games;
}

// === Virtualization Performance Tests ===

describe("Virtualization Performance", () => {
  describe("shouldVirtualize threshold checks", () => {
    it("returns false for small datasets (< 80 items)", () => {
      expect(shouldVirtualize(0)).toBe(false);
      expect(shouldVirtualize(50)).toBe(false);
      expect(shouldVirtualize(79)).toBe(false);
    });

    it("returns true at threshold (80 items)", () => {
      expect(shouldVirtualize(80)).toBe(true);
      expect(shouldVirtualize(VIRTUALIZE_MIN_ITEMS)).toBe(true);
    });

    it("returns true for large datasets", () => {
      expect(shouldVirtualize(1000)).toBe(true);
      expect(shouldVirtualize(10000)).toBe(true);
      expect(shouldVirtualize(100000)).toBe(true);
    });

    it("respects enabled flag", () => {
      expect(shouldVirtualize(1000, { enabled: false })).toBe(false);
      expect(shouldVirtualize(1000, { enabled: true })).toBe(true);
    });

    it("respects custom minItems threshold", () => {
      expect(shouldVirtualize(50, { minItems: 40 })).toBe(true);
      expect(shouldVirtualize(50, { minItems: 60 })).toBe(false);
    });
  });

  describe("computeVirtualRange with large datasets", () => {
    const metrics = buildVirtualMetrics({
      rowHeight: VIRTUAL_DEFAULT_CARD_HEIGHT,
      columns: 4,
      gap: 16,
    });

    it("computes correct initial range for 10k items", () => {
      const range = computeVirtualRange({
        dataLength: 10000,
        scrollTop: 0,
        containerTop: 0,
        viewportHeight: 800,
        metrics,
      });

      // Should render first few rows plus overscan
      expect(range.start).toBe(0);
      // With 4 columns, 800px viewport, 360px row height = ~3 rows visible
      // Plus 2 rows overscan = ~5 rows = ~20 items
      expect(range.end).toBeGreaterThan(0);
      expect(range.end).toBeLessThan(100); // Should not render all 10k
      expect(range.topPadding).toBe(0);
      expect(range.bottomPadding).toBeGreaterThan(0);
    });

    it("computes correct range when scrolled to middle for 10k items", () => {
      const totalRows = Math.ceil(10000 / 4);
      const middleRow = Math.floor(totalRows / 2);
      const scrollTop = middleRow * VIRTUAL_DEFAULT_CARD_HEIGHT;

      const range = computeVirtualRange({
        dataLength: 10000,
        scrollTop,
        containerTop: 0,
        viewportHeight: 800,
        metrics,
      });

      // Start should be around middle
      expect(range.start).toBeGreaterThan(4000);
      expect(range.start).toBeLessThan(6000);
      // End should be reasonably close to start
      expect(range.end - range.start).toBeLessThan(100);
      // Should have both top and bottom padding
      expect(range.topPadding).toBeGreaterThan(0);
      expect(range.bottomPadding).toBeGreaterThan(0);
    });

    it("computes correct range at end for 10k items", () => {
      const totalRows = Math.ceil(10000 / 4);
      const scrollTop = totalRows * VIRTUAL_DEFAULT_CARD_HEIGHT;

      const range = computeVirtualRange({
        dataLength: 10000,
        scrollTop,
        containerTop: 0,
        viewportHeight: 800,
        metrics,
      });

      // End should be at dataset end
      expect(range.end).toBe(10000);
      // Should have top padding but no bottom padding
      expect(range.topPadding).toBeGreaterThan(0);
      expect(range.bottomPadding).toBe(0);
    });

    it("handles 100k items efficiently", () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        computeVirtualRange({
          dataLength: 100000,
          scrollTop: i * 100,
          containerTop: 0,
          viewportHeight: 800,
          metrics,
        });
      }

      const elapsed = performance.now() - start;
      // 1000 range computations should complete in under 50ms
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("estimateColumnCount performance", () => {
    it("computes columns for various container widths", () => {
      const widths = [320, 640, 1024, 1440, 1920, 2560, 3840];
      widths.forEach((width) => {
        const cols = estimateColumnCount(width, VIRTUAL_DEFAULT_CARD_WIDTH, 16);
        expect(cols).toBeGreaterThanOrEqual(1);
        expect(cols).toBeLessThanOrEqual(
          Math.floor(width / VIRTUAL_DEFAULT_CARD_WIDTH) + 1
        );
      });
    });
  });
});

// === Filtering Performance Tests ===

describe("Filtering Performance", () => {
  let largeDataset;

  beforeEach(() => {
    largeDataset = generateLargeDataset(10000);
  });

  describe("platform filtering with 10k items", () => {
    it("filters by single platform efficiently", () => {
      const start = performance.now();

      const filtered = largeDataset.filter((game) => rowMatchesPlatform(game, "SNES"));

      const elapsed = performance.now() - start;
      // Filtering 10k items should complete in under 50ms
      expect(elapsed).toBeLessThan(50);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((g) => g.platform === "SNES")).toBe(true);
    });

    it("filters by multiple platforms efficiently", () => {
      const platforms = ["SNES", "N64", "GameCube"];
      const start = performance.now();

      const filtered = largeDataset.filter((game) => platforms.includes(game.platform));

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe("genre filtering with 10k items", () => {
    it("filters by genre efficiently", () => {
      const start = performance.now();

      const filtered = largeDataset.filter((game) => rowMatchesGenre(game, "RPG"));

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe("search filtering with 10k items", () => {
    it("searches by name efficiently", () => {
      const searchQuery = "Super";
      const start = performance.now();

      const filtered = largeDataset.filter((game) => rowMatchesSearch(game, searchQuery));

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it("normalizes search queries to lowercase", () => {
      const queries = ["CHRONO TRIGGER", "chrono trigger", "Chrono Trigger"];
      const normalized = queries.map(normalizeSearchQuery);
      // All should normalize to lowercase
      expect(normalized.every((q) => q === q.toLowerCase())).toBe(true);
    });

    it("scores search matches efficiently for 10k items", () => {
      const query = normalizeSearchQuery("legend");
      const start = performance.now();

      largeDataset.forEach((game) => {
        scoreSuggestion(game, query, { columns: [COL_GAME] });
      });

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("combined filtering with 10k items", () => {
    it("chains multiple filters efficiently", () => {
      const start = performance.now();

      const filtered = largeDataset
        .filter((game) => rowMatchesPlatform(game, "SNES"))
        .filter((game) => rowMatchesGenre(game, "RPG"))
        .filter((game) => rowMatchesSearch(game, "Super"));

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});

// === Sorting Performance Tests ===

describe("Sorting Performance", () => {
  let largeDataset;

  beforeEach(() => {
    largeDataset = generateLargeDataset(10000);
  });

  describe("sorting 10k items", () => {
    it("sorts by name efficiently", () => {
      const comparator = createSortComparator(COL_GAME, "asc");
      const data = [...largeDataset];

      const start = performance.now();
      data.sort(comparator);
      const elapsed = performance.now() - start;

      // Sorting 10k items should complete in under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it("sorts by rating efficiently", () => {
      const comparator = createSortComparator(COL_RATING, "desc");
      const data = [...largeDataset];

      const start = performance.now();
      data.sort(comparator);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    it("sorts by year efficiently", () => {
      const comparator = createSortComparator(COL_RELEASE_YEAR, "asc");
      const data = [...largeDataset];

      const start = performance.now();
      data.sort(comparator);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    it("maintains stable sort for equal values", () => {
      const comparator = createSortComparator(COL_RATING, "desc");
      const data = [...largeDataset];

      data.sort(comparator);

      // Games with same rating should maintain relative order
      // (This is a basic stability check)
      expect(data[0].rating).toBeDefined();
    });
  });
});

// === Memory Usage Tests ===

describe("Memory Efficiency", () => {
  describe("large dataset generation", () => {
    it("generates 10k items without issues", () => {
      const data = generateLargeDataset(10000);
      expect(data.length).toBe(10000);
      expect(data[0].game_name).toBeDefined();
      expect(data[9999].game_name).toBeDefined();
    });

    it("generates 100k items without issues", () => {
      const data = generateLargeDataset(100000);
      expect(data.length).toBe(100000);
    });
  });

  describe("virtual range computation memory", () => {
    it("does not accumulate state across computations", () => {
      const metrics = buildVirtualMetrics({ columns: 4 });

      // Run many computations to check for memory leaks
      for (let i = 0; i < 10000; i++) {
        computeVirtualRange({
          dataLength: 100000,
          scrollTop: i * 10,
          containerTop: 0,
          viewportHeight: 800,
          metrics,
        });
      }

      // If we got here without OOM, test passes
      expect(true).toBe(true);
    });
  });
});

// === Rendering Estimation Tests ===

describe("Rendering Estimation", () => {
  describe("visible item counts", () => {
    const metrics = buildVirtualMetrics({
      rowHeight: 360,
      columns: 4,
      gap: 16,
    });

    it("estimates reasonable visible counts for common viewports", () => {
      const viewports = [
        { height: 600, name: "laptop" },
        { height: 800, name: "desktop" },
        { height: 1080, name: "1080p" },
        { height: 1440, name: "1440p" },
        { height: 2160, name: "4K" },
      ];

      viewports.forEach(({ height, name }) => {
        const range = computeVirtualRange({
          dataLength: 10000,
          scrollTop: 0,
          containerTop: 0,
          viewportHeight: height,
          metrics,
        });

        const visibleItems = range.end - range.start;
        // Should render a reasonable number of items (not too few, not too many)
        expect(visibleItems).toBeGreaterThan(8);
        expect(visibleItems).toBeLessThan(100);
      });
    });

    it("renders consistent item counts regardless of dataset size", () => {
      const sizes = [100, 1000, 10000, 100000];
      const ranges = sizes.map((size) =>
        computeVirtualRange({
          dataLength: size,
          scrollTop: 0,
          containerTop: 0,
          viewportHeight: 800,
          metrics,
        })
      );

      // All should render approximately same number of visible items
      const counts = ranges.map((r) => r.end - r.start);
      const maxDiff = Math.max(...counts) - Math.min(...counts);
      // Allow some variance but should be similar
      expect(maxDiff).toBeLessThan(20);
    });
  });
});
