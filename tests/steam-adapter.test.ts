/**
 * Steam API Adapter Tests
 *
 * Tests the Steam Web API adapter for catalog ingestion.
 * Uses mocked fetch responses to avoid hitting real APIs.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking - use default export for non-exported functions
const steamModule = await import(
  "../services/catalog-ingest/sources/steam.js"
);
const {
  fetchSteamSource,
  fetchSteamGameDetails,
  searchSteam,
  fetchFeaturedGames,
} = steamModule;

// Access internal helpers via default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const steamDefault = steamModule.default as any;
const fetchSteamSpyList = steamDefault.fetchSteamSpyList;
const GENRE_MAP = steamDefault.GENRE_MAP;

// Sample Steam Store API response
const sampleSteamGame = {
  steam_appid: 570,
  name: "Dota 2",
  type: "game",
  is_free: true,
  detailed_description: "Dota 2 is a competitive game of action and strategy.",
  short_description: "Every day, millions of players worldwide enter battle.",
  header_image:
    "https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg",
  capsule_image:
    "https://cdn.akamai.steamstatic.com/steam/apps/570/capsule_sm_120.jpg",
  website: "http://www.dota2.com",
  developers: ["Valve"],
  publishers: ["Valve"],
  price_overview: null, // Free game
  required_age: 0,
  genres: [
    { id: "1", description: "Action" },
    { id: "2", description: "Strategy" },
  ],
  categories: [
    { id: 1, description: "Multi-player" },
    { id: 2, description: "Steam Achievements" },
  ],
  screenshots: [
    { id: 0, path_full: "https://example.com/screen1.jpg" },
    { id: 1, path_full: "https://example.com/screen2.jpg" },
  ],
  movies: [],
  achievements: { total: 50 },
  recommendations: { total: 2000000 },
  release_date: { coming_soon: false, date: "Jul 9, 2013" },
  metacritic: { score: 90, url: "https://metacritic.com/dota2" },
  pc_requirements: { minimum: "OS: Windows 7" },
  mac_requirements: { minimum: "OS: macOS 10.9" },
  linux_requirements: { minimum: "OS: Ubuntu 12.04" },
  supported_languages: "English<strong>*</strong>, French",
};

// Sample paid game
const samplePaidGame = {
  steam_appid: 1174180,
  name: "Red Dead Redemption 2",
  type: "game",
  is_free: false,
  short_description: "Arthur Morgan and the Van der Linde gang...",
  header_image:
    "https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg",
  developers: ["Rockstar Games"],
  publishers: ["Rockstar Games"],
  price_overview: {
    currency: "USD",
    initial: 5999,
    final: 2999,
    discount_percent: 50,
    final_formatted: "$29.99",
  },
  required_age: 17,
  genres: [
    { id: "1", description: "Action" },
    { id: "3", description: "Adventure" },
  ],
  categories: [],
  screenshots: [],
  movies: [],
  achievements: { total: 52 },
  recommendations: { total: 500000 },
  release_date: { coming_soon: false, date: "Dec 5, 2019" },
  metacritic: { score: 93 },
  pc_requirements: {},
  mac_requirements: {},
  linux_requirements: {},
};

// Sample SteamSpy response
const sampleSteamSpyList = {
  "570": {
    name: "Dota 2",
    developer: "Valve",
    publisher: "Valve",
    owners: "100,000,000 .. 200,000,000",
    average_forever: 16000,
    median_forever: 500,
    ccu: 600000,
    price: 0,
    score_rank: "",
  },
  "730": {
    name: "Counter-Strike 2",
    developer: "Valve",
    publisher: "Valve",
    owners: "50,000,000 .. 100,000,000",
    average_forever: 20000,
    median_forever: 1000,
    ccu: 1200000,
    price: 0,
    score_rank: "",
  },
};

// Sample search response
const sampleSearchResponse = {
  total: 2,
  items: [
    {
      id: 570,
      name: "Dota 2",
      type: "game",
      price: { final: 0, discount_percent: 0 },
      tiny_image: "https://example.com/dota2_tiny.jpg",
      metascore: "90",
      platforms: { windows: true, mac: true, linux: true },
    },
    {
      id: 1091500,
      name: "Cyberpunk 2077",
      type: "game",
      price: { final: 5999, discount_percent: 0 },
      tiny_image: "https://example.com/cyberpunk_tiny.jpg",
      metascore: "86",
      platforms: { windows: true, mac: false, linux: false },
    },
  ],
};

// Sample featured games response
const sampleFeaturedResponse = {
  featured_win: [
    {
      id: 570,
      name: "Dota 2",
      type: 0,
      discounted: false,
      discount_percent: 0,
      original_price: 0,
      final_price: 0,
      currency: "USD",
      header_image: "https://example.com/dota2_header.jpg",
      small_capsule_image: "https://example.com/dota2_small.jpg",
      large_capsule_image: "https://example.com/dota2_large.jpg",
    },
  ],
  featured_mac: [],
  featured_linux: [],
};

describe("Steam Adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GENRE_MAP", () => {
    it("should map common Steam genres to standardized names", () => {
      expect(GENRE_MAP.Action).toBe("Action");
      expect(GENRE_MAP.RPG).toBe("RPG");
      expect(GENRE_MAP["Massively Multiplayer"]).toBe("MMO");
      expect(GENRE_MAP.Indie).toBe("Indie");
      expect(GENRE_MAP["Early Access"]).toBe("Early Access");
    });

    it("should map violence-related genres to Action", () => {
      expect(GENRE_MAP.Violent).toBe("Action");
      expect(GENRE_MAP.Gore).toBe("Action");
    });
  });

  describe("fetchSteamGameDetails", () => {
    it("should fetch and normalize a free game", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "570": { success: true, data: sampleSteamGame },
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchSteamGameDetails(570)) as any;

      expect(result).not.toBeNull();
      expect(result.title).toBe("Dota 2");
      expect(result.game_name).toBe("Dota 2");
      expect(result.platform).toBe("PC");
      expect(result.platform_slug).toBe("steam");
      expect(result.release_year).toBe(2013);
      expect(result.pricing.isFree).toBe(true);
      expect(result.pricing.priceCents).toBe(0);
      expect(result.external_ids.steam).toBe(570);
      expect(result.steam_data.achievements).toBe(50);
      expect(result.steam_data.linuxSupport).toBe(true);
    });

    it("should fetch and normalize a paid game with discount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "1174180": { success: true, data: samplePaidGame },
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchSteamGameDetails(1174180)) as any;

      expect(result).not.toBeNull();
      expect(result.title).toBe("Red Dead Redemption 2");
      expect(result.pricing.isFree).toBe(false);
      expect(result.pricing.priceCents).toBe(2999);
      expect(result.pricing.originalPriceCents).toBe(5999);
      expect(result.pricing.discountPercent).toBe(50);
      expect(result.pricing.currency).toBe("USD");
      expect(result.rating).toBe(9.3); // 93/10
    });

    it("should return null for non-game content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "123": { success: true, data: { ...sampleSteamGame, type: "dlc" } },
        }),
      });

      const result = await fetchSteamGameDetails(123);
      expect(result).toBeNull();
    });

    it("should return null when API returns failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "999": { success: false },
        }),
      });

      const result = await fetchSteamGameDetails(999);
      expect(result).toBeNull();
    });

    it("should return null for 404 responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await fetchSteamGameDetails(99999999);
      expect(result).toBeNull();
    });
  });

  describe("fetchSteamSpyList", () => {
    it("should fetch and parse top games from SteamSpy", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSteamSpyList,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const games = (await fetchSteamSpyList("top100in2weeks")) as any[];

      expect(games).toHaveLength(2);
      expect(games[0].appId).toBe(570);
      expect(games[0].name).toBe("Dota 2");
      expect(games[0].developer).toBe("Valve");
      expect(games[0].ccu).toBe(600000);
      expect(games[1].appId).toBe(730);
      expect(games[1].name).toBe("Counter-Strike 2");
    });

    it("should return empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const games = await fetchSteamSpyList("top100forever");
      expect(games).toEqual([]);
    });
  });

  describe("searchSteam", () => {
    it("should search for games by query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSearchResponse,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (await searchSteam("dota")) as any[];

      expect(results).toHaveLength(2);
      expect(results[0].appId).toBe(570);
      expect(results[0].name).toBe("Dota 2");
      expect(results[0].metascore).toBe("90");
      expect(results[0].platforms.windows).toBe(true);
      expect(results[1].appId).toBe(1091500);
    });

    it("should limit results when maxResults is specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSearchResponse,
      });

      const results = await searchSteam("game", { maxResults: 1 });

      // The function slices results, so should get at most 1
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should return empty array on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const results = await searchSteam("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("fetchFeaturedGames", () => {
    it("should fetch featured games", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleFeaturedResponse,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const featured = (await fetchFeaturedGames()) as any[];

      expect(featured).toHaveLength(1);
      expect(featured[0].appId).toBe(570);
      expect(featured[0].name).toBe("Dota 2");
      expect(featured[0].discounted).toBe(false);
      expect(featured[0].currency).toBe("USD");
    });

    it("should deduplicate games across platforms", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          featured_win: [sampleFeaturedResponse.featured_win[0]],
          featured_mac: [sampleFeaturedResponse.featured_win[0]], // Same game
          featured_linux: [],
        }),
      });

      const featured = await fetchFeaturedGames();

      // Should only have 1 game despite appearing in both win and mac
      expect(featured).toHaveLength(1);
    });

    it("should return empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const featured = await fetchFeaturedGames();
      expect(featured).toEqual([]);
    });
  });

  describe("fetchSteamSource", () => {
    it("should fetch games from Steam using SteamSpy discovery", async () => {
      // The source function makes multiple API calls:
      // 1. SteamSpy trending list
      // 2. SteamSpy all-time list
      // 3+ Store API calls for each game found

      // Mock SteamSpy trending list (call 1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ "570": sampleSteamSpyList["570"] }),
      });

      // Mock SteamSpy all-time list (call 2)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Empty
      });

      // Mock Store API for game details (call 3)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "570": { success: true, data: sampleSteamGame },
        }),
      });

      const source = { limit: 1, rateLimit: { retryAfterMs: 10 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (await fetchSteamSource(source)) as any[];

      // Verify we tried to fetch from SteamSpy
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("steamspy.com"),
        expect.any(Object)
      );
    });

    it("should handle empty SteamSpy responses", async () => {
      // Mock SteamSpy returning empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const source = { limit: 10, rateLimit: { retryAfterMs: 10 } };
      const records = await fetchSteamSource(source);

      expect(records).toEqual([]);
    });
  });

  describe("normalization edge cases", () => {
    it("should handle missing optional fields gracefully", async () => {
      const minimalGame = {
        steam_appid: 12345,
        name: "Minimal Game",
        type: "game",
        is_free: false,
        // Most fields missing
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "12345": { success: true, data: minimalGame },
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchSteamGameDetails(12345)) as any;

      expect(result).not.toBeNull();
      expect(result.title).toBe("Minimal Game");
      expect(result.release_year).toBeNull();
      expect(result.genres).toEqual([]);
      expect(result.rating).toBeNull();
      expect(result.steam_data.achievements).toBe(0);
    });

    it("should extract year from various date formats", async () => {
      const gameWithWeirdDate = {
        ...sampleSteamGame,
        steam_appid: 111,
        release_date: { date: "Coming 2024", coming_soon: true },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "111": { success: true, data: gameWithWeirdDate },
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchSteamGameDetails(111)) as any;
      expect(result.release_year).toBe(2024);
    });

    it("should normalize genres through GENRE_MAP", async () => {
      const gameWithGenres = {
        ...sampleSteamGame,
        steam_appid: 222,
        genres: [
          { id: "1", description: "Massively Multiplayer" },
          { id: "2", description: "Free to Play" },
          { id: "3", description: "Unknown Genre" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "222": { success: true, data: gameWithGenres },
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fetchSteamGameDetails(222)) as any;
      expect(result.genres).toContain("MMO");
      expect(result.genres).toContain("Free to Play");
      expect(result.genres).toContain("Unknown Genre"); // Unmapped genres pass through
    });
  });
});
