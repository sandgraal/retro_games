/**
 * GOG API Adapter Tests
 *
 * Tests the GOG.com API adapter for catalog ingestion.
 * Uses mocked fetch responses to avoid hitting real APIs.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
const gogModule = await import("../services/catalog-ingest/sources/gog.js");
const { fetchGogSource, fetchGogGameDetails, searchGog } = gogModule;

// Access internal helpers via default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gogDefault = gogModule.default as any;
const { fetchGogSales, GENRE_MAP } = gogDefault;

// Sample GOG catalog product
const sampleGogProduct = {
  id: 1207658691,
  slug: "the-witcher-3-wild-hunt",
  title: "The Witcher 3: Wild Hunt",
  productType: "game",
  releaseDate: "2015-05-18T22:00:00+00:00",
  image: "https://images.gog.com/witcher3.jpg",
  rating: 49, // GOG uses 0-50 scale
  genres: [
    { name: "RPG", slug: "rpg" },
    { name: "Adventure", slug: "adventure" },
  ],
  developer: "CD PROJEKT RED",
  publisher: "CD PROJEKT RED",
  price: {
    amount: "39.99",
    baseAmount: "49.99",
    currency: "USD",
    discount: 20,
    isFree: false,
  },
  screenshots: [{ image_url: "https://images.gog.com/screen1.jpg" }],
  tags: [{ name: "Open World" }, { name: "Fantasy" }],
  operatingSystems: ["windows", "osx"],
};

// Sample free game
const sampleFreeGame = {
  id: 1207658999,
  slug: "gwent-the-witcher-card-game",
  title: "GWENT: The Witcher Card Game",
  productType: "game",
  releaseDate: "2018-10-23T22:00:00+00:00",
  image: "https://images.gog.com/gwent.jpg",
  rating: 42,
  genres: [{ name: "Strategy", slug: "strategy" }],
  developer: "CD PROJEKT RED",
  publisher: "CD PROJEKT RED",
  price: {
    amount: "0.00",
    currency: "USD",
    isFree: true,
  },
  screenshots: [],
  tags: [],
  operatingSystems: ["windows"],
};

// Sample DLC (should be filtered out in some contexts)
const sampleDlc = {
  id: 1207658700,
  slug: "witcher-3-hearts-of-stone",
  title: "The Witcher 3: Hearts of Stone",
  productType: "dlc",
  releaseDate: "2015-10-13T22:00:00+00:00",
  image: "https://images.gog.com/hos.jpg",
  price: {
    amount: "9.99",
    currency: "USD",
    isFree: false,
  },
};

// Sample catalog response
const sampleCatalogResponse = {
  products: [sampleGogProduct, sampleFreeGame],
  pages: 100,
  totalPages: 100,
  totalResults: 4800,
};

// Sample search response
const sampleSearchResponse = {
  products: [
    {
      id: 1207658691,
      title: "The Witcher 3: Wild Hunt",
      slug: "the-witcher-3-wild-hunt",
      price: { amount: "39.99", discountPercentage: 20 },
      image: "https://images.gog.com/witcher3.jpg",
      url: "/game/the-witcher-3-wild-hunt",
      rating: 49,
      category: "Role-playing",
    },
  ],
};

// Sample sales response
const sampleSalesResponse = {
  products: [
    {
      id: 1207658691,
      title: "The Witcher 3: Wild Hunt",
      slug: "the-witcher-3-wild-hunt",
      price: { base: "49.99", final: "29.99", discount: 40 },
      coverHorizontal: "https://images.gog.com/witcher3_h.jpg",
    },
  ],
};

// Sample product details response (different structure from catalog)
const sampleProductDetails = {
  id: 1207658691,
  title: "The Witcher 3: Wild Hunt",
  name: "The Witcher 3: Wild Hunt",
  slug: "the-witcher-3-wild-hunt",
  releaseDate: "2015-05-18",
  release_date: "2015-05-18",
  description: "The Witcher 3 is an open world RPG...",
  rating: 49,
  genres: ["RPG", "Adventure"],
  developers: [{ name: "CD PROJEKT RED" }],
  publishers: [{ name: "CD PROJEKT RED" }],
  images: {
    logo2x: "https://images.gog.com/witcher3_logo.jpg",
    background: "https://images.gog.com/witcher3_bg.jpg",
  },
  screenshots: [{ image_url: "https://images.gog.com/screen1.jpg" }],
  features: ["achievements", "cloud_saves"],
};

describe("GOG Adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GENRE_MAP", () => {
    it("should map common GOG genres to standardized names", () => {
      expect(GENRE_MAP.action).toBe("Action");
      expect(GENRE_MAP.rpg).toBe("RPG");
      expect(GENRE_MAP.strategy).toBe("Strategy");
      expect(GENRE_MAP.adventure).toBe("Adventure");
    });

    it("should map RPG variants to RPG", () => {
      expect(GENRE_MAP["role-playing"]).toBe("RPG");
    });

    it("should map strategy variants", () => {
      expect(GENRE_MAP["real-time-strategy"]).toBe("Strategy");
      expect(GENRE_MAP["turn-based-strategy"]).toBe("Strategy");
    });
  });

  describe("fetchGogGameDetails", () => {
    it("should fetch and normalize a game", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleProductDetails,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchGogGameDetails(1207658691)) as any;

      expect(result).not.toBeNull();
      expect(result.title).toBe("The Witcher 3: Wild Hunt");
      expect(result.platform).toBe("PC");
      expect(result.platform_slug).toBe("gog");
      expect(result.release_year).toBe(2015);
      expect(result.description).toContain("open world RPG");
      expect(result.gog_data.drm).toBe("DRM-Free");
    });

    it("should use slug for lookup", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleProductDetails,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchGogGameDetails("the-witcher-3-wild-hunt")) as any;

      expect(result).not.toBeNull();
      expect(result.title).toBe("The Witcher 3: Wild Hunt");
    });

    it("should return null for 404 responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await fetchGogGameDetails(99999999);
      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchGogGameDetails(1234);
      expect(result).toBeNull();
    });
  });

  describe("searchGog", () => {
    it("should search for games by query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSearchResponse,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (await searchGog("witcher")) as any[];

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1207658691);
      expect(results[0].title).toBe("The Witcher 3: Wild Hunt");
      expect(results[0].slug).toBe("the-witcher-3-wild-hunt");
    });

    it("should limit results when maxResults is specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: Array(10).fill(sampleSearchResponse.products[0]),
        }),
      });

      const results = await searchGog("game", { maxResults: 5 });

      // The maxResults is passed to the API's limit param
      // The mock returns 10, but we verify the URL was constructed correctly
      expect(results.length).toBe(10);

      // Verify the correct URL was called with the limit
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=5"),
        expect.any(Object)
      );
    });

    it("should return empty array on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const results = await searchGog("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("fetchGogSales", () => {
    it("should fetch games on sale", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSalesResponse,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sales = (await fetchGogSales()) as any[];

      expect(sales).toHaveLength(1);
      expect(sales[0].id).toBe(1207658691);
      expect(sales[0].title).toBe("The Witcher 3: Wild Hunt");
      expect(sales[0].discountPercent).toBe(40);
      expect(sales[0].url).toContain("gog.com");
    });

    it("should return empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const sales = await fetchGogSales();
      expect(sales).toEqual([]);
    });
  });

  describe("fetchGogSource", () => {
    it("should fetch games from GOG catalog", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records).toHaveLength(1);
      expect(records[0].title).toBe("The Witcher 3: Wild Hunt");
      expect(records[0].platform).toBe("PC");
      expect(records[0].platform_slug).toBe("gog");
    });

    it("should respect the limit parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleCatalogResponse,
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      const records = await fetchGogSource(source);

      expect(records).toHaveLength(1);
    });

    it("should skip DLC products", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct, sampleDlc],
          pages: 1,
        }),
      });

      const source = { limit: 10, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      // Should only have the game, not the DLC
      expect(records).toHaveLength(1);
      expect(records[0].title).toBe("The Witcher 3: Wild Hunt");
    });

    it("should handle rate limiting gracefully", async () => {
      // First call returns 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      // After waiting, second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct],
          pages: 1,
        }),
      });

      // Mocking setTimeout to speed up the test
      vi.useFakeTimers();
      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };

      const fetchPromise = fetchGogSource(source);

      // Fast-forward through rate limit wait
      await vi.advanceTimersByTimeAsync(61000);

      const records = await fetchPromise;
      vi.useRealTimers();

      expect(records.length).toBeLessThanOrEqual(1);
    });

    it("should paginate through multiple pages", async () => {
      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct],
          pages: 2,
        }),
      });

      // Page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleFreeGame],
          pages: 2,
        }),
      });

      const source = { limit: 10, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records).toHaveLength(2);
      expect(records[0].title).toBe("The Witcher 3: Wild Hunt");
      expect(records[1].title).toBe("GWENT: The Witcher Card Game");
    });

    it("should stop when no more products are returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [],
          pages: 0,
        }),
      });

      const source = { limit: 100, rateLimit: { retryAfterMs: 10 } };
      const records = await fetchGogSource(source);

      expect(records).toEqual([]);
    });
  });

  describe("normalization edge cases", () => {
    it("should handle missing optional fields gracefully", async () => {
      const minimalProduct = {
        id: 12345,
        title: "Minimal Game",
        productType: "game",
        // Most fields missing
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [minimalProduct],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records).toHaveLength(1);
      expect(records[0].title).toBe("Minimal Game");
      expect(records[0].release_year).toBeNull();
      expect(records[0].genres).toEqual([]);
    });

    it("should extract year from various date formats", async () => {
      const gameWithIsoDate = {
        ...sampleGogProduct,
        id: 111,
        releaseDate: "2020-12-10T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [gameWithIsoDate],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records[0].release_year).toBe(2020);
    });

    it("should normalize prices correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records[0].pricing.priceCents).toBe(3999); // $39.99 = 3999 cents
      expect(records[0].pricing.originalPriceCents).toBe(4999); // $49.99 = 4999 cents
      expect(records[0].pricing.discountPercent).toBe(20);
      expect(records[0].pricing.currency).toBe("USD");
    });

    it("should handle free games correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleFreeGame],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records[0].pricing.isFree).toBe(true);
      expect(records[0].pricing.priceCents).toBe(0);
    });

    it("should set DRM-Free for all GOG games", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [sampleGogProduct],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records[0].gog_data.drm).toBe("DRM-Free");
    });

    it("should normalize genres through GENRE_MAP", async () => {
      const gameWithGenres = {
        ...sampleGogProduct,
        id: 222,
        genres: [
          { name: "role-playing", slug: "role-playing" },
          { name: "shooter", slug: "shooter" },
          { name: "Unknown", slug: "unknown" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [gameWithGenres],
          pages: 1,
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchGogSource(source)) as any[];

      expect(records[0].genres).toContain("RPG");
      expect(records[0].genres).toContain("Action"); // shooter -> Action
      expect(records[0].genres).toContain("Unknown"); // Unmapped pass through
    });
  });
});
