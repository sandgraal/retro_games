import { describe, expect, it, beforeEach, vi } from "vitest";

import { escapeHtml } from "../app/utils/dom.js";
import {
  formatCurrency,
  formatNumber,
  formatRating,
  formatPercent,
  formatFieldLabel,
  timeAgo,
  formatAbsoluteDate,
  formatRelativeDate,
} from "../app/utils/format.js";
import { generateGameKey, parseGameKey } from "../app/utils/keys.js";
import {
  parseYear,
  parseRating as parseRatingValidation,
  sanitizeForId,
  isValidTheme,
} from "../app/utils/validation.js";
import {
  STATUS_NONE,
  STATUS_OWNED,
  STATUS_WISHLIST,
  getStatusForKey,
  setStatusForKey,
  getNoteForKey,
  setNoteForKey,
  getActiveStatusMap,
  setImportedCollection,
  hasImportedCollection,
  resetState,
} from "../app/state/collection.js";
import {
  getFilterPlatform,
  setFilterPlatform,
  getSearchValue,
  setSearchValue,
  getSortColumn,
  setSortColumn,
  getSortDirection,
  setSortDirection,
  getAllFilters,
  clearAllFilters,
  resetFilterState,
  COL_GAME,
  COL_RATING,
} from "../app/state/filters.js";
import {
  normalizePageSize,
  isValidTheme as isValidThemePrefs,
  getBrowseMode,
  setBrowseMode,
  getPageSize,
  setPageSize,
  getCurrentPage,
  setCurrentPage,
  resetPreferencesState,
  BROWSE_MODE_INFINITE,
  BROWSE_MODE_PAGED,
  DEFAULT_PAGE_SIZE,
} from "../app/state/preferences.js";
import {
  getCacheTimestamp,
  shouldRetryFallbackCover,
  getCachedCover,
  setCachedCover,
  hasCachedCover,
  getCacheSize,
  clearCoverCache,
  resetCacheState,
  loadFallbackCoverCache,
  persistFallbackCoverCache,
  getCoverCacheStorage,
  FALLBACK_COVER_RETRY_MS,
  FALLBACK_COVER_CACHE_KEY,
  FALLBACK_COVER_CACHE_LIMIT,
} from "../app/state/cache.js";
import {
  normalizeImageUrl,
  encodeStoragePath,
  buildStoragePublicUrl,
  resolveStorageCover,
  normalizeCoverUrl,
  setRowCover,
  resolveScreenshotCover,
} from "../app/data/storage.js";
import {
  resolveStreamPageSize,
  checkForceSampleMode,
  getTableCandidates,
  getSupabaseClient,
  isSupabaseAvailable,
  getSupabaseConfig,
  resetSupabaseClient,
  DEFAULT_STREAM_PAGE_SIZE,
  DEFAULT_SUPABASE_TABLES,
} from "../app/data/supabase.js";
import { tokens, generateCSSVariables } from "../app/design/tokens.js";

describe("dom utilities", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<div class="hero">& 'text'</div>`)).toBe(
      "&lt;div class=&quot;hero&quot;&gt;&amp; &#39;text&#39;&lt;/div&gt;"
    );
  });

  it("falls back to an empty string for falsy input", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml("")).toBe("");
  });
});

describe("format utilities", () => {
  it("formats currency with sensible defaults", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency(12.5)).toBe("$12.50");
  });

  it("supports currency values provided in cents", () => {
    expect(formatCurrency(12345, { fromCents: true })).toBe("$123");
    expect(formatCurrency(12345, { fromCents: true, precision: 2 })).toBe("$123.45");
  });

  it("formats numbers with grouping", () => {
    expect(formatNumber(12000)).toBe("12,000");
    expect(formatNumber("42")).toBe("42");
    expect(formatNumber(undefined)).toBe("0");
  });

  it("formats ratings to one decimal place", () => {
    expect(formatRating("9.432")).toBe("9.4");
    expect(formatRating(null)).toBe("N/A");
  });

  it("formatPercent handles various values", () => {
    expect(formatPercent(50, 100)).toBe("50%");
    expect(formatPercent(0.5, 100)).toBe("<1%");
    expect(formatPercent(5.5, 100)).toBe("5.5%");
    expect(formatPercent(0, 0)).toBe("0%");
    expect(formatPercent(null, 100)).toBe("0%");
  });

  it("formatFieldLabel converts various formats", () => {
    expect(formatFieldLabel("game_name")).toBe("Game Name");
    expect(formatFieldLabel("releaseYear")).toBe("Release Year");
    expect(formatFieldLabel("cover-url")).toBe("Cover Url");
    expect(formatFieldLabel("")).toBe("");
  });

  it("timeAgo produces short relative labels", () => {
    const now = Date.now();
    expect(timeAgo(now - 30000)).toBe("just now");
    expect(timeAgo(now - 120000)).toBe("2m");
    expect(timeAgo(now - 7200000)).toBe("2h");
    expect(timeAgo(now - 172800000)).toBe("2d");
    expect(timeAgo(null)).toBe("");
  });

  it("formatAbsoluteDate formats dates", () => {
    const date = new Date("2024-12-25");
    const result = formatAbsoluteDate(date);
    expect(result).toContain("2024");
    expect(result).toContain("Dec");
    expect(formatAbsoluteDate(null)).toBe("");
    expect(formatAbsoluteDate("invalid")).toBe("");
  });

  it("formatRelativeDate produces relative labels", () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 30000)).toBe("just now");
    expect(formatRelativeDate(new Date(now - 120000))).toBe("2m");
    expect(formatRelativeDate(null)).toBe("");
  });
});

describe("key utilities", () => {
  it("builds stable game keys", () => {
    expect(generateGameKey("Chrono Trigger", "SNES")).toBe("Chrono Trigger___SNES");
    expect(generateGameKey("  Chrono Trigger  ", " SNES ")).toBe("Chrono Trigger___SNES");
  });

  it("falls back gracefully when parts are missing", () => {
    expect(generateGameKey("", "SNES")).toBe("unknown___SNES");
    expect(generateGameKey("Chrono Trigger", "")).toBe("Chrono Trigger___unknown");
    expect(generateGameKey()).toBe("");
  });

  it("parses composite keys", () => {
    expect(parseGameKey("Chrono Trigger___SNES")).toEqual({
      game: "Chrono Trigger",
      platform: "SNES",
    });
  });
});

describe("validation utilities", () => {
  it("parseYear parses valid years", () => {
    expect(parseYear("1995")).toBe(1995);
    expect(parseYear(2020)).toBe(2020);
    expect(parseYear("1985")).toBe(1985);
  });

  it("parseYear returns null for invalid values", () => {
    expect(parseYear(null)).toBe(null);
    expect(parseYear("not a year")).toBe(null);
    expect(parseYear(undefined)).toBe(null);
  });

  it("parseRating parses valid ratings", () => {
    expect(parseRatingValidation("9.5")).toBe(9.5);
    expect(parseRatingValidation(8.0)).toBe(8);
    expect(parseRatingValidation("7.25")).toBe(7.25);
  });

  it("parseRating returns null for invalid values", () => {
    expect(parseRatingValidation(null)).toBe(null);
    expect(parseRatingValidation("N/A")).toBe(null);
    expect(parseRatingValidation(Infinity)).toBe(null);
  });

  it("sanitizeForId creates safe HTML ids", () => {
    expect(sanitizeForId("Game Name!")).toBe("game-name");
    expect(sanitizeForId("Mario__Bros")).toBe("mario__bros");
    expect(sanitizeForId("--test--")).toBe("test");
    expect(sanitizeForId("")).toBe("");
  });

  it("isValidTheme validates theme strings", () => {
    expect(isValidTheme("light")).toBe(true);
    expect(isValidTheme("dark")).toBe(true);
    expect(isValidTheme("auto")).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme("")).toBe(false);
  });
});

describe("collection state", () => {
  beforeEach(() => {
    resetState();
  });

  it("getStatusForKey returns STATUS_NONE for unknown keys", () => {
    expect(getStatusForKey("unknown___key")).toBe(STATUS_NONE);
  });

  it("setStatusForKey and getStatusForKey work together", () => {
    setStatusForKey("Chrono Trigger___SNES", STATUS_OWNED);
    expect(getStatusForKey("Chrono Trigger___SNES")).toBe(STATUS_OWNED);

    setStatusForKey("Chrono Trigger___SNES", STATUS_WISHLIST);
    expect(getStatusForKey("Chrono Trigger___SNES")).toBe(STATUS_WISHLIST);
  });

  it("setStatusForKey removes when set to STATUS_NONE", () => {
    setStatusForKey("Game___Platform", STATUS_OWNED);
    expect(getStatusForKey("Game___Platform")).toBe(STATUS_OWNED);

    setStatusForKey("Game___Platform", STATUS_NONE);
    expect(getStatusForKey("Game___Platform")).toBe(STATUS_NONE);
  });

  it("getNoteForKey returns empty string for unknown keys", () => {
    expect(getNoteForKey("unknown___key")).toBe("");
  });

  it("setNoteForKey and getNoteForKey work together", () => {
    setNoteForKey("Game___Platform", "My note");
    expect(getNoteForKey("Game___Platform")).toBe("My note");

    setNoteForKey("Game___Platform", "   Updated note   ");
    expect(getNoteForKey("Game___Platform")).toBe("Updated note");
  });

  it("setNoteForKey removes when set to empty", () => {
    setNoteForKey("Game___Platform", "A note");
    setNoteForKey("Game___Platform", "");
    expect(getNoteForKey("Game___Platform")).toBe("");
  });

  it("imported collection overrides active status map", () => {
    setStatusForKey("Game___Platform", STATUS_OWNED);
    expect(hasImportedCollection()).toBe(false);
    expect(getActiveStatusMap()["Game___Platform"]).toBe(STATUS_OWNED);

    const imported = { Other___Game: STATUS_WISHLIST };
    setImportedCollection(imported);
    expect(hasImportedCollection()).toBe(true);
    expect(getActiveStatusMap()).toBe(imported);

    setImportedCollection(null);
    expect(hasImportedCollection()).toBe(false);
  });
});

describe("filter state", () => {
  beforeEach(() => {
    resetFilterState();
  });

  it("filter getters return defaults initially", () => {
    expect(getFilterPlatform()).toBe("");
    expect(getSearchValue()).toBe("");
    expect(getSortColumn()).toBe(COL_GAME);
    expect(getSortDirection()).toBe("asc");
  });

  it("filter setters update values", () => {
    setFilterPlatform("SNES");
    expect(getFilterPlatform()).toBe("SNES");

    setSearchValue("Mario");
    expect(getSearchValue()).toBe("Mario");

    setSortColumn(COL_RATING);
    expect(getSortColumn()).toBe(COL_RATING);

    setSortDirection("desc");
    expect(getSortDirection()).toBe("desc");
  });

  it("getAllFilters returns complete state", () => {
    setFilterPlatform("NES");
    setSearchValue("Zelda");
    const filters = getAllFilters();
    expect(filters.filterPlatform).toBe("NES");
    expect(filters.searchValue).toBe("Zelda");
    expect(filters.sortColumn).toBe(COL_GAME);
  });

  it("clearAllFilters resets state", () => {
    setFilterPlatform("SNES");
    setSearchValue("test");
    setSortColumn(COL_RATING);
    setSortDirection("desc");

    clearAllFilters();

    expect(getFilterPlatform()).toBe("");
    expect(getSearchValue()).toBe("");
    expect(getSortColumn()).toBe(COL_GAME);
    expect(getSortDirection()).toBe("asc");
  });
});

describe("preferences state", () => {
  beforeEach(() => {
    resetPreferencesState();
  });

  it("normalizePageSize returns valid page sizes", () => {
    expect(normalizePageSize(30)).toBe(30);
    expect(normalizePageSize(60)).toBe(60);
    expect(normalizePageSize(120)).toBe(120);
    expect(normalizePageSize(45)).toBe(30); // closest
    expect(normalizePageSize(90)).toBe(60); // closest
    expect(normalizePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(-1)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("isValidTheme validates theme strings", () => {
    expect(isValidThemePrefs("light")).toBe(true);
    expect(isValidThemePrefs("dark")).toBe(true);
    expect(isValidThemePrefs("auto")).toBe(false);
    expect(isValidThemePrefs(null)).toBe(false);
  });

  it("browse mode getters/setters work", () => {
    expect(getBrowseMode()).toBe(BROWSE_MODE_INFINITE);

    setBrowseMode(BROWSE_MODE_PAGED);
    expect(getBrowseMode()).toBe(BROWSE_MODE_PAGED);

    setBrowseMode(BROWSE_MODE_INFINITE);
    expect(getBrowseMode()).toBe(BROWSE_MODE_INFINITE);
  });

  it("page size getters/setters work", () => {
    expect(getPageSize()).toBe(DEFAULT_PAGE_SIZE);

    setPageSize(30);
    expect(getPageSize()).toBe(30);

    setPageSize(100); // should normalize to closest
    expect(getPageSize()).toBe(120);
  });

  it("current page getters/setters work", () => {
    expect(getCurrentPage()).toBe(1);

    setCurrentPage(5);
    expect(getCurrentPage()).toBe(5);

    setCurrentPage(0); // should be at least 1
    expect(getCurrentPage()).toBe(1);
  });

  it("resetPreferencesState resets all", () => {
    setBrowseMode(BROWSE_MODE_PAGED);
    setPageSize(120);
    setCurrentPage(10);

    resetPreferencesState();

    expect(getBrowseMode()).toBe(BROWSE_MODE_INFINITE);
    expect(getPageSize()).toBe(DEFAULT_PAGE_SIZE);
    expect(getCurrentPage()).toBe(1);
  });
});

describe("cache state", () => {
  beforeEach(() => {
    resetCacheState();
  });

  it("getCacheTimestamp extracts timestamps correctly", () => {
    expect(getCacheTimestamp(null)).toBe(0);
    expect(getCacheTimestamp({})).toBe(0);
    expect(getCacheTimestamp({ timestamp: 12345 })).toBe(12345);
    expect(getCacheTimestamp({ failedAt: 67890 })).toBe(67890);
    expect(getCacheTimestamp({ timestamp: 12345, failedAt: 67890 })).toBe(12345);
  });

  it("shouldRetryFallbackCover handles various states", () => {
    const now = Date.now();

    // No entry - should retry
    expect(shouldRetryFallbackCover(null, now)).toBe(true);
    expect(shouldRetryFallbackCover(undefined, now)).toBe(true);

    // Has URL - don't retry
    expect(shouldRetryFallbackCover({ url: "http://example.com/img.jpg" }, now)).toBe(
      false
    );

    // Failed recently - don't retry
    expect(shouldRetryFallbackCover({ failedAt: now - 1000 }, now)).toBe(false);

    // Failed long ago - should retry
    expect(
      shouldRetryFallbackCover({ failedAt: now - FALLBACK_COVER_RETRY_MS - 1000 }, now)
    ).toBe(true);
  });

  it("cover cache operations work correctly", () => {
    expect(getCacheSize()).toBe(0);
    expect(hasCachedCover("game___platform")).toBe(false);

    setCachedCover("game___platform", { url: "http://example.com/cover.jpg" });
    expect(getCacheSize()).toBe(1);
    expect(hasCachedCover("game___platform")).toBe(true);
    expect(getCachedCover("game___platform")).toEqual({
      url: "http://example.com/cover.jpg",
    });

    clearCoverCache();
    expect(getCacheSize()).toBe(0);
  });

  it("getCoverCacheStorage returns localStorage in jsdom", () => {
    const storage = getCoverCacheStorage();
    // In jsdom test environment, should return localStorage
    expect(storage).toBeTruthy();
    expect(typeof storage.getItem).toBe("function");
    expect(typeof storage.setItem).toBe("function");
  });

  it("loadFallbackCoverCache initializes empty cache when storage empty", () => {
    const storage = getCoverCacheStorage();
    if (storage) {
      storage.removeItem(FALLBACK_COVER_CACHE_KEY);
    }
    resetCacheState();
    loadFallbackCoverCache();
    expect(getCacheSize()).toBe(0);
  });

  it("loadFallbackCoverCache restores cached entries from storage", () => {
    const storage = getCoverCacheStorage();
    if (!storage) return; // Skip if no storage

    const testData = {
      game1___NES: { url: "http://example.com/1.jpg", timestamp: 1000 },
      game2___SNES: { url: "http://example.com/2.jpg", timestamp: 2000 },
    };
    storage.setItem(FALLBACK_COVER_CACHE_KEY, JSON.stringify(testData));

    resetCacheState();
    loadFallbackCoverCache();

    expect(getCacheSize()).toBe(2);
    expect(getCachedCover("game1___NES")).toEqual({
      url: "http://example.com/1.jpg",
      timestamp: 1000,
    });
    expect(getCachedCover("game2___SNES")).toEqual({
      url: "http://example.com/2.jpg",
      timestamp: 2000,
    });

    // Cleanup
    storage.removeItem(FALLBACK_COVER_CACHE_KEY);
  });

  it("loadFallbackCoverCache handles invalid JSON gracefully", () => {
    const storage = getCoverCacheStorage();
    if (!storage) return;

    storage.setItem(FALLBACK_COVER_CACHE_KEY, "not valid json");
    resetCacheState();
    loadFallbackCoverCache();
    expect(getCacheSize()).toBe(0);

    storage.removeItem(FALLBACK_COVER_CACHE_KEY);
  });

  it("loadFallbackCoverCache handles non-object JSON gracefully", () => {
    const storage = getCoverCacheStorage();
    if (!storage) return;

    storage.setItem(FALLBACK_COVER_CACHE_KEY, '"just a string"');
    resetCacheState();
    loadFallbackCoverCache();
    expect(getCacheSize()).toBe(0);

    storage.removeItem(FALLBACK_COVER_CACHE_KEY);
  });

  it("persistFallbackCoverCache saves entries to storage", () => {
    const storage = getCoverCacheStorage();
    if (!storage) return;

    resetCacheState();
    setCachedCover("test___game", { url: "http://example.com/test.jpg", timestamp: 999 });

    persistFallbackCoverCache();

    const stored = storage.getItem(FALLBACK_COVER_CACHE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored);
    expect(parsed["test___game"]).toEqual({
      url: "http://example.com/test.jpg",
      timestamp: 999,
    });

    storage.removeItem(FALLBACK_COVER_CACHE_KEY);
  });

  it("constants have expected values", () => {
    expect(FALLBACK_COVER_CACHE_KEY).toBe("rom_cover_cache_v1");
    expect(FALLBACK_COVER_CACHE_LIMIT).toBe(400);
    expect(FALLBACK_COVER_RETRY_MS).toBe(1000 * 60 * 60 * 24 * 7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// data/aggregates tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  normalizeAggregatePayload,
  computeLocalGenreAggregates,
  getReleaseYear,
  computeLocalTimelineSeries,
  parseGenreRpcResponse,
  parseTimelineRpcResponse,
  aggregateGenreQueryResults,
  parseTimelineQueryResults,
} from "../app/data/aggregates.js";

describe("data/aggregates", () => {
  describe("normalizeAggregatePayload", () => {
    it("returns nulls for empty payload", () => {
      const result = normalizeAggregatePayload();
      expect(result).toEqual({
        search: null,
        platform: null,
        genre: null,
        ratingMin: null,
        yearStart: null,
        yearEnd: null,
        region: null,
      });
    });

    it("preserves valid values", () => {
      const result = normalizeAggregatePayload({
        search: "mario",
        platform: "SNES",
        genre: "RPG",
        ratingMin: 4.0,
        yearStart: 1990,
        yearEnd: 2000,
        region: "NTSC-U",
      });
      expect(result.search).toBe("mario");
      expect(result.platform).toBe("SNES");
      expect(result.genre).toBe("RPG");
      expect(result.ratingMin).toBe(4.0);
      expect(result.yearStart).toBe(1990);
      expect(result.yearEnd).toBe(2000);
      expect(result.region).toBe("NTSC-U");
    });

    it("converts empty strings to null", () => {
      const result = normalizeAggregatePayload({
        search: "",
        platform: "",
        genre: "",
        region: "",
      });
      expect(result.search).toBe(null);
      expect(result.platform).toBe(null);
      expect(result.genre).toBe(null);
      expect(result.region).toBe(null);
    });
  });

  describe("computeLocalGenreAggregates", () => {
    it("returns empty array for empty rows", () => {
      expect(computeLocalGenreAggregates([])).toEqual([]);
      expect(computeLocalGenreAggregates(null)).toEqual([]);
    });

    it("counts single-value genres", () => {
      const rows = [{ genre: "RPG" }, { genre: "RPG" }, { genre: "Action" }];
      const result = computeLocalGenreAggregates(rows);
      expect(result).toEqual([
        { name: "RPG", count: 2 },
        { name: "Action", count: 1 },
      ]);
    });

    it("splits comma-separated genres", () => {
      const rows = [
        { genre: "RPG, Action" },
        { genre: "RPG" },
        { genre: "Puzzle, Action" },
      ];
      const result = computeLocalGenreAggregates(rows);
      expect(result).toEqual([
        { name: "RPG", count: 2 },
        { name: "Action", count: 2 },
        { name: "Puzzle", count: 1 },
      ]);
    });

    it("handles rows with no genre", () => {
      const rows = [{ genre: "RPG" }, { genre: null }, { genre: "" }];
      const result = computeLocalGenreAggregates(rows);
      expect(result).toEqual([{ name: "RPG", count: 1 }]);
    });
  });

  describe("getReleaseYear", () => {
    it("extracts year from release_year field", () => {
      expect(getReleaseYear({ release_year: 1995 })).toBe(1995);
      expect(getReleaseYear({ release_year: "1995" })).toBe(1995);
    });

    it("falls back to year field", () => {
      expect(getReleaseYear({ year: 2000 })).toBe(2000);
    });

    it("returns null for invalid values", () => {
      expect(getReleaseYear(null)).toBe(null);
      expect(getReleaseYear({})).toBe(null);
      expect(getReleaseYear({ release_year: "invalid" })).toBe(null);
      expect(getReleaseYear({ release_year: 1800 })).toBe(null);
      expect(getReleaseYear({ release_year: 2200 })).toBe(null);
    });
  });

  describe("computeLocalTimelineSeries", () => {
    it("returns empty array for empty rows", () => {
      expect(computeLocalTimelineSeries([])).toEqual([]);
      expect(computeLocalTimelineSeries(null)).toEqual([]);
    });

    it("groups games by year and sorts ascending", () => {
      const rows = [
        { release_year: 1995 },
        { release_year: 1990 },
        { release_year: 1995 },
        { release_year: 2000 },
      ];
      const result = computeLocalTimelineSeries(rows);
      expect(result).toEqual([
        { year: 1990, count: 1 },
        { year: 1995, count: 2 },
        { year: 2000, count: 1 },
      ]);
    });

    it("skips invalid years", () => {
      const rows = [
        { release_year: 1995 },
        { release_year: null },
        { release_year: "invalid" },
      ];
      const result = computeLocalTimelineSeries(rows);
      expect(result).toEqual([{ year: 1995, count: 1 }]);
    });
  });

  describe("parseGenreRpcResponse", () => {
    it("handles various field name conventions", () => {
      const rpcData = [
        { genre: "RPG", count: 10 },
        { name: "Action", count: 5 },
        { genres: ["Puzzle", "Strategy"], count: 3 },
      ];
      const result = parseGenreRpcResponse(rpcData);
      expect(result).toEqual([
        { name: "RPG", count: 10 },
        { name: "Action", count: 5 },
        { name: "Puzzle, Strategy", count: 3 },
      ]);
    });

    it("filters out zero-count entries", () => {
      const rpcData = [
        { genre: "RPG", count: 10 },
        { genre: "Empty", count: 0 },
      ];
      const result = parseGenreRpcResponse(rpcData);
      expect(result).toEqual([{ name: "RPG", count: 10 }]);
    });

    it("handles non-array input", () => {
      expect(parseGenreRpcResponse(null)).toEqual([]);
      expect(parseGenreRpcResponse(undefined)).toEqual([]);
    });
  });

  describe("parseTimelineRpcResponse", () => {
    it("handles various field name conventions", () => {
      const rpcData = [
        { year: 1995, count: 5 },
        { release_year: 2000, count: 3 },
        { y: 2010, count: 2 },
      ];
      const result = parseTimelineRpcResponse(rpcData);
      expect(result).toEqual([
        { year: 1995, count: 5 },
        { year: 2000, count: 3 },
        { year: 2010, count: 2 },
      ]);
    });

    it("filters out invalid entries", () => {
      const rpcData = [
        { year: 1995, count: 5 },
        { year: "invalid", count: 3 },
        { year: 2000, count: 0 },
      ];
      const result = parseTimelineRpcResponse(rpcData);
      expect(result).toEqual([{ year: 1995, count: 5 }]);
    });
  });

  describe("aggregateGenreQueryResults", () => {
    it("aggregates comma-separated genres from query", () => {
      const queryData = [
        { genre: "RPG, Action", count: 5 },
        { genre: "RPG", count: 3 },
        { genre: "Action, Puzzle", count: 2 },
      ];
      const result = aggregateGenreQueryResults(queryData);
      expect(result).toEqual([
        { name: "RPG", count: 8 },
        { name: "Action", count: 7 },
        { name: "Puzzle", count: 2 },
      ]);
    });

    it("handles empty or null values", () => {
      const queryData = [
        { genre: "RPG", count: 5 },
        { genre: null, count: 3 },
        { genre: "", count: 2 },
      ];
      const result = aggregateGenreQueryResults(queryData);
      expect(result).toEqual([{ name: "RPG", count: 5 }]);
    });
  });

  describe("parseTimelineQueryResults", () => {
    it("parses timeline query data", () => {
      const queryData = [
        { release_year: 1995, count: 5 },
        { release_year: 2000, count: 3 },
      ];
      const result = parseTimelineQueryResults(queryData);
      expect(result).toEqual([
        { year: 1995, count: 5 },
        { year: 2000, count: 3 },
      ]);
    });

    it("filters invalid entries", () => {
      const queryData = [
        { release_year: 1995, count: 5 },
        { release_year: "bad", count: 3 },
        { release_year: 2000, count: 0 },
      ];
      const result = parseTimelineQueryResults(queryData);
      expect(result).toEqual([{ year: 1995, count: 5 }]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// data/pricing tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  normalizePriceValue,
  normalizeCents,
  selectStatusPrice,
  resolvePriceValue,
  computePriceDelta,
  normalizeHistoryEntries,
  resolveConsoleHint,
  buildPriceQuery,
  indexLatestPrices,
  formatCurrencyFromCents,
  createCurrencyFormatter,
  PLATFORM_NAME_ALIASES,
} from "../app/data/pricing.js";

describe("data/pricing", () => {
  describe("normalizePriceValue", () => {
    it("converts cents to dollars with 2 decimals", () => {
      expect(normalizePriceValue(1999)).toBe(19.99);
      expect(normalizePriceValue(100)).toBe(1.0);
      expect(normalizePriceValue(50)).toBe(0.5);
    });

    it("returns null for invalid values", () => {
      expect(normalizePriceValue(null)).toBe(null);
      expect(normalizePriceValue(undefined)).toBe(null);
      expect(normalizePriceValue("")).toBe(null);
      expect(normalizePriceValue("invalid")).toBe(null);
    });
  });

  describe("normalizeCents", () => {
    it("passes through valid numbers", () => {
      expect(normalizeCents(1000)).toBe(1000);
      expect(normalizeCents(0)).toBe(0);
    });

    it("parses string values", () => {
      expect(normalizeCents("1500")).toBe(1500);
    });

    it("returns null for invalid values", () => {
      expect(normalizeCents("invalid")).toBe(null);
      expect(normalizeCents(NaN)).toBe(null);
    });
  });

  describe("selectStatusPrice", () => {
    const prices = { loose: 10, cib: 20, new: 30 };

    it("prefers new for wishlist", () => {
      expect(selectStatusPrice("wishlist", prices)).toBe(30);
    });

    it("prefers loose for trade", () => {
      expect(selectStatusPrice("trade", prices)).toBe(10);
    });

    it("prefers cib for owned/backlog", () => {
      expect(selectStatusPrice("owned", prices)).toBe(20);
      expect(selectStatusPrice("backlog", prices)).toBe(20);
    });

    it("falls back when preferred not available", () => {
      expect(selectStatusPrice("wishlist", { loose: 10 })).toBe(10);
      expect(selectStatusPrice("trade", { cib: 20 })).toBe(20);
    });

    it("returns null for null prices", () => {
      expect(selectStatusPrice("owned", null)).toBe(null);
    });
  });

  describe("resolvePriceValue", () => {
    it("prefers cib_price_cents", () => {
      expect(
        resolvePriceValue({
          cib_price_cents: 2000,
          loose_price_cents: 1000,
          new_price_cents: 3000,
        })
      ).toBe(2000);
    });

    it("falls back to loose_price_cents", () => {
      expect(resolvePriceValue({ loose_price_cents: 1000 })).toBe(1000);
    });

    it("falls back to new_price_cents", () => {
      expect(resolvePriceValue({ new_price_cents: 3000 })).toBe(3000);
    });

    it("returns null for invalid entry", () => {
      expect(resolvePriceValue(null)).toBe(null);
      expect(resolvePriceValue({})).toBe(null);
    });
  });

  describe("computePriceDelta", () => {
    it("computes percentage change", () => {
      const history = [{ cib_price_cents: 1000 }, { cib_price_cents: 1500 }];
      expect(computePriceDelta(history)).toBe(50);
    });

    it("handles negative change", () => {
      const history = [{ cib_price_cents: 2000 }, { cib_price_cents: 1000 }];
      expect(computePriceDelta(history)).toBe(-50);
    });

    it("returns null for insufficient data", () => {
      expect(computePriceDelta([])).toBe(null);
      expect(computePriceDelta([{ cib_price_cents: 1000 }])).toBe(null);
    });

    it("returns null when first price is zero", () => {
      const history = [{ cib_price_cents: 0 }, { cib_price_cents: 1000 }];
      expect(computePriceDelta(history)).toBe(null);
    });
  });

  describe("normalizeHistoryEntries", () => {
    it("normalizes and sorts entries", () => {
      const entries = [
        {
          snapshot_date: "2024-02-01",
          loose_price_cents: 1000,
          cib_price_cents: 2000,
          new_price_cents: 3000,
        },
        {
          snapshot_date: "2024-01-01",
          loose_price_cents: 900,
          cib_price_cents: 1800,
          new_price_cents: 2700,
        },
      ];
      const result = normalizeHistoryEntries(entries);
      expect(result).toHaveLength(2);
      expect(result[0].snapshot_date).toBe("2024-01-01");
      expect(result[1].snapshot_date).toBe("2024-02-01");
    });

    it("filters entries without snapshot_date", () => {
      const entries = [{ cib_price_cents: 2000 }];
      expect(normalizeHistoryEntries(entries)).toEqual([]);
    });

    it("returns empty for non-array", () => {
      expect(normalizeHistoryEntries(null)).toEqual([]);
      expect(normalizeHistoryEntries(undefined)).toEqual([]);
    });
  });

  describe("resolveConsoleHint", () => {
    it("uses config hints first", () => {
      expect(resolveConsoleHint("SNES", { SNES: "Super Nintendo" })).toBe(
        "Super Nintendo"
      );
    });

    it("falls back to platform aliases", () => {
      expect(resolveConsoleHint("SNES")).toBe("Super Nintendo Entertainment System");
    });

    it("returns original if no mapping", () => {
      expect(resolveConsoleHint("Unknown Platform")).toBe("Unknown Platform");
    });

    it("returns empty for empty input", () => {
      expect(resolveConsoleHint("")).toBe("");
      expect(resolveConsoleHint(null)).toBe("");
    });
  });

  describe("buildPriceQuery", () => {
    it("combines title and platform", () => {
      expect(buildPriceQuery({ game_name: "Chrono Trigger", platform: "SNES" })).toBe(
        "Chrono Trigger Super Nintendo Entertainment System"
      );
    });

    it("handles game field alias", () => {
      expect(
        buildPriceQuery({ game: "Final Fantasy VII", platform: "PlayStation" })
      ).toBe("Final Fantasy VII PlayStation");
    });

    it("returns empty for missing title", () => {
      expect(buildPriceQuery({ platform: "SNES" })).toBe("");
      expect(buildPriceQuery(null)).toBe("");
    });
  });

  describe("indexLatestPrices", () => {
    it("indexes records by game_key", () => {
      const records = [
        { game_key: "game1___platform1", cib_price_cents: 2000 },
        { game_key: "game2___platform2", cib_price_cents: 3000 },
      ];
      const { map } = indexLatestPrices(records);
      expect(map.size).toBe(2);
      expect(map.get("game1___platform1").cib_price_cents).toBe(2000);
    });

    it("tracks newest snapshot date", () => {
      const records = [
        { game_key: "game1___p1", snapshot_date: "2024-01-01" },
        { game_key: "game2___p2", snapshot_date: "2024-02-15" },
      ];
      const { lastUpdated } = indexLatestPrices(records);
      expect(lastUpdated).toEqual(new Date("2024-02-15"));
    });

    it("skips records without game_key", () => {
      const records = [{ cib_price_cents: 2000 }];
      const { map } = indexLatestPrices(records);
      expect(map.size).toBe(0);
    });
  });

  describe("formatCurrencyFromCents", () => {
    it("formats whole dollars", () => {
      expect(formatCurrencyFromCents(1999)).toBe("$20");
      expect(formatCurrencyFromCents(100)).toBe("$1");
    });

    it("formats precise values", () => {
      expect(formatCurrencyFromCents(1999, { precise: true })).toBe("$19.99");
    });

    it("returns em-dash for invalid values", () => {
      expect(formatCurrencyFromCents(null)).toBe("—");
      expect(formatCurrencyFromCents(undefined)).toBe("—");
      expect(formatCurrencyFromCents("")).toBe("—");
    });
  });

  describe("createCurrencyFormatter", () => {
    it("creates a formatter for USD", () => {
      const formatter = createCurrencyFormatter("USD");
      if (formatter) {
        expect(formatter.format(100)).toContain("100");
      }
    });
  });

  describe("PLATFORM_NAME_ALIASES", () => {
    it("has common platform mappings", () => {
      expect(PLATFORM_NAME_ALIASES.SNES).toContain("Super Nintendo Entertainment System");
      expect(PLATFORM_NAME_ALIASES.NES).toContain("Nintendo Entertainment System");
      expect(PLATFORM_NAME_ALIASES.GENESIS).toContain("Sega Genesis");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/sharing tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  encodeSharePayload,
  decodeSharePayload,
  buildSharePayload,
  buildBackupPayload,
  parseBackupPayload,
  generateBackupFilename,
  buildCsvRow,
  buildCsvExport,
  countCollectionItems,
} from "../app/features/sharing.js";

describe("features/sharing", () => {
  describe("encodeSharePayload / decodeSharePayload", () => {
    it("round-trips a payload", () => {
      const payload = {
        statuses: { game1___platform1: "owned", game2___platform2: "wishlist" },
        notes: { game1___platform1: "Great game!" },
      };
      const encoded = encodeSharePayload(payload);
      const decoded = decodeSharePayload(encoded);
      expect(decoded.statuses).toEqual(payload.statuses);
      expect(decoded.notes).toEqual(payload.notes);
    });

    it("handles unicode characters", () => {
      const payload = {
        statuses: { ゲーム___プラットフォーム: "owned" },
        notes: { ゲーム___プラットフォーム: "日本語ノート" },
      };
      const encoded = encodeSharePayload(payload);
      const decoded = decodeSharePayload(encoded);
      expect(decoded.statuses["ゲーム___プラットフォーム"]).toBe("owned");
      expect(decoded.notes["ゲーム___プラットフォーム"]).toBe("日本語ノート");
    });

    it("returns null for invalid input", () => {
      expect(decodeSharePayload(null)).toBe(null);
      expect(decodeSharePayload("")).toBe(null);
      expect(decodeSharePayload("not-valid-base64!!!")).toBe(null);
    });

    it("handles legacy pipe-delimited format", () => {
      // Legacy format: key::status|key::status
      const legacy = "game1___p1::owned|game2___p2::wishlist";
      const encoded = btoa(legacy);
      const decoded = decodeSharePayload(encoded);
      expect(decoded.statuses["game1___p1"]).toBe("owned");
      expect(decoded.statuses["game2___p2"]).toBe("wishlist");
    });

    it("returns empty string for invalid payload in encode", () => {
      expect(encodeSharePayload(null)).toBe("");
      expect(encodeSharePayload(undefined)).toBe("");
    });
  });

  describe("buildSharePayload", () => {
    it("filters out none statuses and empty notes", () => {
      const statuses = {
        game1: "owned",
        game2: "none",
        game3: "wishlist",
      };
      const notes = {
        game1: "Good game",
        game2: "",
        game3: "   ",
      };
      const result = buildSharePayload(statuses, notes);
      expect(Object.keys(result.statuses)).toEqual(["game1", "game3"]);
      expect(Object.keys(result.notes)).toEqual(["game1"]);
    });

    it("handles null inputs", () => {
      const result = buildSharePayload(null, null);
      expect(result).toEqual({ statuses: {}, notes: {} });
    });
  });

  describe("buildBackupPayload", () => {
    it("combines statuses, notes, and filters", () => {
      const result = buildBackupPayload(
        { game1: "owned" },
        { game1: "note" },
        { filterPlatform: "SNES" }
      );
      expect(result.statuses).toEqual({ game1: "owned" });
      expect(result.notes).toEqual({ game1: "note" });
      expect(result.filters).toEqual({ filterPlatform: "SNES" });
    });

    it("handles missing inputs", () => {
      const result = buildBackupPayload(null, null, null);
      expect(result).toEqual({ statuses: {}, notes: {}, filters: {} });
    });
  });

  describe("parseBackupPayload", () => {
    it("parses valid backup JSON", () => {
      const json = JSON.stringify({
        statuses: { game1: "owned" },
        notes: { game1: "note" },
        filters: { platform: "SNES" },
      });
      const result = parseBackupPayload(json);
      expect(result.statuses).toEqual({ game1: "owned" });
      expect(result.notes).toEqual({ game1: "note" });
      expect(result.filters).toEqual({ platform: "SNES" });
    });

    it("returns null for invalid JSON", () => {
      expect(parseBackupPayload("not json")).toBe(null);
      expect(parseBackupPayload(null)).toBe(null);
      expect(parseBackupPayload("")).toBe(null);
    });

    it("returns null for empty object", () => {
      expect(parseBackupPayload("{}")).toBe(null);
    });
  });

  describe("generateBackupFilename", () => {
    it("generates filename with date", () => {
      const filename = generateBackupFilename();
      expect(filename).toMatch(/^collection-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("uses custom prefix", () => {
      const filename = generateBackupFilename("my-games");
      expect(filename).toMatch(/^my-games-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe("buildCsvRow", () => {
    it("builds CSV row from game data", () => {
      const game = {
        game_name: "Chrono Trigger",
        platform: "SNES",
        genre: "RPG",
        release_year: 1995,
      };
      const row = buildCsvRow(game, "owned", "Best game ever");
      expect(row).toBe("Chrono Trigger,SNES,RPG,1995,owned,Best game ever");
    });

    it("escapes commas and quotes", () => {
      const game = {
        game_name: 'Game "With" Quotes',
        platform: "Platform, With, Commas",
        genre: "Action",
        release_year: 2000,
      };
      const row = buildCsvRow(game, "owned", "");
      expect(row).toContain('"Game ""With"" Quotes"');
      expect(row).toContain('"Platform, With, Commas"');
    });

    it("handles missing fields", () => {
      const game = { game_name: "Test" };
      const row = buildCsvRow(game, "owned", "");
      expect(row).toBe("Test,,,,owned,");
    });
  });

  describe("buildCsvExport", () => {
    it("builds complete CSV with header", () => {
      const games = [
        { game_name: "Game 1", platform: "SNES" },
        { game_name: "Game 2", platform: "NES" },
      ];
      const statuses = {
        "Game 1___SNES": "owned",
        "Game 2___NES": "wishlist",
      };
      const notes = { "Game 1___SNES": "Note 1" };
      const keyGen = (g) => `${g.game_name}___${g.platform}`;
      const csv = buildCsvExport(games, statuses, notes, keyGen);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("Game Name,Platform,Genre,Release Year,Status,Notes");
      expect(lines).toHaveLength(3);
    });

    it("excludes games with no status", () => {
      const games = [{ game_name: "Game 1", platform: "SNES" }];
      const statuses = {};
      const keyGen = (g) => `${g.game_name}___${g.platform}`;
      const csv = buildCsvExport(games, statuses, {}, keyGen);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(1); // Header only
    });
  });

  describe("countCollectionItems", () => {
    it("counts statuses and notes", () => {
      const payload = {
        statuses: { a: "owned", b: "wishlist", c: "none" },
        notes: { a: "note", b: "" },
      };
      const result = countCollectionItems(payload);
      expect(result.totalStatuses).toBe(3);
      expect(result.nonNoneStatuses).toBe(2);
      expect(result.totalNotes).toBe(1);
    });

    it("handles null payload", () => {
      const result = countCollectionItems(null);
      expect(result).toEqual({ totalStatuses: 0, nonNoneStatuses: 0, totalNotes: 0 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/sorting tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  compareRows,
  createSortComparator,
  sortRows,
  getSortControlValue,
  parseSortSelection,
  isValidSortConfig,
  getDefaultSortConfig,
  getReleaseYear as getSortReleaseYear,
  COL_GAME,
  COL_RATING,
  COL_RELEASE_YEAR,
  SORT_OPTIONS,
} from "../app/features/sorting.js";

describe("features/sorting", () => {
  describe("getReleaseYear", () => {
    it("extracts year from release_year field", () => {
      expect(getSortReleaseYear({ release_year: 1995 })).toBe(1995);
      expect(getSortReleaseYear({ release_year: "1995" })).toBe(1995);
    });

    it("returns null for invalid years", () => {
      expect(getSortReleaseYear(null)).toBe(null);
      expect(getSortReleaseYear({})).toBe(null);
      expect(getSortReleaseYear({ release_year: 1800 })).toBe(null);
    });
  });

  describe("compareRows", () => {
    it("compares game names ascending", () => {
      const rowA = { game_name: "Chrono Trigger" };
      const rowB = { game_name: "Zelda" };
      expect(compareRows(rowA, rowB, COL_GAME, "asc")).toBeLessThan(0);
      expect(compareRows(rowB, rowA, COL_GAME, "asc")).toBeGreaterThan(0);
    });

    it("compares game names descending", () => {
      const rowA = { game_name: "Chrono Trigger" };
      const rowB = { game_name: "Zelda" };
      expect(compareRows(rowA, rowB, COL_GAME, "desc")).toBeGreaterThan(0);
    });

    it("compares ratings numerically", () => {
      const rowA = { rating: 4.5 };
      const rowB = { rating: 3.2 };
      expect(compareRows(rowA, rowB, COL_RATING, "asc")).toBeGreaterThan(0);
      expect(compareRows(rowA, rowB, COL_RATING, "desc")).toBeLessThan(0);
    });

    it("pushes null ratings to end", () => {
      const rowA = { rating: null };
      const rowB = { rating: 4.0 };
      // Ascending: null goes to end (infinity)
      expect(compareRows(rowA, rowB, COL_RATING, "asc")).toBeGreaterThan(0);
      // Descending: null goes to end (-infinity compared to 4.0)
      expect(compareRows(rowA, rowB, COL_RATING, "desc")).toBeGreaterThan(0);
    });

    it("compares release years", () => {
      const rowA = { release_year: 1990 };
      const rowB = { release_year: 1995 };
      expect(compareRows(rowA, rowB, COL_RELEASE_YEAR, "asc")).toBeLessThan(0);
      expect(compareRows(rowA, rowB, COL_RELEASE_YEAR, "desc")).toBeGreaterThan(0);
    });

    it("returns 0 for equal values", () => {
      const rowA = { game_name: "Same" };
      const rowB = { game_name: "Same" };
      expect(compareRows(rowA, rowB, COL_GAME, "asc")).toBe(0);
    });
  });

  describe("createSortComparator", () => {
    it("creates a reusable comparator", () => {
      const comparator = createSortComparator(COL_GAME, "asc");
      const rows = [{ game_name: "Zelda" }, { game_name: "Chrono Trigger" }];
      rows.sort(comparator);
      expect(rows[0].game_name).toBe("Chrono Trigger");
    });
  });

  describe("sortRows", () => {
    it("sorts without mutating original", () => {
      const original = [
        { game_name: "Zelda" },
        { game_name: "Chrono Trigger" },
        { game_name: "Mario" },
      ];
      const sorted = sortRows(original, COL_GAME, "asc");
      expect(sorted[0].game_name).toBe("Chrono Trigger");
      expect(original[0].game_name).toBe("Zelda"); // unchanged
    });

    it("handles empty array", () => {
      expect(sortRows([], COL_GAME, "asc")).toEqual([]);
    });

    it("handles non-array", () => {
      expect(sortRows(null, COL_GAME, "asc")).toEqual([]);
    });
  });

  describe("getSortControlValue", () => {
    it("maps column/direction to UI value", () => {
      expect(getSortControlValue(COL_GAME, "asc")).toBe(SORT_OPTIONS.NAME_ASC);
      expect(getSortControlValue(COL_GAME, "desc")).toBe(SORT_OPTIONS.NAME_DESC);
      expect(getSortControlValue(COL_RATING, "desc")).toBe(SORT_OPTIONS.RATING_DESC);
      expect(getSortControlValue(COL_RELEASE_YEAR, "asc")).toBe(SORT_OPTIONS.YEAR_ASC);
    });
  });

  describe("parseSortSelection", () => {
    it("parses UI value to column/direction", () => {
      expect(parseSortSelection(SORT_OPTIONS.NAME_ASC)).toEqual({
        column: COL_GAME,
        direction: "asc",
      });
      expect(parseSortSelection(SORT_OPTIONS.RATING_DESC)).toEqual({
        column: COL_RATING,
        direction: "desc",
      });
      expect(parseSortSelection(SORT_OPTIONS.YEAR_DESC)).toEqual({
        column: COL_RELEASE_YEAR,
        direction: "desc",
      });
    });

    it("defaults to name-asc for unknown value", () => {
      expect(parseSortSelection("unknown")).toEqual({
        column: COL_GAME,
        direction: "asc",
      });
    });
  });

  describe("isValidSortConfig", () => {
    it("validates correct configs", () => {
      expect(isValidSortConfig(COL_GAME, "asc")).toBe(true);
      expect(isValidSortConfig(COL_RATING, "desc")).toBe(true);
    });

    it("rejects invalid column", () => {
      expect(isValidSortConfig("invalid_column", "asc")).toBe(false);
    });

    it("rejects invalid direction", () => {
      expect(isValidSortConfig(COL_GAME, "sideways")).toBe(false);
    });
  });

  describe("getDefaultSortConfig", () => {
    it("returns name ascending", () => {
      expect(getDefaultSortConfig()).toEqual({
        column: COL_GAME,
        direction: "asc",
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/filtering tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  detectRegionCodesFromString,
  computeRegionCodes,
  rowMatchesRegion,
  rowMatchesPlatform,
  rowMatchesGenre,
  rowMatchesSearch,
  rowMatchesRating,
  rowMatchesYearRange,
  buildRowKey as buildFilterRowKey,
  doesRowMatchFilters,
  applyFilters as applyFiltersFn,
  extractFilterOptions,
  REGION_CODES,
  REGION_PATTERNS,
} from "../app/features/filtering.js";

describe("features/filtering", () => {
  describe("detectRegionCodesFromString", () => {
    it("detects NTSC codes", () => {
      expect(detectRegionCodesFromString("USA")).toContain("NTSC");
      expect(detectRegionCodesFromString("North America")).toContain("NTSC");
      expect(detectRegionCodesFromString("NTSC")).toContain("NTSC");
    });

    it("detects PAL codes", () => {
      expect(detectRegionCodesFromString("Europe")).toContain("PAL");
      expect(detectRegionCodesFromString("PAL")).toContain("PAL");
      expect(detectRegionCodesFromString("UK")).toContain("PAL");
    });

    it("detects JPN codes", () => {
      expect(detectRegionCodesFromString("Japan")).toContain("JPN");
      expect(detectRegionCodesFromString("JPN")).toContain("JPN");
    });

    it("handles comma-separated values", () => {
      const codes = detectRegionCodesFromString("USA, Japan");
      expect(codes).toContain("NTSC");
      expect(codes).toContain("JPN");
    });

    it("returns empty for unrecognized", () => {
      expect(detectRegionCodesFromString("Unknown")).toEqual([]);
      expect(detectRegionCodesFromString(null)).toEqual([]);
    });
  });

  describe("computeRegionCodes", () => {
    it("extracts from explicit region_code", () => {
      expect(computeRegionCodes({ region_code: "NTSC" })).toContain("NTSC");
    });

    it("extracts from region_codes array", () => {
      const codes = computeRegionCodes({ region_codes: ["NTSC", "PAL"] });
      expect(codes).toContain("NTSC");
      expect(codes).toContain("PAL");
    });

    it("detects from region text", () => {
      expect(computeRegionCodes({ region: "USA" })).toContain("NTSC");
    });

    it("returns empty for invalid input", () => {
      expect(computeRegionCodes(null)).toEqual([]);
      expect(computeRegionCodes({})).toEqual([]);
    });
  });

  describe("rowMatchesRegion", () => {
    it("matches when row has matching region", () => {
      const row = { region: "USA" };
      expect(rowMatchesRegion(row, "NTSC")).toBe(true);
    });

    it("defaults to NTSC when no region info", () => {
      expect(rowMatchesRegion({}, "NTSC")).toBe(true);
      expect(rowMatchesRegion({}, "PAL")).toBe(false);
    });

    it("matches any when no filter", () => {
      expect(rowMatchesRegion({ region: "Japan" }, "")).toBe(true);
      expect(rowMatchesRegion({ region: "Japan" }, null)).toBe(true);
    });
  });

  describe("rowMatchesPlatform", () => {
    it("matches exact platform", () => {
      expect(rowMatchesPlatform({ platform: "SNES" }, "SNES")).toBe(true);
      expect(rowMatchesPlatform({ platform: "SNES" }, "NES")).toBe(false);
    });

    it("matches any when no filter", () => {
      expect(rowMatchesPlatform({ platform: "SNES" }, "")).toBe(true);
    });
  });

  describe("rowMatchesGenre", () => {
    it("matches single genre", () => {
      expect(rowMatchesGenre({ genre: "RPG" }, "RPG")).toBe(true);
    });

    it("matches in comma-separated list", () => {
      expect(rowMatchesGenre({ genre: "RPG, Action" }, "RPG")).toBe(true);
      expect(rowMatchesGenre({ genre: "RPG, Action" }, "Action")).toBe(true);
    });

    it("returns false when genre not found", () => {
      expect(rowMatchesGenre({ genre: "RPG" }, "Action")).toBe(false);
    });

    it("matches any when no filter", () => {
      expect(rowMatchesGenre({ genre: "RPG" }, "")).toBe(true);
    });
  });

  describe("rowMatchesSearch", () => {
    it("matches in game name", () => {
      expect(rowMatchesSearch({ game_name: "Chrono Trigger" }, "chrono")).toBe(true);
    });

    it("matches in any field", () => {
      expect(rowMatchesSearch({ platform: "SNES", genre: "RPG" }, "snes")).toBe(true);
    });

    it("is case insensitive", () => {
      expect(rowMatchesSearch({ game_name: "Zelda" }, "ZELDA")).toBe(true);
    });

    it("matches any when no search", () => {
      expect(rowMatchesSearch({ game_name: "Test" }, "")).toBe(true);
    });
  });

  describe("rowMatchesRating", () => {
    it("matches when rating >= min", () => {
      expect(rowMatchesRating({ rating: 4.5 }, 4.0)).toBe(true);
      expect(rowMatchesRating({ rating: 4.0 }, 4.0)).toBe(true);
    });

    it("fails when rating < min", () => {
      expect(rowMatchesRating({ rating: 3.5 }, 4.0)).toBe(false);
    });

    it("matches any when no filter", () => {
      expect(rowMatchesRating({ rating: 2.0 }, "")).toBe(true);
      expect(rowMatchesRating({ rating: 2.0 }, null)).toBe(true);
    });
  });

  describe("rowMatchesYearRange", () => {
    it("matches within range", () => {
      expect(rowMatchesYearRange({ release_year: 1995 }, 1990, 2000)).toBe(true);
    });

    it("fails outside range", () => {
      expect(rowMatchesYearRange({ release_year: 1985 }, 1990, 2000)).toBe(false);
      expect(rowMatchesYearRange({ release_year: 2005 }, 1990, 2000)).toBe(false);
    });

    it("handles open-ended ranges", () => {
      expect(rowMatchesYearRange({ release_year: 1995 }, 1990, null)).toBe(true);
      expect(rowMatchesYearRange({ release_year: 1995 }, null, 2000)).toBe(true);
    });
  });

  describe("buildRowKey", () => {
    it("builds key from game_name and platform", () => {
      expect(buildFilterRowKey({ game_name: "Zelda", platform: "NES" })).toBe(
        "Zelda___NES"
      );
    });

    it("returns empty for null", () => {
      expect(buildFilterRowKey(null)).toBe("");
    });
  });

  describe("doesRowMatchFilters", () => {
    const row = {
      game_name: "Chrono Trigger",
      platform: "SNES",
      genre: "RPG",
      rating: 4.8,
      release_year: 1995,
      region: "USA",
    };

    it("matches with empty filters", () => {
      expect(doesRowMatchFilters(row, {})).toBe(true);
    });

    it("matches with matching filters", () => {
      expect(
        doesRowMatchFilters(row, {
          platform: "SNES",
          genre: "RPG",
          search: "chrono",
        })
      ).toBe(true);
    });

    it("fails with non-matching filter", () => {
      expect(doesRowMatchFilters(row, { platform: "NES" })).toBe(false);
    });

    it("respects imported collection filter", () => {
      expect(
        doesRowMatchFilters(
          row,
          {},
          { importedCollection: { "Chrono Trigger___SNES": true } }
        )
      ).toBe(true);
      expect(
        doesRowMatchFilters(row, {}, { importedCollection: { Other___NES: true } })
      ).toBe(false);
    });
  });

  describe("applyFilters", () => {
    const rows = [
      { game_name: "Zelda", platform: "NES", genre: "Action" },
      { game_name: "Mario", platform: "SNES", genre: "Platformer" },
      { game_name: "Chrono Trigger", platform: "SNES", genre: "RPG" },
    ];

    it("filters by platform", () => {
      const result = applyFiltersFn(rows, { platform: "SNES" });
      expect(result).toHaveLength(2);
    });

    it("filters by genre", () => {
      const result = applyFiltersFn(rows, { genre: "RPG" });
      expect(result).toHaveLength(1);
      expect(result[0].game_name).toBe("Chrono Trigger");
    });

    it("filters by search", () => {
      const result = applyFiltersFn(rows, { search: "mario" });
      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-array input", () => {
      expect(applyFiltersFn(null, {})).toEqual([]);
    });
  });

  describe("extractFilterOptions", () => {
    it("extracts unique platforms and genres", () => {
      const rows = [
        { platform: "SNES", genre: "RPG, Action" },
        { platform: "NES", genre: "RPG" },
        { platform: "SNES", genre: "Puzzle" },
      ];
      const options = extractFilterOptions(rows);
      expect(options.platforms).toEqual(["NES", "SNES"]);
      expect(options.genres).toContain("RPG");
      expect(options.genres).toContain("Action");
      expect(options.genres).toContain("Puzzle");
    });

    it("returns empty for non-array", () => {
      expect(extractFilterOptions(null)).toEqual({ platforms: [], genres: [] });
    });
  });

  describe("REGION constants", () => {
    it("has expected region codes", () => {
      expect(REGION_CODES).toContain("NTSC");
      expect(REGION_CODES).toContain("PAL");
      expect(REGION_CODES).toContain("JPN");
    });

    it("has patterns for each code", () => {
      expect(REGION_PATTERNS.NTSC).toContain("usa");
      expect(REGION_PATTERNS.PAL).toContain("europe");
      expect(REGION_PATTERNS.JPN).toContain("japan");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/pagination tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  normalizePageSize as normalizePageSizePagination,
  calculateTotalPages,
  calculatePageIndices,
  getPageItems,
  calculatePageWindow,
  buildPaginationMarkup,
  parsePaginationClick,
  calculateLoadMoreState,
  getLoadMoreText,
  createPaginationState,
  buildPaginationSummary,
  DEFAULT_PAGE_SIZE as DEFAULT_PAGE_SIZE_PAGINATION,
  PAGE_SIZE_CHOICES as PAGE_SIZE_CHOICES_PAGINATION,
} from "../app/features/pagination.js";

describe("features/pagination", () => {
  describe("normalizePageSize", () => {
    it("returns valid page size choices", () => {
      expect(normalizePageSizePagination(24)).toBe(24);
      expect(normalizePageSizePagination(48)).toBe(48);
    });

    it("returns default for invalid values", () => {
      expect(normalizePageSizePagination(25)).toBe(DEFAULT_PAGE_SIZE_PAGINATION);
      expect(normalizePageSizePagination(null)).toBe(DEFAULT_PAGE_SIZE_PAGINATION);
      expect(normalizePageSizePagination(NaN)).toBe(DEFAULT_PAGE_SIZE_PAGINATION);
    });
  });

  describe("calculateTotalPages", () => {
    it("calculates pages correctly", () => {
      expect(calculateTotalPages(100, 24)).toBe(5);
      expect(calculateTotalPages(24, 24)).toBe(1);
      expect(calculateTotalPages(25, 24)).toBe(2);
    });

    it("returns 1 for invalid inputs", () => {
      expect(calculateTotalPages(0, 24)).toBe(1);
      expect(calculateTotalPages(-10, 24)).toBe(1);
      expect(calculateTotalPages(100, 0)).toBe(1);
    });
  });

  describe("calculatePageIndices", () => {
    it("calculates correct indices", () => {
      expect(calculatePageIndices(1, 24)).toEqual({ start: 0, end: 24 });
      expect(calculatePageIndices(2, 24)).toEqual({ start: 24, end: 48 });
      expect(calculatePageIndices(3, 24)).toEqual({ start: 48, end: 72 });
    });

    it("handles edge cases", () => {
      expect(calculatePageIndices(0, 24)).toEqual({ start: 0, end: 24 }); // min page 1
      expect(calculatePageIndices(null, 24)).toEqual({ start: 0, end: 24 });
    });
  });

  describe("getPageItems", () => {
    const items = Array.from({ length: 50 }, (_, i) => `item${i}`);

    it("returns correct page slice", () => {
      expect(getPageItems(items, 1, 24)).toHaveLength(24);
      expect(getPageItems(items, 1, 24)[0]).toBe("item0");
      expect(getPageItems(items, 2, 24)).toHaveLength(24);
      expect(getPageItems(items, 2, 24)[0]).toBe("item24");
    });

    it("handles partial last page", () => {
      expect(getPageItems(items, 3, 24)).toHaveLength(2);
    });

    it("returns empty for invalid input", () => {
      expect(getPageItems(null, 1, 24)).toEqual([]);
    });
  });

  describe("calculatePageWindow", () => {
    it("calculates window around current page", () => {
      expect(calculatePageWindow(5, 10, 5)).toEqual({ startPage: 3, endPage: 7 });
    });

    it("adjusts at start", () => {
      expect(calculatePageWindow(1, 10, 5)).toEqual({ startPage: 1, endPage: 5 });
      expect(calculatePageWindow(2, 10, 5)).toEqual({ startPage: 1, endPage: 5 });
    });

    it("adjusts at end", () => {
      expect(calculatePageWindow(10, 10, 5)).toEqual({ startPage: 6, endPage: 10 });
      expect(calculatePageWindow(9, 10, 5)).toEqual({ startPage: 6, endPage: 10 });
    });

    it("handles small total pages", () => {
      expect(calculatePageWindow(1, 3, 5)).toEqual({ startPage: 1, endPage: 3 });
    });
  });

  describe("buildPaginationMarkup", () => {
    it("returns empty for single page", () => {
      expect(buildPaginationMarkup(1, 1)).toBe("");
    });

    it("includes prev/next buttons", () => {
      const markup = buildPaginationMarkup(2, 5);
      expect(markup).toContain('data-page="prev"');
      expect(markup).toContain('data-page="next"');
    });

    it("disables prev on first page", () => {
      const markup = buildPaginationMarkup(1, 5);
      expect(markup).toContain('data-page="prev" disabled');
    });

    it("disables next on last page", () => {
      const markup = buildPaginationMarkup(5, 5);
      expect(markup).toContain('data-page="next" disabled');
    });

    it("marks current page active", () => {
      const markup = buildPaginationMarkup(3, 5);
      expect(markup).toContain('data-page="3" class="is-active"');
    });
  });

  describe("parsePaginationClick", () => {
    it("handles prev", () => {
      expect(parsePaginationClick("prev", 3, 10)).toBe(2);
      expect(parsePaginationClick("prev", 1, 10)).toBe(null);
    });

    it("handles next", () => {
      expect(parsePaginationClick("next", 3, 10)).toBe(4);
      expect(parsePaginationClick("next", 10, 10)).toBe(null);
    });

    it("handles page numbers", () => {
      expect(parsePaginationClick("5", 3, 10)).toBe(5);
      expect(parsePaginationClick("3", 3, 10)).toBe(null); // same page
      expect(parsePaginationClick("15", 3, 10)).toBe(null); // out of range
    });

    it("returns null for invalid", () => {
      expect(parsePaginationClick(null, 3, 10)).toBe(null);
      expect(parsePaginationClick("", 3, 10)).toBe(null);
    });
  });

  describe("calculateLoadMoreState", () => {
    it("calculates more available", () => {
      const result = calculateLoadMoreState(24, 100, 24, false);
      expect(result.moreAvailable).toBe(true);
      expect(result.batchSize).toBe(24);
    });

    it("calculates partial remaining", () => {
      const result = calculateLoadMoreState(90, 100, 24, false);
      expect(result.moreAvailable).toBe(true);
      expect(result.batchSize).toBe(10);
    });

    it("handles server has more", () => {
      const result = calculateLoadMoreState(24, 24, 24, true);
      expect(result.moreAvailable).toBe(true);
      expect(result.batchSize).toBe(24);
    });

    it("handles none remaining", () => {
      const result = calculateLoadMoreState(100, 100, 24, false);
      expect(result.moreAvailable).toBe(false);
    });
  });

  describe("getLoadMoreText", () => {
    it("shows loading state", () => {
      expect(getLoadMoreText(24, true)).toBe("Loading more games…");
    });

    it("shows batch size", () => {
      expect(getLoadMoreText(24, false)).toBe("Load 24 more games");
    });
  });

  describe("createPaginationState", () => {
    it("creates complete state", () => {
      const state = createPaginationState({
        pageSize: 24,
        currentPage: 2,
        totalItems: 100,
        renderedCount: 48,
      });
      expect(state.pageSize).toBe(24);
      expect(state.currentPage).toBe(2);
      expect(state.totalPages).toBe(5);
      expect(state.totalItems).toBe(100);
    });

    it("normalizes page size", () => {
      const state = createPaginationState({ pageSize: 25 });
      expect(state.pageSize).toBe(DEFAULT_PAGE_SIZE_PAGINATION);
    });

    it("clamps current page", () => {
      const state = createPaginationState({
        currentPage: 10,
        totalItems: 50,
        pageSize: 24,
      });
      expect(state.currentPage).toBe(3); // clamped to max pages
    });
  });

  describe("buildPaginationSummary", () => {
    it("builds basic summary", () => {
      expect(buildPaginationSummary(24, 100)).toBe("Showing 24 of 100");
    });

    it("adds loading indicator", () => {
      expect(buildPaginationSummary(24, 100, true)).toBe(
        "Showing 24 of 100 • Fetching more…"
      );
    });
  });

  describe("PAGE_SIZE_CHOICES", () => {
    it("has expected choices", () => {
      expect(PAGE_SIZE_CHOICES_PAGINATION).toContain(12);
      expect(PAGE_SIZE_CHOICES_PAGINATION).toContain(24);
      expect(PAGE_SIZE_CHOICES_PAGINATION).toContain(48);
      expect(PAGE_SIZE_CHOICES_PAGINATION).toContain(96);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/search tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  normalizeSearchQuery,
  isQueryLongEnough,
  escapeRegexChars,
  buildPrefixRegex,
  buildContainsRegex,
  buildLocalSuggestions,
  scoreSuggestion,
  sortSuggestionsByRelevance,
  resolvePlatformSearchTerms,
  highlightMatch,
  splitByMatch,
  createDebouncer,
  buildTypeaheadSelectColumns,
  TYPEAHEAD_MIN_CHARS,
  TYPEAHEAD_DEBOUNCE_MS,
  TYPEAHEAD_LIMIT,
  TYPEAHEAD_SELECT_COLUMNS,
} from "../app/features/search.js";

describe("features/search", () => {
  describe("normalizeSearchQuery", () => {
    it("trims and lowercases query", () => {
      expect(normalizeSearchQuery("  Final Fantasy  ")).toBe("final fantasy");
      expect(normalizeSearchQuery("CHRONO TRIGGER")).toBe("chrono trigger");
    });

    it("returns empty for invalid input", () => {
      expect(normalizeSearchQuery(null)).toBe("");
      expect(normalizeSearchQuery(undefined)).toBe("");
      expect(normalizeSearchQuery(123)).toBe("");
    });
  });

  describe("isQueryLongEnough", () => {
    it("checks against minimum chars", () => {
      expect(isQueryLongEnough("ab")).toBe(true);
      expect(isQueryLongEnough("a")).toBe(false);
      expect(isQueryLongEnough("")).toBe(false);
    });

    it("uses custom minimum", () => {
      expect(isQueryLongEnough("abc", 3)).toBe(true);
      expect(isQueryLongEnough("ab", 3)).toBe(false);
    });
  });

  describe("escapeRegexChars", () => {
    it("escapes special characters", () => {
      expect(escapeRegexChars("test.*")).toBe("test\\.\\*");
      expect(escapeRegexChars("(foo)")).toBe("\\(foo\\)");
      expect(escapeRegexChars("[bar]")).toBe("\\[bar\\]");
    });

    it("returns empty for invalid", () => {
      expect(escapeRegexChars(null)).toBe("");
      expect(escapeRegexChars(123)).toBe("");
    });
  });

  describe("buildPrefixRegex", () => {
    it("creates case-insensitive prefix matcher", () => {
      const regex = buildPrefixRegex("final");
      expect(regex.test("Final Fantasy")).toBe(true);
      expect(regex.test("FINAL DESTINATION")).toBe(true);
      expect(regex.test("The Final")).toBe(false);
    });

    it("returns null for empty query", () => {
      expect(buildPrefixRegex("")).toBe(null);
      expect(buildPrefixRegex(null)).toBe(null);
    });
  });

  describe("buildContainsRegex", () => {
    it("creates case-insensitive substring matcher", () => {
      const regex = buildContainsRegex("fantasy");
      expect(regex.test("Final Fantasy VII")).toBe(true);
      expect(regex.test("FANTASY")).toBe(true);
    });

    it("returns null for empty query", () => {
      expect(buildContainsRegex("")).toBe(null);
    });
  });

  describe("buildLocalSuggestions", () => {
    const testData = [
      { game_name: "Final Fantasy VII" },
      { game_name: "Final Fantasy X" },
      { game_name: "Chrono Trigger" },
      { game_name: "The Final Stand" },
    ];

    it("finds prefix matches", () => {
      const results = buildLocalSuggestions(testData, "Final");
      expect(results).toHaveLength(2);
      expect(results[0].game_name).toBe("Final Fantasy VII");
    });

    it("is case-insensitive", () => {
      const results = buildLocalSuggestions(testData, "CHRONO");
      expect(results).toHaveLength(1);
    });

    it("respects limit", () => {
      const results = buildLocalSuggestions(testData, "Final", { limit: 1 });
      expect(results).toHaveLength(1);
    });

    it("returns empty for invalid input", () => {
      expect(buildLocalSuggestions(null, "test")).toEqual([]);
      expect(buildLocalSuggestions(testData, "")).toEqual([]);
    });
  });

  describe("scoreSuggestion", () => {
    it("scores exact match highest", () => {
      const row = { game_name: "chrono trigger" };
      expect(scoreSuggestion(row, "chrono trigger")).toBe(100);
    });

    it("scores prefix match well", () => {
      const row = { game_name: "Final Fantasy VII" };
      const score = scoreSuggestion(row, "Final");
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThan(100);
    });

    it("scores contains match lower", () => {
      const row = { game_name: "The Final Fantasy" };
      const score = scoreSuggestion(row, "Final");
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(80);
    });

    it("returns 0 for no match", () => {
      const row = { game_name: "Chrono Trigger" };
      expect(scoreSuggestion(row, "Zelda")).toBe(0);
    });
  });

  describe("sortSuggestionsByRelevance", () => {
    const suggestions = [
      { game_name: "The Final Stand" },
      { game_name: "Final Fantasy VII" },
      { game_name: "Final" },
    ];

    it("sorts by match quality", () => {
      const sorted = sortSuggestionsByRelevance(suggestions, "Final");
      expect(sorted[0].game_name).toBe("Final"); // exact
      expect(sorted[1].game_name).toBe("Final Fantasy VII"); // prefix
      expect(sorted[2].game_name).toBe("The Final Stand"); // contains
    });

    it("handles empty input", () => {
      expect(sortSuggestionsByRelevance(null, "test")).toEqual([]);
      expect(sortSuggestionsByRelevance([], "test")).toEqual([]);
    });
  });

  describe("resolvePlatformSearchTerms", () => {
    it("returns original platform", () => {
      const terms = resolvePlatformSearchTerms("NES");
      expect(terms).toContain("NES");
    });

    it("includes aliases if available", () => {
      const terms = resolvePlatformSearchTerms("SNES");
      expect(terms).toContain("SNES");
      // Aliases depend on PLATFORM_NAME_ALIASES from pricing.js
    });

    it("returns empty for invalid input", () => {
      expect(resolvePlatformSearchTerms(null)).toEqual([]);
      expect(resolvePlatformSearchTerms("")).toEqual([]);
    });
  });

  describe("highlightMatch", () => {
    it("wraps matching text with mark tag", () => {
      const result = highlightMatch("Final Fantasy VII", "Fantasy");
      expect(result).toBe("Final <mark>Fantasy</mark> VII");
    });

    it("uses custom tag", () => {
      const result = highlightMatch("Chrono Trigger", "Trigger", { tag: "strong" });
      expect(result).toBe("Chrono <strong>Trigger</strong>");
    });

    it("adds class when provided", () => {
      const result = highlightMatch("Test", "Test", { className: "highlight" });
      expect(result).toBe('<mark class="highlight">Test</mark>');
    });

    it("returns original for no match", () => {
      expect(highlightMatch("Chrono", "xyz")).toBe("Chrono");
    });
  });

  describe("splitByMatch", () => {
    it("splits text into match and non-match parts", () => {
      const parts = splitByMatch("Final Fantasy VII", "Fantasy");
      expect(parts).toEqual([
        { text: "Final ", isMatch: false },
        { text: "Fantasy", isMatch: true },
        { text: " VII", isMatch: false },
      ]);
    });

    it("handles no match", () => {
      const parts = splitByMatch("Chrono", "xyz");
      expect(parts).toEqual([{ text: "Chrono", isMatch: false }]);
    });

    it("handles multiple matches", () => {
      const parts = splitByMatch("aXbXc", "X");
      expect(parts).toEqual([
        { text: "a", isMatch: false },
        { text: "X", isMatch: true },
        { text: "b", isMatch: false },
        { text: "X", isMatch: true },
        { text: "c", isMatch: false },
      ]);
    });
  });

  describe("createDebouncer", () => {
    it("creates debouncer with call and cancel", () => {
      const debouncer = createDebouncer(() => {}, 100);
      expect(typeof debouncer.call).toBe("function");
      expect(typeof debouncer.cancel).toBe("function");
    });
  });

  describe("buildTypeaheadSelectColumns", () => {
    it("joins columns with comma", () => {
      const result = buildTypeaheadSelectColumns(["a", "b", "c"]);
      expect(result).toBe("a,b,c");
    });

    it("uses defaults when no args", () => {
      const result = buildTypeaheadSelectColumns();
      expect(result).toBe("game_name,platform,genre,release_year");
    });
  });

  describe("constants", () => {
    it("has expected values", () => {
      expect(TYPEAHEAD_MIN_CHARS).toBe(2);
      expect(TYPEAHEAD_DEBOUNCE_MS).toBe(180);
      expect(TYPEAHEAD_LIMIT).toBe(8);
      expect(TYPEAHEAD_SELECT_COLUMNS).toContain("game_name");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// features/virtualization tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  createVirtualizationState,
  resetVirtualizationState,
  shouldVirtualize,
  estimateColumnCount,
  buildVirtualMetrics,
  computeVirtualRange,
  hasRangeChanged,
  buildSpacerHtml,
  buildSpacers,
  calculateScrollToItem,
  shouldPrefetch,
  calculatePrefetchCount,
  calculateRowHeight,
  calculateTotalHeight,
  VIRTUALIZE_MIN_ITEMS,
  VIRTUAL_DEFAULT_CARD_HEIGHT,
  VIRTUAL_OVERSCAN_ROWS,
  VIRTUAL_SCROLL_THROTTLE_MS,
  VIRTUAL_DEFAULT_CARD_WIDTH,
} from "../app/features/virtualization.js";

describe("features/virtualization", () => {
  describe("createVirtualizationState", () => {
    it("creates fresh state object", () => {
      const state = createVirtualizationState();
      expect(state.enabled).toBe(true);
      expect(state.active).toBe(false);
      expect(state.sourceData).toEqual([]);
      expect(state.visibleStart).toBe(0);
      expect(state.visibleEnd).toBe(0);
      expect(state.columns).toBe(1);
    });
  });

  describe("resetVirtualizationState", () => {
    it("resets state in place", () => {
      const state = createVirtualizationState();
      state.active = true;
      state.visibleStart = 10;
      state.visibleEnd = 50;

      const result = resetVirtualizationState(state);
      expect(result).toBe(state);
      expect(state.active).toBe(false);
      expect(state.visibleStart).toBe(0);
      expect(state.visibleEnd).toBe(0);
    });

    it("creates new state for invalid input", () => {
      const result = resetVirtualizationState(null);
      expect(result.enabled).toBe(true);
    });
  });

  describe("shouldVirtualize", () => {
    it("returns true for large datasets", () => {
      expect(shouldVirtualize(100)).toBe(true);
      expect(shouldVirtualize(VIRTUALIZE_MIN_ITEMS)).toBe(true);
    });

    it("returns false for small datasets", () => {
      expect(shouldVirtualize(50)).toBe(false);
      expect(shouldVirtualize(VIRTUALIZE_MIN_ITEMS - 1)).toBe(false);
    });

    it("respects enabled option", () => {
      expect(shouldVirtualize(100, { enabled: false })).toBe(false);
    });

    it("respects custom minItems", () => {
      expect(shouldVirtualize(50, { minItems: 40 })).toBe(true);
      expect(shouldVirtualize(30, { minItems: 40 })).toBe(false);
    });

    it("returns false for invalid input", () => {
      expect(shouldVirtualize(null)).toBe(false);
      expect(shouldVirtualize(-10)).toBe(false);
    });
  });

  describe("estimateColumnCount", () => {
    it("calculates columns from width", () => {
      expect(estimateColumnCount(800, 260, 16)).toBe(2);
      expect(estimateColumnCount(1200, 260, 16)).toBe(4);
    });

    it("returns minimum of 1", () => {
      expect(estimateColumnCount(100, 260, 0)).toBe(1);
      expect(estimateColumnCount(0, 260, 0)).toBe(1);
    });

    it("handles invalid input", () => {
      expect(estimateColumnCount(null, 260, 0)).toBe(1);
      expect(estimateColumnCount(800, null, 0)).toBe(1);
    });
  });

  describe("buildVirtualMetrics", () => {
    it("uses provided values", () => {
      const metrics = buildVirtualMetrics({ rowHeight: 400, columns: 3, gap: 20 });
      expect(metrics.rowHeight).toBe(400);
      expect(metrics.columns).toBe(3);
      expect(metrics.gap).toBe(20);
    });

    it("uses defaults for missing values", () => {
      const metrics = buildVirtualMetrics({});
      expect(metrics.rowHeight).toBe(VIRTUAL_DEFAULT_CARD_HEIGHT);
      expect(metrics.columns).toBe(1);
      expect(metrics.gap).toBe(0);
    });

    it("estimates columns from container width", () => {
      const metrics = buildVirtualMetrics({ containerWidth: 1200 });
      expect(metrics.columns).toBeGreaterThan(1);
    });
  });

  describe("computeVirtualRange", () => {
    const metrics = { rowHeight: 100, columns: 3, gap: 0 };

    it("computes range for start of list", () => {
      const range = computeVirtualRange({
        dataLength: 100,
        scrollTop: 0,
        containerTop: 0,
        viewportHeight: 500,
        metrics,
      });
      expect(range.start).toBe(0);
      expect(range.end).toBeGreaterThan(0);
      expect(range.topPadding).toBe(0);
    });

    it("computes range for middle of list", () => {
      const range = computeVirtualRange({
        dataLength: 100,
        scrollTop: 1000,
        containerTop: 0,
        viewportHeight: 500,
        metrics,
      });
      expect(range.start).toBeGreaterThan(0);
      expect(range.topPadding).toBeGreaterThan(0);
    });

    it("returns empty range for empty data", () => {
      const range = computeVirtualRange({
        dataLength: 0,
        scrollTop: 0,
        containerTop: 0,
        viewportHeight: 500,
        metrics,
      });
      expect(range.start).toBe(0);
      expect(range.end).toBe(0);
    });
  });

  describe("hasRangeChanged", () => {
    it("detects changes in start", () => {
      expect(hasRangeChanged({ start: 10, end: 50 }, { start: 0, end: 50 })).toBe(true);
    });

    it("detects changes in end", () => {
      expect(hasRangeChanged({ start: 0, end: 60 }, { start: 0, end: 50 })).toBe(true);
    });

    it("returns false for same range", () => {
      expect(hasRangeChanged({ start: 10, end: 50 }, { start: 10, end: 50 })).toBe(false);
    });

    it("returns true for null input", () => {
      expect(hasRangeChanged(null, { start: 0, end: 50 })).toBe(true);
      expect(hasRangeChanged({ start: 0, end: 50 }, null)).toBe(true);
    });
  });

  describe("buildSpacerHtml", () => {
    it("creates spacer div with height", () => {
      const html = buildSpacerHtml(100);
      expect(html).toBe('<div class="virtual-spacer" style="height:100px"></div>');
    });

    it("uses custom class", () => {
      const html = buildSpacerHtml(50, "custom-spacer");
      expect(html).toContain('class="custom-spacer"');
    });

    it("handles zero and negative", () => {
      expect(buildSpacerHtml(0)).toContain("height:0px");
      expect(buildSpacerHtml(-10)).toContain("height:0px");
    });
  });

  describe("buildSpacers", () => {
    it("returns top and bottom spacers", () => {
      const spacers = buildSpacers(100, 200);
      expect(spacers.top).toContain("height:100px");
      expect(spacers.bottom).toContain("height:200px");
    });
  });

  describe("calculateScrollToItem", () => {
    it("returns null if already in view", () => {
      const result = calculateScrollToItem(5, 3, 100, 100, 0, 500);
      expect(result).toBe(null);
    });

    it("calculates scroll for item above viewport", () => {
      const result = calculateScrollToItem(0, 3, 100, 500, 0, 300);
      expect(result).toBeLessThan(500);
    });

    it("returns null for invalid input", () => {
      expect(calculateScrollToItem(-1, 3, 100, 0, 0, 500)).toBe(null);
      expect(calculateScrollToItem(5, 0, 100, 0, 0, 500)).toBe(null);
    });
  });

  describe("shouldPrefetch", () => {
    it("returns true when near end of loaded data", () => {
      expect(shouldPrefetch(85, 100, null)).toBe(true);
    });

    it("returns false when far from end", () => {
      expect(shouldPrefetch(50, 100, null)).toBe(false);
    });

    it("returns false when all data loaded", () => {
      expect(shouldPrefetch(90, 100, 100)).toBe(false);
    });

    it("respects custom threshold", () => {
      expect(shouldPrefetch(50, 100, null, { threshold: 0.5 })).toBe(true);
    });
  });

  describe("calculatePrefetchCount", () => {
    it("returns page size normally", () => {
      expect(calculatePrefetchCount(100, 50)).toBe(50);
    });

    it("limits to remaining when max known", () => {
      expect(calculatePrefetchCount(90, 50, 100)).toBe(10);
    });

    it("returns 0 when at max", () => {
      expect(calculatePrefetchCount(100, 50, 100)).toBe(0);
    });
  });

  describe("calculateRowHeight", () => {
    it("adds card height and gap", () => {
      expect(calculateRowHeight(300, 20)).toBe(320);
    });

    it("uses defaults for invalid input", () => {
      expect(calculateRowHeight(null, 0)).toBe(VIRTUAL_DEFAULT_CARD_HEIGHT);
    });
  });

  describe("calculateTotalHeight", () => {
    it("calculates height for grid", () => {
      expect(calculateTotalHeight(12, 3, 100)).toBe(400); // 4 rows * 100
      expect(calculateTotalHeight(10, 3, 100)).toBe(400); // ceil(10/3) = 4 rows
    });

    it("returns 0 for invalid input", () => {
      expect(calculateTotalHeight(0, 3, 100)).toBe(0);
      expect(calculateTotalHeight(10, 0, 100)).toBe(0);
    });
  });

  describe("constants", () => {
    it("has expected values", () => {
      expect(VIRTUALIZE_MIN_ITEMS).toBe(80);
      expect(VIRTUAL_DEFAULT_CARD_HEIGHT).toBe(360);
      expect(VIRTUAL_OVERSCAN_ROWS).toBe(2);
      expect(VIRTUAL_SCROLL_THROTTLE_MS).toBe(80);
      expect(VIRTUAL_DEFAULT_CARD_WIDTH).toBe(260);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/theme tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  THEME_LIGHT,
  THEME_DARK,
  isValidTheme as isValidThemeUI,
  getPreferredTheme,
  getActiveTheme,
  getOppositeTheme,
  buildThemeToggleAttrs,
  applyThemeChoice,
  persistThemeChoice,
  clearPersistedTheme,
  getCSSVariable,
  setCSSVariable,
  updateThemeToggleButton,
  THEME_STORAGE_KEY,
} from "../app/ui/theme.js";

describe("ui/theme", () => {
  describe("constants", () => {
    it("exports theme values", () => {
      expect(THEME_LIGHT).toBe("light");
      expect(THEME_DARK).toBe("dark");
    });
  });

  describe("isValidTheme", () => {
    it("validates light and dark", () => {
      expect(isValidThemeUI("light")).toBe(true);
      expect(isValidThemeUI("dark")).toBe(true);
    });

    it("rejects invalid themes", () => {
      expect(isValidThemeUI("auto")).toBe(false);
      expect(isValidThemeUI(null)).toBe(false);
      expect(isValidThemeUI("")).toBe(false);
    });
  });

  describe("getPreferredTheme", () => {
    it("returns a valid theme", () => {
      const theme = getPreferredTheme();
      expect([THEME_LIGHT, THEME_DARK]).toContain(theme);
    });
  });

  describe("getActiveTheme", () => {
    it("returns a valid theme", () => {
      const theme = getActiveTheme();
      expect([THEME_LIGHT, THEME_DARK]).toContain(theme);
    });
  });

  describe("getOppositeTheme", () => {
    it("returns opposite theme", () => {
      expect(getOppositeTheme(THEME_LIGHT)).toBe(THEME_DARK);
      expect(getOppositeTheme(THEME_DARK)).toBe(THEME_LIGHT);
    });
  });

  describe("buildThemeToggleAttrs", () => {
    it("builds attrs for light theme", () => {
      const attrs = buildThemeToggleAttrs(THEME_LIGHT);
      expect(attrs.nextTheme).toBe(THEME_DARK);
      expect(attrs.text).toContain("Dark");
      expect(attrs.ariaPressed).toBe("true");
    });

    it("builds attrs for dark theme", () => {
      const attrs = buildThemeToggleAttrs(THEME_DARK);
      expect(attrs.nextTheme).toBe(THEME_LIGHT);
      expect(attrs.text).toContain("Light");
      expect(attrs.ariaPressed).toBe("false");
    });

    it("handles invalid theme", () => {
      const attrs = buildThemeToggleAttrs("invalid");
      // Should fall back to preferred theme logic
      expect([THEME_LIGHT, THEME_DARK]).toContain(attrs.nextTheme);
    });
  });

  describe("applyThemeChoice", () => {
    it("sets theme on documentElement", () => {
      applyThemeChoice(THEME_DARK);
      expect(document.documentElement.dataset.theme).toBe(THEME_DARK);
      applyThemeChoice(THEME_LIGHT);
      expect(document.documentElement.dataset.theme).toBe(THEME_LIGHT);
    });

    it("removes theme for invalid value", () => {
      applyThemeChoice(THEME_LIGHT);
      applyThemeChoice("invalid");
      expect(document.documentElement.dataset.theme).toBeUndefined();
    });
  });

  describe("persistThemeChoice", () => {
    it("stores theme in localStorage", () => {
      persistThemeChoice(THEME_DARK);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(THEME_DARK);
    });
  });

  describe("clearPersistedTheme", () => {
    it("removes theme from localStorage", () => {
      localStorage.setItem(THEME_STORAGE_KEY, THEME_LIGHT);
      clearPersistedTheme();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });
  });

  describe("getCSSVariable", () => {
    it("returns empty string for missing variable", () => {
      const result = getCSSVariable("--nonexistent-var");
      expect(result).toBe("");
    });

    it("adds -- prefix if missing", () => {
      // Should not throw
      expect(() => getCSSVariable("test-var")).not.toThrow();
    });
  });

  describe("setCSSVariable", () => {
    it("sets CSS variable on element", () => {
      const el = document.createElement("div");
      setCSSVariable("--test-color", "red", el);
      expect(el.style.getPropertyValue("--test-color")).toBe("red");
    });

    it("adds -- prefix if missing", () => {
      const el = document.createElement("div");
      setCSSVariable("test-spacing", "10px", el);
      expect(el.style.getPropertyValue("--test-spacing")).toBe("10px");
    });
  });

  describe("updateThemeToggleButton", () => {
    it("updates button attributes", () => {
      const button = document.createElement("button");
      updateThemeToggleButton(button, THEME_LIGHT);
      expect(button.textContent).toContain("Dark");
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(button.dataset.nextTheme).toBe(THEME_DARK);
    });

    it("handles null button gracefully", () => {
      expect(() => updateThemeToggleButton(null, THEME_LIGHT)).not.toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/modal tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  buildMetadataCard,
  buildFallbackMetadata,
  markFieldConsumed,
  calculateGalleryIndex,
  nextGalleryIndex,
  prevGalleryIndex,
  buildGalleryCounter,
  buildModalAriaAttrs,
  buildCloseButtonAttrs,
  buildModalStatusButtons,
  buildGameDetailsHtml,
} from "../app/ui/modal.js";

describe("ui/modal", () => {
  describe("buildMetadataCard", () => {
    it("builds card with title and items", () => {
      const html = buildMetadataCard("Test Title", [
        { label: "Label 1", value: "Value 1" },
        { label: "Label 2", value: "Value 2" },
      ]);
      expect(html).toContain("Test Title");
      expect(html).toContain("Label 1");
      expect(html).toContain("Value 1");
      expect(html).toContain("modal-section");
    });

    it("uses grid layout by default", () => {
      const html = buildMetadataCard("Title", [{ label: "L", value: "V" }]);
      expect(html).toContain("metadata-grid");
    });

    it("uses stacked layout when specified", () => {
      const html = buildMetadataCard("Title", [{ label: "L", value: "V" }], {
        layout: "stacked",
      });
      expect(html).toContain("metadata-list");
    });

    it("returns empty for no items and no footer", () => {
      expect(buildMetadataCard("Title", [])).toBe("");
    });

    it("escapes HTML in values", () => {
      const html = buildMetadataCard("Title", [{ label: "<script>", value: "&test" }]);
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&amp;test");
    });
  });

  describe("buildFallbackMetadata", () => {
    it("builds metadata for unconsumed fields", () => {
      const game = { field1: "value1", field2: "value2", consumed: "skip" };
      const consumed = new Set(["consumed"]);
      const html = buildFallbackMetadata(game, consumed);
      expect(html).toContain("value1");
      expect(html).toContain("value2");
      expect(html).not.toContain("skip");
    });

    it("skips null and empty values", () => {
      const game = { field1: "value1", field2: null, field3: "" };
      const html = buildFallbackMetadata(game, new Set());
      expect(html).toContain("value1");
      expect(html).not.toContain("field2");
    });

    it("returns empty for null game", () => {
      expect(buildFallbackMetadata(null, new Set())).toBe("");
    });
  });

  describe("markFieldConsumed", () => {
    it("adds field to set", () => {
      const consumed = new Set();
      markFieldConsumed(consumed, "test");
      expect(consumed.has("test")).toBe(true);
    });

    it("handles non-set input", () => {
      expect(() => markFieldConsumed(null, "test")).not.toThrow();
    });
  });

  describe("calculateGalleryIndex", () => {
    it("wraps positive overflow", () => {
      expect(calculateGalleryIndex(5, 3)).toBe(2);
      expect(calculateGalleryIndex(6, 3)).toBe(0);
    });

    it("wraps negative indices", () => {
      expect(calculateGalleryIndex(-1, 3)).toBe(2);
      expect(calculateGalleryIndex(-4, 3)).toBe(2);
    });

    it("returns 0 for invalid input", () => {
      expect(calculateGalleryIndex(0, 0)).toBe(0);
      expect(calculateGalleryIndex(null, 5)).toBe(0);
    });
  });

  describe("nextGalleryIndex", () => {
    it("increments and wraps", () => {
      expect(nextGalleryIndex(0, 5)).toBe(1);
      expect(nextGalleryIndex(4, 5)).toBe(0);
    });
  });

  describe("prevGalleryIndex", () => {
    it("decrements and wraps", () => {
      expect(prevGalleryIndex(1, 5)).toBe(0);
      expect(prevGalleryIndex(0, 5)).toBe(4);
    });
  });

  describe("buildGalleryCounter", () => {
    it("builds counter text", () => {
      expect(buildGalleryCounter(0, 5)).toBe("1 / 5");
      expect(buildGalleryCounter(4, 5)).toBe("5 / 5");
    });

    it("handles wrapping", () => {
      expect(buildGalleryCounter(5, 5)).toBe("1 / 5");
    });

    it("returns 0/0 for invalid input", () => {
      expect(buildGalleryCounter(0, 0)).toBe("0 / 0");
    });
  });

  describe("buildModalAriaAttrs", () => {
    it("builds basic modal attrs", () => {
      const attrs = buildModalAriaAttrs({ isOpen: true });
      expect(attrs.role).toBe("dialog");
      expect(attrs["aria-modal"]).toBe("true");
      expect(attrs["aria-hidden"]).toBe("false");
    });

    it("includes labelledBy and describedBy", () => {
      const attrs = buildModalAriaAttrs({ labelledBy: "title", describedBy: "desc" });
      expect(attrs["aria-labelledby"]).toBe("title");
      expect(attrs["aria-describedby"]).toBe("desc");
    });
  });

  describe("buildCloseButtonAttrs", () => {
    it("builds close button attrs", () => {
      const attrs = buildCloseButtonAttrs();
      expect(attrs.type).toBe("button");
      expect(attrs["aria-label"]).toBe("Close modal");
    });

    it("uses custom label", () => {
      const attrs = buildCloseButtonAttrs("Dismiss");
      expect(attrs["aria-label"]).toBe("Dismiss");
    });
  });

  describe("buildModalStatusButtons", () => {
    it("builds all four status buttons", () => {
      const html = buildModalStatusButtons("Game___Platform", null);
      expect(html).toContain("Own It");
      expect(html).toContain("Wishlist");
      expect(html).toContain("Backlog");
      expect(html).toContain("For Trade");
      expect(html).toContain('data-action="owned"');
      expect(html).toContain('data-action="wishlist"');
      expect(html).toContain('data-action="backlog"');
      expect(html).toContain('data-action="trade"');
    });

    it("marks current status as active", () => {
      const html = buildModalStatusButtons("Game___Platform", "owned");
      expect(html).toContain('class="modal-status-btn owned"');
    });

    it("escapes game key", () => {
      const html = buildModalStatusButtons("Game<script>___Platform", null);
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("buildGameDetailsHtml", () => {
    it("builds details with platform, rating, year", () => {
      const game = {
        game_name: "Test Game",
        platform: "SNES",
        release_year: 1995,
        rating: "9.5",
      };
      const html = buildGameDetailsHtml(game);
      expect(html).toContain("SNES");
      expect(html).toContain("1995");
      expect(html).toContain("9.5");
    });

    it("includes genre section", () => {
      const game = { game_name: "Test", genre: "RPG, Action" };
      const html = buildGameDetailsHtml(game);
      expect(html).toContain("RPG, Action");
      expect(html).toContain("Genre");
    });

    it("includes external links", () => {
      const game = { game_name: "Chrono Trigger", platform: "SNES" };
      const html = buildGameDetailsHtml(game);
      expect(html).toContain("Google");
      expect(html).toContain("YouTube");
      expect(html).toContain("GameFAQs");
    });

    it("includes developer and publisher", () => {
      const game = { game_name: "Test", developer: "Square", publisher: "Nintendo" };
      const html = buildGameDetailsHtml(game);
      expect(html).toContain("Square");
      expect(html).toContain("Nintendo");
      expect(html).toContain("Release Info");
    });

    it("returns empty for null game", () => {
      expect(buildGameDetailsHtml(null)).toBe("");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/filters tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  extractUniquePlatforms,
  extractUniqueGenres,
  extractUniqueValues,
  buildSelectOptions,
  buildPlatformDropdown,
  buildGenreDropdown,
  buildRegionButton,
  buildRegionToggle,
  buildFilterSummary,
  countActiveFilters,
  buildSortDropdown,
  hasActiveFilters,
  REGION_OPTIONS,
  SORT_OPTIONS as UI_SORT_OPTIONS,
} from "../app/ui/filters.js";

describe("ui/filters", () => {
  describe("extractUniquePlatforms", () => {
    it("extracts unique platforms", () => {
      const data = [{ platform: "SNES" }, { platform: "NES" }, { platform: "SNES" }];
      const result = extractUniquePlatforms(data);
      expect(result).toEqual(["NES", "SNES"]);
    });

    it("returns empty for invalid data", () => {
      expect(extractUniquePlatforms(null)).toEqual([]);
      expect(extractUniquePlatforms([])).toEqual([]);
    });
  });

  describe("extractUniqueGenres", () => {
    it("extracts and splits genres", () => {
      const data = [{ genre: "RPG, Action" }, { genre: "RPG" }, { genre: "Puzzle" }];
      const result = extractUniqueGenres(data);
      expect(result).toEqual(["Action", "Puzzle", "RPG"]);
    });

    it("handles empty genres", () => {
      const data = [{ genre: "" }, { genre: null }];
      expect(extractUniqueGenres(data)).toEqual([]);
    });
  });

  describe("extractUniqueValues", () => {
    it("extracts unique values for any field", () => {
      const data = [{ year: 1990 }, { year: 1995 }, { year: 1990 }];
      const result = extractUniqueValues(data, "year");
      expect(result).toEqual(["1990", "1995"]);
    });
  });

  describe("buildSelectOptions", () => {
    it("builds option HTML", () => {
      const html = buildSelectOptions(["A", "B"]);
      expect(html).toContain("<option");
      expect(html).toContain("A");
      expect(html).toContain("B");
    });

    it("includes all option when specified", () => {
      const html = buildSelectOptions(["A"], { allLabel: "All Items" });
      expect(html).toContain("All Items");
      expect(html).toContain('value=""');
    });

    it("marks selected option", () => {
      const html = buildSelectOptions(["A", "B"], { selected: "B" });
      expect(html).toContain('value="B" selected');
    });
  });

  describe("buildPlatformDropdown", () => {
    it("builds platform dropdown with All option", () => {
      const html = buildPlatformDropdown(["SNES", "NES"]);
      expect(html).toContain("All Platforms");
      expect(html).toContain("SNES");
    });
  });

  describe("buildGenreDropdown", () => {
    it("builds genre dropdown with All option", () => {
      const html = buildGenreDropdown(["RPG", "Action"]);
      expect(html).toContain("All Genres");
      expect(html).toContain("RPG");
    });
  });

  describe("buildRegionButton", () => {
    it("builds region button", () => {
      const html = buildRegionButton("NTSC", "NTSC", false);
      expect(html).toContain('data-region-option="NTSC"');
      expect(html).toContain('aria-pressed="false"');
    });

    it("marks active button", () => {
      const html = buildRegionButton("PAL", "PAL", true);
      expect(html).toContain("is-active");
      expect(html).toContain('aria-pressed="true"');
    });
  });

  describe("buildRegionToggle", () => {
    it("builds all region buttons", () => {
      const html = buildRegionToggle("NTSC");
      expect(html).toContain("All Regions");
      expect(html).toContain("NTSC");
      expect(html).toContain("PAL");
      expect(html).toContain("JPN");
    });
  });

  describe("buildFilterSummary", () => {
    it("builds summary from filters", () => {
      const summary = buildFilterSummary({ platform: "SNES", genre: "RPG" });
      expect(summary).toContain("Platform: SNES");
      expect(summary).toContain("Genre: RPG");
    });

    it("returns default for no filters", () => {
      expect(buildFilterSummary({})).toBe("No filters applied");
    });
  });

  describe("countActiveFilters", () => {
    it("counts active filters", () => {
      expect(countActiveFilters({ platform: "SNES" })).toBe(1);
      expect(countActiveFilters({ platform: "SNES", genre: "RPG" })).toBe(2);
    });

    it("returns 0 for empty", () => {
      expect(countActiveFilters({})).toBe(0);
      expect(countActiveFilters(null)).toBe(0);
    });
  });

  describe("buildSortDropdown", () => {
    it("builds sort options", () => {
      const html = buildSortDropdown();
      expect(html).toContain("Name (A–Z)");
      expect(html).toContain("Rating (High–Low)");
    });

    it("marks selected sort", () => {
      const html = buildSortDropdown("rating-desc");
      expect(html).toContain('value="rating-desc" selected');
    });
  });

  describe("hasActiveFilters", () => {
    it("returns true when filters active", () => {
      expect(hasActiveFilters({ platform: "SNES" })).toBe(true);
    });

    it("returns false when no filters", () => {
      expect(hasActiveFilters({})).toBe(false);
    });
  });

  describe("constants", () => {
    it("has region options", () => {
      expect(REGION_OPTIONS.length).toBe(4);
      expect(REGION_OPTIONS[0].value).toBe("");
    });

    it("has sort options", () => {
      expect(UI_SORT_OPTIONS.length).toBe(6);
      expect(UI_SORT_OPTIONS[0].value).toBe("name-asc");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/carousel tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  calculateScrollStep,
  calculateMaxScroll,
  computeButtonStates,
  calculateNewScrollPosition,
  rankByRating,
  rankByYear,
  selectTrendingPicks,
  buildTrendingCard,
  buildEmptyTrendingMessage,
  buildTrendingList,
  buildCarouselButtonAttrs,
  buildCarouselContainerAttrs,
  DEFAULT_SCROLL_PERCENT,
  MIN_SCROLL_STEP,
} from "../app/ui/carousel.js";

describe("ui/carousel", () => {
  describe("calculateScrollStep", () => {
    it("calculates step from container width", () => {
      expect(calculateScrollStep(1000)).toBe(850);
      expect(calculateScrollStep(500)).toBe(425);
    });

    it("uses custom step if provided", () => {
      expect(calculateScrollStep(1000, 300)).toBe(300);
    });

    it("returns minimum for zero or negative width", () => {
      expect(calculateScrollStep(0)).toBe(MIN_SCROLL_STEP);
      expect(calculateScrollStep(-100)).toBe(MIN_SCROLL_STEP);
    });

    it("uses custom percent", () => {
      expect(calculateScrollStep(1000, undefined, 0.5)).toBe(500);
    });
  });

  describe("calculateMaxScroll", () => {
    it("calculates max scroll position", () => {
      expect(calculateMaxScroll(1000, 500)).toBe(500);
      expect(calculateMaxScroll(500, 500)).toBe(0);
    });

    it("returns 0 if client is wider", () => {
      expect(calculateMaxScroll(300, 500)).toBe(0);
    });
  });

  describe("computeButtonStates", () => {
    it("disables prev at start", () => {
      const result = computeButtonStates(0, 1000, 500);
      expect(result.prevDisabled).toBe(true);
      expect(result.nextDisabled).toBe(false);
    });

    it("disables next at end", () => {
      const result = computeButtonStates(500, 1000, 500);
      expect(result.prevDisabled).toBe(false);
      expect(result.nextDisabled).toBe(true);
    });

    it("enables both in middle", () => {
      const result = computeButtonStates(250, 1000, 500);
      expect(result.prevDisabled).toBe(false);
      expect(result.nextDisabled).toBe(false);
    });

    it("handles threshold", () => {
      const result = computeButtonStates(1, 1000, 500, 2);
      expect(result.prevDisabled).toBe(true);
    });
  });

  describe("calculateNewScrollPosition", () => {
    it("calculates next position", () => {
      expect(calculateNewScrollPosition(100, 50, "next")).toBe(150);
    });

    it("calculates prev position", () => {
      expect(calculateNewScrollPosition(100, 50, "prev")).toBe(50);
    });
  });

  describe("rankByRating", () => {
    it("ranks by rating descending", () => {
      const data = [
        { game_name: "A", rating: 7 },
        { game_name: "B", rating: 9 },
        { game_name: "C", rating: 8 },
      ];
      const result = rankByRating(data);
      expect(result[0].row.game_name).toBe("B");
      expect(result[1].row.game_name).toBe("C");
      expect(result[2].row.game_name).toBe("A");
    });

    it("breaks ties by name", () => {
      const data = [
        { game_name: "Zelda", rating: 9 },
        { game_name: "Chrono", rating: 9 },
      ];
      const result = rankByRating(data);
      expect(result[0].row.game_name).toBe("Chrono");
    });

    it("filters out invalid ratings", () => {
      const data = [
        { game_name: "A", rating: "n/a" },
        { game_name: "B", rating: 8 },
      ];
      const result = rankByRating(data);
      expect(result.length).toBe(1);
      expect(result[0].row.game_name).toBe("B");
    });

    it("returns empty for invalid input", () => {
      expect(rankByRating(null)).toEqual([]);
      expect(rankByRating(undefined)).toEqual([]);
    });
  });

  describe("rankByYear", () => {
    it("ranks by year descending", () => {
      const data = [
        { release_year: 1990 },
        { release_year: 2020 },
        { release_year: 2005 },
      ];
      const result = rankByYear(data);
      expect(result[0].row.release_year).toBe(2020);
      expect(result[1].row.release_year).toBe(2005);
    });

    it("handles string years", () => {
      const data = [{ release_year: "1995" }];
      const result = rankByYear(data);
      expect(result[0].value).toBe(1995);
    });

    it("pushes invalid years to end", () => {
      const data = [{ release_year: null }, { release_year: 2000 }];
      const result = rankByYear(data);
      expect(result[0].row.release_year).toBe(2000);
    });
  });

  describe("selectTrendingPicks", () => {
    const games = [
      { game_name: "TopRated", platform: "SNES", rating: 10, release_year: 1990 },
      { game_name: "Recent", platform: "PS5", rating: 7, release_year: 2023 },
      { game_name: "Average", platform: "NES", rating: 5, release_year: 1985 },
      { game_name: "NoRating", platform: "GB", release_year: 1995 },
    ];

    it("includes top rated and recent", () => {
      const picks = selectTrendingPicks(games, {
        topRated: 1,
        mostRecent: 1,
        minPicks: 2,
      });
      const names = picks.map((p) => p.game_name);
      expect(names).toContain("TopRated");
      expect(names).toContain("Recent");
    });

    it("deduplicates picks", () => {
      const picks = selectTrendingPicks(games, {
        topRated: 4,
        mostRecent: 4,
        minPicks: 4,
      });
      const keys = picks.map((p) => `${p.game_name}___${p.platform}`);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });

    it("fills to minimum", () => {
      const picks = selectTrendingPicks(games, {
        topRated: 1,
        mostRecent: 1,
        minPicks: 4,
      });
      expect(picks.length).toBe(4);
    });

    it("returns empty for empty data", () => {
      expect(selectTrendingPicks([])).toEqual([]);
      expect(selectTrendingPicks(null)).toEqual([]);
    });
  });

  describe("buildTrendingCard", () => {
    it("builds card HTML", () => {
      const row = {
        game_name: "Chrono Trigger",
        platform: "SNES",
        rating: 9.5,
        release_year: 1995,
        genre: "RPG, Adventure",
      };
      const html = buildTrendingCard(row);
      expect(html).toContain("Chrono Trigger");
      expect(html).toContain("SNES");
      expect(html).toContain("9.5");
      expect(html).toContain("1995");
      expect(html).toContain("RPG");
      expect(html).toContain('class="trending-card"');
    });

    it("handles missing fields", () => {
      const html = buildTrendingCard({});
      expect(html).toContain("Untitled");
      expect(html).toContain("Unknown platform");
      expect(html).toContain("NR");
    });

    it("escapes HTML", () => {
      const row = { game_name: "<script>alert(1)</script>" };
      const html = buildTrendingCard(row);
      expect(html).not.toContain("<script>");
    });
  });

  describe("buildEmptyTrendingMessage", () => {
    it("returns empty state HTML", () => {
      const html = buildEmptyTrendingMessage();
      expect(html).toContain("trending-empty");
      expect(html).toContain("Trending picks will appear");
    });
  });

  describe("buildTrendingList", () => {
    it("builds list from picks", () => {
      const picks = [
        { game_name: "A", platform: "SNES", rating: 9 },
        { game_name: "B", platform: "NES", rating: 8 },
      ];
      const html = buildTrendingList(picks);
      expect(html).toContain("A");
      expect(html).toContain("B");
    });

    it("returns empty message for empty array", () => {
      const html = buildTrendingList([]);
      expect(html).toContain("trending-empty");
    });
  });

  describe("buildCarouselButtonAttrs", () => {
    it("builds prev button attrs", () => {
      const attrs = buildCarouselButtonAttrs("prev", "myCarousel");
      expect(attrs["data-direction"]).toBe("prev");
      expect(attrs["data-carousel-target"]).toBe("myCarousel");
      expect(attrs["aria-label"]).toBe("Previous items");
    });

    it("builds next button attrs", () => {
      const attrs = buildCarouselButtonAttrs("next", "myCarousel");
      expect(attrs["data-direction"]).toBe("next");
      expect(attrs["aria-label"]).toBe("Next items");
    });

    it("sets disabled attribute", () => {
      const attrs = buildCarouselButtonAttrs("prev", "myCarousel", true);
      expect(attrs.disabled).toBe("true");
    });
  });

  describe("buildCarouselContainerAttrs", () => {
    it("builds container attrs", () => {
      const attrs = buildCarouselContainerAttrs("myCarousel", "Featured Games");
      expect(attrs.id).toBe("myCarousel");
      expect(attrs.role).toBe("list");
      expect(attrs["aria-label"]).toBe("Featured Games");
    });
  });

  describe("constants", () => {
    it("has scroll constants", () => {
      expect(DEFAULT_SCROLL_PERCENT).toBe(0.85);
      expect(MIN_SCROLL_STEP).toBe(220);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/theme motion preference tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  prefersReducedMotion,
  getScrollBehavior,
  getAnimationDelay,
} from "../app/ui/theme.js";

describe("ui/theme motion preferences", () => {
  describe("prefersReducedMotion", () => {
    it("returns boolean", () => {
      const result = prefersReducedMotion();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getScrollBehavior", () => {
    it("returns valid scroll behavior", () => {
      const result = getScrollBehavior();
      expect(["auto", "smooth"]).toContain(result);
    });
  });

  describe("getAnimationDelay", () => {
    it("returns number", () => {
      const result = getAnimationDelay(300);
      expect(typeof result).toBe("number");
    });

    it("returns 0 or provided value", () => {
      const result = getAnimationDelay(500);
      expect([0, 500]).toContain(result);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/grid tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  normalizeCoverUrl,
  resolveScreenshotCover,
  resolveCoverUrl,
  getGameStatusFromMaps,
  getStatusClass,
  getStatusLabel,
  generatePlaceholderText,
  buildPlaceholderMarkup,
  buildCoverMarkup,
  buildStatusBadge,
  buildEmptyGridMarkup,
  buildSkeletonCards,
  calculateStaggerDelay,
  shouldBeFeatured,
  buildQuickActionButton,
  buildQuickActionsMarkup,
  STATUS_CLASSES,
  STATUS_DISPLAY_LABELS,
} from "../app/ui/grid.js";

describe("ui/grid", () => {
  describe("normalizeCoverUrl", () => {
    it("normalizes string URLs", () => {
      expect(normalizeCoverUrl("https://example.com/cover.jpg")).toBe(
        "https://example.com/cover.jpg"
      );
      expect(normalizeCoverUrl("http://example.com/cover.jpg")).toBe(
        "http://example.com/cover.jpg"
      );
    });

    it("trims whitespace", () => {
      expect(normalizeCoverUrl("  https://example.com/cover.jpg  ")).toBe(
        "https://example.com/cover.jpg"
      );
    });

    it("returns empty for invalid URLs", () => {
      expect(normalizeCoverUrl("not-a-url")).toBe("");
      expect(normalizeCoverUrl("")).toBe("");
      expect(normalizeCoverUrl(null)).toBe("");
    });

    it("extracts URL from objects", () => {
      expect(normalizeCoverUrl({ url: "https://example.com/a.jpg" })).toBe(
        "https://example.com/a.jpg"
      );
      expect(normalizeCoverUrl({ href: "https://example.com/b.jpg" })).toBe(
        "https://example.com/b.jpg"
      );
      expect(normalizeCoverUrl({ source: "https://example.com/c.jpg" })).toBe(
        "https://example.com/c.jpg"
      );
    });
  });

  describe("resolveScreenshotCover", () => {
    it("returns first valid screenshot", () => {
      const row = { screenshots: ["https://example.com/ss1.jpg"] };
      expect(resolveScreenshotCover(row)).toBe("https://example.com/ss1.jpg");
    });

    it("skips invalid screenshots", () => {
      const row = { screenshots: ["invalid", "https://example.com/ss2.jpg"] };
      expect(resolveScreenshotCover(row)).toBe("https://example.com/ss2.jpg");
    });

    it("returns empty for no screenshots", () => {
      expect(resolveScreenshotCover({})).toBe("");
      expect(resolveScreenshotCover(null)).toBe("");
    });
  });

  describe("resolveCoverUrl", () => {
    it("uses cover field first", () => {
      const row = {
        cover: "https://example.com/cover.jpg",
        screenshots: ["https://example.com/ss.jpg"],
      };
      expect(resolveCoverUrl(row)).toBe("https://example.com/cover.jpg");
    });

    it("falls back to screenshot", () => {
      const row = { screenshots: ["https://example.com/ss.jpg"] };
      expect(resolveCoverUrl(row)).toBe("https://example.com/ss.jpg");
    });

    it("returns empty if no cover source", () => {
      expect(resolveCoverUrl({})).toBe("");
    });
  });

  describe("getGameStatusFromMaps", () => {
    it("detects owned status", () => {
      const owned = { key1: true };
      expect(getGameStatusFromMaps("key1", owned)).toBe("owned");
    });

    it("detects wishlist status", () => {
      const statuses = { wishlist: { key2: true } };
      expect(getGameStatusFromMaps("key2", {}, statuses)).toBe("wishlist");
    });

    it("detects backlog status", () => {
      const statuses = { backlog: { key3: true } };
      expect(getGameStatusFromMaps("key3", {}, statuses)).toBe("backlog");
    });

    it("detects trade status", () => {
      const statuses = { trade: { key4: true } };
      expect(getGameStatusFromMaps("key4", {}, statuses)).toBe("trade");
    });

    it("returns null for no status", () => {
      expect(getGameStatusFromMaps("unknown", {}, {})).toBe(null);
    });

    it("returns null for empty key", () => {
      expect(getGameStatusFromMaps("", { "": true })).toBe(null);
    });
  });

  describe("getStatusClass", () => {
    it("returns class for valid status", () => {
      expect(getStatusClass("owned")).toBe(STATUS_CLASSES.owned);
      expect(getStatusClass("wishlist")).toBe(STATUS_CLASSES.wishlist);
    });

    it("returns empty for invalid status", () => {
      expect(getStatusClass(null)).toBe("");
      expect(getStatusClass("unknown")).toBe("");
    });
  });

  describe("getStatusLabel", () => {
    it("returns label for valid status", () => {
      expect(getStatusLabel("owned")).toBe("Owned");
      expect(getStatusLabel("wishlist")).toBe("Wishlist");
      expect(getStatusLabel("trade")).toBe("For Trade");
    });

    it("returns empty for invalid status", () => {
      expect(getStatusLabel(null)).toBe("");
    });
  });

  describe("generatePlaceholderText", () => {
    it("extracts first 2 chars", () => {
      expect(generatePlaceholderText("Chrono Trigger")).toBe("CH");
      expect(generatePlaceholderText("A")).toBe("A");
    });

    it("handles empty name", () => {
      expect(generatePlaceholderText("")).toBe("?");
      expect(generatePlaceholderText(null)).toBe("?");
    });
  });

  describe("buildPlaceholderMarkup", () => {
    it("builds placeholder HTML", () => {
      const html = buildPlaceholderMarkup("Zelda");
      expect(html).toContain("card-placeholder");
      expect(html).toContain("ZE");
    });

    it("escapes HTML", () => {
      const html = buildPlaceholderMarkup("<script>");
      expect(html).not.toContain("<script>");
    });
  });

  describe("buildCoverMarkup", () => {
    it("builds img tag", () => {
      const html = buildCoverMarkup("https://example.com/cover.jpg", "Game cover");
      expect(html).toContain('src="https://example.com/cover.jpg"');
      expect(html).toContain('alt="Game cover"');
      expect(html).toContain('loading="lazy"');
    });

    it("escapes HTML in URL and alt", () => {
      const html = buildCoverMarkup(
        "https://x.com/a.jpg?a=1&b=2",
        "<script>alert</script>"
      );
      expect(html).not.toContain("<script>");
    });
  });

  describe("buildStatusBadge", () => {
    it("builds badge for valid status", () => {
      const html = buildStatusBadge("owned");
      expect(html).toContain("game-card-status");
      expect(html).toContain("Owned");
    });

    it("returns empty for null status", () => {
      expect(buildStatusBadge(null)).toBe("");
    });

    it("returns empty for unknown status", () => {
      expect(buildStatusBadge("unknown")).toBe("");
    });
  });

  describe("buildEmptyGridMarkup", () => {
    it("builds empty state HTML", () => {
      const html = buildEmptyGridMarkup();
      expect(html).toContain("game-grid-empty");
      expect(html).toContain("No Games Found");
    });

    it("uses custom options", () => {
      const html = buildEmptyGridMarkup({ title: "Custom Title", icon: "🕹️" });
      expect(html).toContain("Custom Title");
      expect(html).toContain("🕹️");
    });
  });

  describe("buildSkeletonCards", () => {
    it("builds skeleton HTML", () => {
      const html = buildSkeletonCards(3);
      const matches = html.match(/game-card-skeleton/g);
      expect(matches).toHaveLength(3);
    });

    it("defaults to 1", () => {
      const html = buildSkeletonCards();
      const matches = html.match(/game-card-skeleton/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe("calculateStaggerDelay", () => {
    it("calculates delay based on index", () => {
      expect(calculateStaggerDelay(0)).toBe(0);
      expect(calculateStaggerDelay(5)).toBe(250);
    });

    it("respects max delay", () => {
      expect(calculateStaggerDelay(20, 50, 500)).toBe(500);
    });

    it("uses custom base delay", () => {
      expect(calculateStaggerDelay(2, 100)).toBe(200);
    });
  });

  describe("shouldBeFeatured", () => {
    it("features high-rated games at modulo index", () => {
      const game = { rating: 9.5 };
      expect(shouldBeFeatured(game, 0, null)).toBe(true);
      expect(shouldBeFeatured(game, 7, null)).toBe(true);
      expect(shouldBeFeatured(game, 3, null)).toBe(false);
    });

    it("features owned games at modulo index", () => {
      const game = { rating: 5 };
      expect(shouldBeFeatured(game, 0, "owned")).toBe(true);
      expect(shouldBeFeatured(game, 14, "owned")).toBe(true);
    });

    it("does not feature low-rated non-owned games", () => {
      const game = { rating: 5 };
      expect(shouldBeFeatured(game, 0, null)).toBe(false);
    });

    it("uses custom thresholds", () => {
      const game = { rating: 8.5 };
      expect(shouldBeFeatured(game, 0, null, { ratingThreshold: 8.0 })).toBe(true);
    });
  });

  describe("buildQuickActionButton", () => {
    it("builds button HTML", () => {
      const html = buildQuickActionButton("own", "game___SNES", "Own It");
      expect(html).toContain('data-action="own"');
      expect(html).toContain('data-game-key="game___SNES"');
      expect(html).toContain("Own It");
    });

    it("escapes HTML", () => {
      const html = buildQuickActionButton("<script>", "key", "label");
      expect(html).not.toContain("<script>");
    });
  });

  describe("buildQuickActionsMarkup", () => {
    it("includes Own for non-owned", () => {
      const html = buildQuickActionsMarkup("key", null);
      expect(html).toContain('data-action="own"');
      expect(html).toContain('data-action="wishlist"');
    });

    it("excludes Own for owned", () => {
      const html = buildQuickActionsMarkup("key", "owned");
      expect(html).not.toContain('data-action="own"');
      expect(html).toContain('data-action="wishlist"');
    });

    it("excludes Want for wishlist", () => {
      const html = buildQuickActionsMarkup("key", "wishlist");
      expect(html).toContain('data-action="own"');
      expect(html).not.toContain('data-action="wishlist"');
    });
  });

  describe("constants", () => {
    it("has status classes", () => {
      expect(STATUS_CLASSES.owned).toBeDefined();
      expect(STATUS_CLASSES.wishlist).toBeDefined();
    });

    it("has status labels", () => {
      expect(STATUS_DISPLAY_LABELS.owned).toBe("Owned");
      expect(STATUS_DISPLAY_LABELS.trade).toBe("For Trade");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ui/dashboard tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  calculateAverageRating,
  countPlatforms,
  calculatePlatformBreakdown,
  getTopPlatforms,
  formatTopPlatformsDisplay,
  calculateCompletionPercentage,
  computeStatusCounts,
  calculateBarWidth,
  formatStatusSummary,
  buildStatValue,
  buildTrendIndicator,
  buildProgressBar,
  buildCarouselCover,
  buildRecentAdditionsCarousel,
} from "../app/ui/dashboard.js";

describe("ui/dashboard", () => {
  describe("calculateAverageRating", () => {
    it("calculates average from ratings", () => {
      const data = [{ rating: 8 }, { rating: 9 }, { rating: 10 }];
      const result = calculateAverageRating(data);
      expect(result.average).toBe(9);
      expect(result.count).toBe(3);
    });

    it("ignores non-numeric ratings", () => {
      const data = [{ rating: 8 }, { rating: "N/A" }, { rating: 10 }];
      const result = calculateAverageRating(data);
      expect(result.average).toBe(9);
      expect(result.count).toBe(2);
    });

    it("returns null average for empty data", () => {
      expect(calculateAverageRating([]).average).toBe(null);
      expect(calculateAverageRating(null).average).toBe(null);
    });

    it("uses custom field name", () => {
      const data = [{ score: 7 }, { score: 9 }];
      const result = calculateAverageRating(data, "score");
      expect(result.average).toBe(8);
    });
  });

  describe("countPlatforms", () => {
    it("counts unique platforms", () => {
      const data = [{ platform: "SNES" }, { platform: "NES" }, { platform: "SNES" }];
      const result = countPlatforms(data);
      expect(result.count).toBe(2);
      expect(result.platforms).toContain("SNES");
      expect(result.platforms).toContain("NES");
    });

    it("filters out empty platforms", () => {
      const data = [{ platform: "SNES" }, { platform: "" }, { platform: null }];
      const result = countPlatforms(data);
      expect(result.count).toBe(1);
    });

    it("returns empty for invalid input", () => {
      expect(countPlatforms(null).count).toBe(0);
    });
  });

  describe("calculatePlatformBreakdown", () => {
    it("counts games per platform", () => {
      const games = [{ platform: "SNES" }, { platform: "SNES" }, { platform: "NES" }];
      const result = calculatePlatformBreakdown(games);
      expect(result.SNES).toBe(2);
      expect(result.NES).toBe(1);
    });

    it("handles empty array", () => {
      expect(calculatePlatformBreakdown([])).toEqual({});
    });
  });

  describe("getTopPlatforms", () => {
    it("returns top N platforms", () => {
      const breakdown = { SNES: 10, NES: 5, GB: 3 };
      const result = getTopPlatforms(breakdown, 2);
      expect(result.length).toBe(2);
      expect(result[0].platform).toBe("SNES");
      expect(result[0].count).toBe(10);
      expect(result[0].percentage).toBe(56); // 10/(10+5+3) ≈ 56%
    });

    it("returns empty for invalid input", () => {
      expect(getTopPlatforms(null)).toEqual([]);
      expect(getTopPlatforms({})).toEqual([]);
    });
  });

  describe("formatTopPlatformsDisplay", () => {
    it("formats platforms with percentages", () => {
      const breakdown = { SNES: 10, NES: 5 };
      const result = formatTopPlatformsDisplay(breakdown, 2);
      expect(result).toContain("SNES");
      expect(result).toContain("%");
    });

    it("returns placeholder for empty breakdown", () => {
      expect(formatTopPlatformsDisplay({})).toBe("No games yet");
    });
  });

  describe("calculateCompletionPercentage", () => {
    it("calculates percentage", () => {
      expect(calculateCompletionPercentage(50, 100)).toBe(50);
      expect(calculateCompletionPercentage(25, 100)).toBe(25);
    });

    it("handles edge cases", () => {
      expect(calculateCompletionPercentage(0, 100)).toBe(0);
      expect(calculateCompletionPercentage(100, 0)).toBe(0);
      expect(calculateCompletionPercentage(null, 100)).toBe(0);
    });
  });

  describe("computeStatusCounts", () => {
    it("counts statuses from maps", () => {
      const maps = {
        owned: { a: true, b: true },
        wishlist: { c: true },
        backlog: {},
        trade: { d: true },
      };
      const result = computeStatusCounts(maps);
      expect(result.owned).toBe(2);
      expect(result.wishlist).toBe(1);
      expect(result.backlog).toBe(0);
      expect(result.trade).toBe(1);
      expect(result.total).toBe(4);
    });

    it("handles null input", () => {
      const result = computeStatusCounts(null);
      expect(result.total).toBe(0);
    });
  });

  describe("calculateBarWidth", () => {
    it("calculates width percentage", () => {
      expect(calculateBarWidth(50, 100)).toBe("50.0%");
      expect(calculateBarWidth(100, 100)).toBe("100.0%");
    });

    it("returns minimum for small non-zero values", () => {
      expect(calculateBarWidth(1, 1000)).toBe("1%");
    });

    it("returns 0% for zero count", () => {
      expect(calculateBarWidth(0, 100)).toBe("0.0%");
    });
  });

  describe("formatStatusSummary", () => {
    it("formats status counts", () => {
      const counts = { owned: 10, wishlist: 5, backlog: 3, trade: 0 };
      const result = formatStatusSummary(counts);
      expect(result).toContain("Owned: 10");
      expect(result).toContain("Wishlist: 5");
      expect(result).not.toContain("Trade:");
    });

    it("returns empty for null", () => {
      expect(formatStatusSummary(null)).toBe("");
    });
  });

  describe("buildStatValue", () => {
    it("builds stat value HTML", () => {
      const html = buildStatValue(100, "games");
      expect(html).toContain("100");
      expect(html).toContain("games");
      expect(html).toContain("stat-value");
    });

    it("handles no label", () => {
      const html = buildStatValue(50);
      expect(html).toContain("50");
      expect(html).not.toContain("stat-label");
    });
  });

  describe("buildTrendIndicator", () => {
    it("builds upward trend", () => {
      const html = buildTrendIndicator(100, "up");
      expect(html).toContain("↗");
      expect(html).not.toContain("down");
    });

    it("builds downward trend", () => {
      const html = buildTrendIndicator(50, "down");
      expect(html).toContain("↘");
      expect(html).toContain("down");
    });
  });

  describe("buildProgressBar", () => {
    it("builds progress bar HTML", () => {
      const html = buildProgressBar(75, "myBar");
      expect(html).toContain("stat-progress");
      expect(html).toContain("75%");
      expect(html).toContain('id="myBar"');
    });

    it("clamps percentage", () => {
      const html = buildProgressBar(150);
      expect(html).toContain("100%");
    });
  });

  describe("buildCarouselCover", () => {
    it("builds cover item HTML", () => {
      const game = {
        id: 123,
        cover: "https://example.com/cover.jpg",
        game_name: "Zelda",
      };
      const html = buildCarouselCover(game);
      expect(html).toContain("carousel-cover");
      expect(html).toContain("Zelda");
      expect(html).toContain('data-game-id="123"');
    });

    it("uses placeholder for missing cover", () => {
      const game = { id: 1, game_name: "Test" };
      const html = buildCarouselCover(game);
      expect(html).toContain("placeholder.png");
    });
  });

  describe("buildRecentAdditionsCarousel", () => {
    it("builds carousel from games", () => {
      const games = [
        { id: 1, game_name: "A" },
        { id: 2, game_name: "B" },
      ];
      const html = buildRecentAdditionsCarousel(games);
      expect(html).toContain('data-game-id="1"');
      expect(html).toContain('data-game-id="2"');
    });

    it("limits games shown", () => {
      const games = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        game_name: `Game${i}`,
      }));
      const html = buildRecentAdditionsCarousel(games, 3);
      const matches = html.match(/carousel-cover/g);
      expect(matches).toHaveLength(3);
    });

    it("shows empty message for no games", () => {
      const html = buildRecentAdditionsCarousel([]);
      expect(html).toContain("carousel-empty");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// data/loader tests
// ─────────────────────────────────────────────────────────────────────────────
import {
  SAMPLE_DATA_URL,
  REGION_CODES,
  REGION_PATTERNS,
  applySupabaseFilters,
  applyRowEnhancements,
  computeRegionCodes,
  normalizeIncomingRows,
  buildRowKey,
} from "../app/data/loader.js";

describe("data/loader", () => {
  describe("constants", () => {
    it("exports sample data URL", () => {
      expect(SAMPLE_DATA_URL).toBe("./data/sample-games.json");
    });

    it("exports region codes", () => {
      expect(REGION_CODES).toContain("NTSC");
      expect(REGION_CODES).toContain("PAL");
      expect(REGION_CODES).toContain("JPN");
    });

    it("exports region patterns", () => {
      expect(REGION_PATTERNS.NTSC).toContain("usa");
      expect(REGION_PATTERNS.PAL).toContain("europe");
      expect(REGION_PATTERNS.JPN).toContain("japan");
    });
  });

  describe("computeRegionCodes", () => {
    it("returns empty array for null row", () => {
      expect(computeRegionCodes(null)).toEqual([]);
    });

    it("returns empty array for row without region", () => {
      expect(computeRegionCodes({ game_name: "Test" })).toEqual([]);
    });

    it("detects NTSC from USA region", () => {
      const result = computeRegionCodes({ region: "USA" });
      expect(result).toContain("NTSC");
    });

    it("detects PAL from Europe region", () => {
      const result = computeRegionCodes({ region: "Europe" });
      expect(result).toContain("PAL");
    });

    it("detects JPN from Japan region", () => {
      const result = computeRegionCodes({ region: "Japan" });
      expect(result).toContain("JPN");
    });

    it("returns existing region_codes array", () => {
      const result = computeRegionCodes({ region_codes: ["NTSC", "PAL"] });
      expect(result).toEqual(["NTSC", "PAL"]);
    });

    it("handles multiple regions", () => {
      const result = computeRegionCodes({ region: "USA, Europe, Japan" });
      expect(result).toContain("NTSC");
      expect(result).toContain("PAL");
      expect(result).toContain("JPN");
    });
  });

  describe("normalizeIncomingRows", () => {
    it("returns input unchanged for non-array", () => {
      expect(normalizeIncomingRows(null)).toBeNull();
      expect(normalizeIncomingRows(undefined)).toBeUndefined();
      expect(normalizeIncomingRows("not array")).toBe("not array");
    });

    it("returns array unchanged structure", () => {
      const rows = [{ game_name: "Test" }];
      const result = normalizeIncomingRows(rows);
      expect(result).toHaveLength(1);
      expect(result[0].game_name).toBe("Test");
    });
  });

  describe("buildRowKey", () => {
    it("builds key from game_name and platform", () => {
      const result = buildRowKey({ game_name: "Zelda", platform: "NES" });
      expect(result).toBe("Zelda___NES");
    });

    it("returns null for null row", () => {
      expect(buildRowKey(null)).toBeNull();
    });

    it("returns null for row without game_name", () => {
      expect(buildRowKey({ platform: "SNES" })).toBeNull();
    });

    it("returns null for row without platform", () => {
      const result = buildRowKey({ game_name: "Test" });
      expect(result).toBeNull();
    });
  });

  describe("applySupabaseFilters", () => {
    // Mock query builder that tracks calls
    function createMockQuery() {
      const calls = [];
      const query = {
        ilike: vi.fn().mockImplementation(function (col, val) {
          calls.push({ method: "ilike", col, val });
          return query;
        }),
        eq: vi.fn().mockImplementation(function (col, val) {
          calls.push({ method: "eq", col, val });
          return query;
        }),
        gte: vi.fn().mockImplementation(function (col, val) {
          calls.push({ method: "gte", col, val });
          return query;
        }),
        lte: vi.fn().mockImplementation(function (col, val) {
          calls.push({ method: "lte", col, val });
          return query;
        }),
        or: vi.fn().mockImplementation(function (clauses) {
          calls.push({ method: "or", clauses });
          return query;
        }),
        getCalls: () => calls,
      };
      return query;
    }

    it("returns query unchanged when no filters provided", () => {
      const query = createMockQuery();
      const result = applySupabaseFilters(query, {});
      expect(result).toBe(query);
      expect(query.getCalls()).toHaveLength(0);
    });

    it("returns query unchanged when filters is null", () => {
      const query = createMockQuery();
      const result = applySupabaseFilters(query, null);
      expect(result).toBe(query);
    });

    it("applies search filter with ilike", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { search: "mario" });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("ilike");
      expect(calls[0].val).toBe("%mario%");
    });

    it("applies platform filter with eq", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { platform: "SNES" });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("eq");
      expect(calls[0].val).toBe("SNES");
    });

    it("applies genre filter with ilike", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { genre: "RPG" });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("ilike");
      expect(calls[0].val).toBe("%RPG%");
    });

    it("applies ratingMin filter with gte", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { ratingMin: 8.5 });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("gte");
      expect(calls[0].val).toBe(8.5);
    });

    it("applies yearStart filter with gte", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { yearStart: 1990 });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("gte");
      expect(calls[0].val).toBe(1990);
    });

    it("applies yearEnd filter with lte", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { yearEnd: 2000 });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("lte");
      expect(calls[0].val).toBe(2000);
    });

    it("applies region filter with or clause", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { region: "NTSC" });
      const calls = query.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("or");
      expect(calls[0].clauses).toContain("region.ilike.%usa%");
    });

    it("applies multiple filters", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, {
        search: "zelda",
        platform: "NES",
        ratingMin: 9,
      });
      const calls = query.getCalls();
      expect(calls).toHaveLength(3);
    });

    it("uses column prefix when provided", () => {
      const query = createMockQuery();
      applySupabaseFilters(query, { platform: "SNES" }, "games");
      const calls = query.getCalls();
      expect(calls[0].col).toBe("games.platform");
    });
  });

  describe("applyRowEnhancements", () => {
    it("handles null row gracefully", () => {
      expect(() => applyRowEnhancements(null)).not.toThrow();
    });

    it("handles non-object row gracefully", () => {
      expect(() => applyRowEnhancements("not an object")).not.toThrow();
    });

    it("computes region codes for row with region", () => {
      const row = { game_name: "Test", region: "USA" };
      applyRowEnhancements(row);
      expect(row.__regionCodes).toContain("NTSC");
    });

    it("sets region field from computed codes if not present", () => {
      const row = { game_name: "Test", region_code: "usa, europe" };
      applyRowEnhancements(row);
      expect(row.__regionCodes).toContain("NTSC");
      expect(row.__regionCodes).toContain("PAL");
    });

    it("preserves existing cover URL", () => {
      const row = { game_name: "Test", cover: "https://example.com/cover.jpg" };
      applyRowEnhancements(row);
      expect(row.cover).toBe("https://example.com/cover.jpg");
    });

    it("uses screenshot as fallback when no cover", () => {
      const row = {
        game_name: "Test",
        screenshots: ["https://example.com/screenshot.jpg"],
      };
      applyRowEnhancements(row);
      expect(row.cover).toBe("https://example.com/screenshot.jpg");
    });
  });
});

// === data/storage.js Tests ===
describe("data/storage.js", () => {
  describe("normalizeImageUrl", () => {
    it("returns undefined for falsy values", () => {
      expect(normalizeImageUrl(null, "https://example.com")).toBeUndefined();
      expect(normalizeImageUrl("", "https://example.com")).toBeUndefined();
      expect(normalizeImageUrl(undefined, "https://example.com")).toBeUndefined();
    });

    it("returns absolute URLs unchanged", () => {
      expect(normalizeImageUrl("https://example.com/img.jpg", "")).toBe(
        "https://example.com/img.jpg"
      );
      expect(normalizeImageUrl("http://example.com/img.jpg", "")).toBe(
        "http://example.com/img.jpg"
      );
    });

    it("handles protocol-relative URLs", () => {
      const result = normalizeImageUrl("//cdn.example.com/img.jpg", "");
      expect(result).toMatch(/^https?:\/\/cdn\.example\.com\/img\.jpg$/);
    });

    it("prepends origin to absolute paths", () => {
      expect(normalizeImageUrl("/images/cover.jpg", "https://example.com")).toBe(
        "https://example.com/images/cover.jpg"
      );
    });

    it("prepends origin with slash to relative paths", () => {
      expect(normalizeImageUrl("images/cover.jpg", "https://example.com")).toBe(
        "https://example.com/images/cover.jpg"
      );
    });

    it("returns undefined when no origin provided for relative paths", () => {
      expect(normalizeImageUrl("/images/cover.jpg", "")).toBeUndefined();
      expect(normalizeImageUrl("images/cover.jpg", "")).toBeUndefined();
    });
  });

  describe("encodeStoragePath", () => {
    it("encodes path segments", () => {
      expect(encodeStoragePath("folder/file name.jpg")).toBe("folder/file%20name.jpg");
    });

    it("handles special characters", () => {
      expect(encodeStoragePath("folder/file#1.jpg")).toBe("folder/file%231.jpg");
    });

    it("preserves slashes", () => {
      expect(encodeStoragePath("a/b/c")).toBe("a/b/c");
    });
  });

  describe("buildStoragePublicUrl", () => {
    it("returns null for missing bucket or path", () => {
      expect(buildStoragePublicUrl("", "path")).toBeNull();
      expect(buildStoragePublicUrl("bucket", "")).toBeNull();
      expect(buildStoragePublicUrl(null, "path")).toBeNull();
    });

    it("returns null when STORAGE_PUBLIC_BASE is empty", () => {
      // Without configured Supabase, STORAGE_PUBLIC_BASE is empty
      const result = buildStoragePublicUrl("game-covers", "test.jpg");
      // If STORAGE_PUBLIC_BASE is empty, should return null
      expect(result).toBeNull();
    });
  });

  describe("resolveStorageCover", () => {
    it("returns null for non-object input", () => {
      expect(resolveStorageCover(null)).toBeNull();
      expect(resolveStorageCover("string")).toBeNull();
      expect(resolveStorageCover(123)).toBeNull();
    });

    it("returns cover_public_url if available", () => {
      const row = { cover_public_url: "https://example.com/cover.jpg" };
      expect(resolveStorageCover(row)).toBe("https://example.com/cover.jpg");
    });

    it("returns null for row without storage info", () => {
      const row = { game_name: "Test" };
      expect(resolveStorageCover(row)).toBeNull();
    });
  });

  describe("normalizeCoverUrl", () => {
    it("returns empty string for falsy values", () => {
      expect(normalizeCoverUrl(null)).toBe("");
      expect(normalizeCoverUrl(undefined)).toBe("");
      expect(normalizeCoverUrl("")).toBe("");
    });

    it("returns valid HTTPS URLs", () => {
      expect(normalizeCoverUrl("https://example.com/img.jpg")).toBe(
        "https://example.com/img.jpg"
      );
      expect(normalizeCoverUrl("http://example.com/img.jpg")).toBe(
        "http://example.com/img.jpg"
      );
    });

    it("returns empty string for invalid URLs", () => {
      expect(normalizeCoverUrl("just text")).toBe("");
      expect(normalizeCoverUrl("ftp://example.com")).toBe("");
    });

    it("extracts URL from object with url property", () => {
      expect(normalizeCoverUrl({ url: "https://example.com/img.jpg" })).toBe(
        "https://example.com/img.jpg"
      );
    });

    it("extracts URL from object with href property", () => {
      expect(normalizeCoverUrl({ href: "https://example.com/img.jpg" })).toBe(
        "https://example.com/img.jpg"
      );
    });

    it("extracts URL from object with source property", () => {
      expect(normalizeCoverUrl({ source: "https://example.com/img.jpg" })).toBe(
        "https://example.com/img.jpg"
      );
    });

    it("returns empty string for object without valid URL properties", () => {
      expect(normalizeCoverUrl({ name: "test" })).toBe("");
    });
  });

  describe("setRowCover", () => {
    it("returns false for non-object input", () => {
      expect(setRowCover(null, "https://example.com/img.jpg")).toBe(false);
      expect(setRowCover("string", "https://example.com/img.jpg")).toBe(false);
    });

    it("returns false for invalid cover URL", () => {
      const row = {};
      expect(setRowCover(row, "not a url")).toBe(false);
      expect(row.cover).toBeUndefined();
    });

    it("sets cover on row and returns true", () => {
      const row = {};
      expect(setRowCover(row, "https://example.com/img.jpg")).toBe(true);
      expect(row.cover).toBe("https://example.com/img.jpg");
    });

    it("sets provisional flag when requested", () => {
      const row = {};
      setRowCover(row, "https://example.com/img.jpg", { provisional: true });
      expect(row.__provisionalCover).toBe(true);
    });

    it("removes provisional flag when not requested", () => {
      const row = { __provisionalCover: true };
      setRowCover(row, "https://example.com/img.jpg");
      expect(row.__provisionalCover).toBeUndefined();
    });
  });

  describe("resolveScreenshotCover", () => {
    it("returns empty string for non-object input", () => {
      expect(resolveScreenshotCover(null)).toBe("");
      expect(resolveScreenshotCover("string")).toBe("");
    });

    it("returns empty string when no screenshots", () => {
      expect(resolveScreenshotCover({})).toBe("");
      expect(resolveScreenshotCover({ screenshots: [] })).toBe("");
    });

    it("returns first valid screenshot URL", () => {
      const row = {
        screenshots: [
          "invalid",
          "https://example.com/screen1.jpg",
          "https://example.com/screen2.jpg",
        ],
      };
      expect(resolveScreenshotCover(row)).toBe("https://example.com/screen1.jpg");
    });

    it("skips invalid screenshot URLs", () => {
      const row = {
        screenshots: ["not-a-url", { url: "https://example.com/screen.jpg" }],
      };
      expect(resolveScreenshotCover(row)).toBe("https://example.com/screen.jpg");
    });
  });
});

// === data/supabase.js Tests ===
describe("data/supabase.js", () => {
  beforeEach(() => {
    resetSupabaseClient();
  });

  describe("resolveStreamPageSize", () => {
    it("returns default when no config", () => {
      expect(resolveStreamPageSize()).toBe(DEFAULT_STREAM_PAGE_SIZE);
    });
  });

  describe("checkForceSampleMode", () => {
    it("returns boolean", () => {
      expect(typeof checkForceSampleMode()).toBe("boolean");
    });
  });

  describe("getTableCandidates", () => {
    it("returns array with default tables", () => {
      const candidates = getTableCandidates();
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
      // Should include default tables
      for (const table of DEFAULT_SUPABASE_TABLES) {
        expect(candidates).toContain(table);
      }
    });
  });

  describe("getSupabaseClient", () => {
    it("returns null when credentials missing", () => {
      resetSupabaseClient();
      const client = getSupabaseClient();
      expect(client).toBeNull();
    });
  });

  describe("isSupabaseAvailable", () => {
    it("returns false when credentials missing", () => {
      resetSupabaseClient();
      expect(isSupabaseAvailable()).toBe(false);
    });
  });

  describe("getSupabaseConfig", () => {
    it("returns config object", () => {
      const config = getSupabaseConfig();
      expect(typeof config).toBe("object");
    });
  });

  describe("resetSupabaseClient", () => {
    it("resets client state", () => {
      resetSupabaseClient();
      expect(getSupabaseClient()).toBeNull();
    });
  });

  describe("constants", () => {
    it("DEFAULT_STREAM_PAGE_SIZE is positive number", () => {
      expect(DEFAULT_STREAM_PAGE_SIZE).toBeGreaterThan(0);
    });

    it("DEFAULT_SUPABASE_TABLES is non-empty array", () => {
      expect(Array.isArray(DEFAULT_SUPABASE_TABLES)).toBe(true);
      expect(DEFAULT_SUPABASE_TABLES.length).toBeGreaterThan(0);
    });
  });
});

// === design/tokens.js Tests ===
describe("design/tokens.js", () => {
  describe("tokens object", () => {
    it("has colors.bg properties", () => {
      expect(tokens.colors.bg.primary).toBe("#0a0e14");
      expect(tokens.colors.bg.elevated).toBe("#14181f");
      expect(tokens.colors.bg.glass).toMatch(/^rgba/);
    });

    it("has colors.accent properties", () => {
      expect(tokens.colors.accent.primary).toBe("#00d4ff");
      expect(tokens.colors.accent.secondary).toBe("#6366f1");
      expect(tokens.colors.accent.warm).toBe("#f59e0b");
    });

    it("has colors.text properties", () => {
      expect(tokens.colors.text.primary).toBe("#ffffff");
      expect(tokens.colors.text.secondary).toBe("#a1a8b8");
      expect(tokens.colors.text.muted).toBe("#6b7280");
    });

    it("has colors.status properties", () => {
      expect(tokens.colors.status.owned).toBe("#10b981");
      expect(tokens.colors.status.wishlist).toBe("#f59e0b");
      expect(tokens.colors.status.backlog).toBe("#6366f1");
      expect(tokens.colors.status.trade).toBe("#8b5cf6");
    });

    it("has spacing properties", () => {
      expect(tokens.spacing.xs).toBe("4px");
      expect(tokens.spacing.sm).toBe("8px");
      expect(tokens.spacing.md).toBe("16px");
      expect(tokens.spacing.lg).toBe("24px");
      expect(tokens.spacing.xl).toBe("48px");
      expect(tokens.spacing.xxl).toBe("64px");
    });

    it("has typography properties", () => {
      expect(tokens.typography.display.family).toContain("Rajdhani");
      expect(tokens.typography.display.size).toBe("32px");
      expect(tokens.typography.display.weight).toBe(700);
      expect(tokens.typography.body.family).toContain("Inter");
      expect(tokens.typography.accent.family).toContain("Space Mono");
    });

    it("has shadows properties", () => {
      expect(tokens.shadows.sm).toMatch(/^0 \d+px/);
      expect(tokens.shadows.md).toMatch(/^0 \d+px/);
      expect(tokens.shadows.lg).toMatch(/^0 \d+px/);
      expect(tokens.shadows.xl).toMatch(/^0 \d+px/);
      expect(tokens.shadows.glow).toMatch(/rgba.*212.*255/);
    });

    it("has animation properties", () => {
      expect(tokens.animation.duration.fast).toBe("0.2s");
      expect(tokens.animation.duration.medium).toBe("0.4s");
      expect(tokens.animation.duration.slow).toBe("0.6s");
      expect(tokens.animation.easing.default).toMatch(/^cubic-bezier/);
      expect(tokens.animation.easing.bounce).toMatch(/^cubic-bezier/);
    });

    it("has breakpoints properties", () => {
      expect(tokens.breakpoints.mobile).toBe("320px");
      expect(tokens.breakpoints.tablet).toBe("768px");
      expect(tokens.breakpoints.desktop).toBe("1024px");
      expect(tokens.breakpoints.wide).toBe("1440px");
    });

    it("has borderRadius properties", () => {
      expect(tokens.borderRadius.sm).toBe("4px");
      expect(tokens.borderRadius.md).toBe("8px");
      expect(tokens.borderRadius.lg).toBe("12px");
      expect(tokens.borderRadius.xl).toBe("16px");
      expect(tokens.borderRadius.full).toBe("9999px");
    });
  });

  describe("generateCSSVariables", () => {
    it("returns a string", () => {
      const css = generateCSSVariables();
      expect(typeof css).toBe("string");
    });

    it("includes background color variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--bg-primary:");
      expect(css).toContain("--bg-elevated:");
      expect(css).toContain("--bg-glass:");
    });

    it("includes accent color variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--accent-primary:");
      expect(css).toContain("--accent-secondary:");
      expect(css).toContain("--accent-warm:");
    });

    it("includes text color variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--text-primary:");
      expect(css).toContain("--text-secondary:");
      expect(css).toContain("--text-muted:");
    });

    it("includes status color variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--status-owned:");
      expect(css).toContain("--status-wishlist:");
      expect(css).toContain("--status-backlog:");
      expect(css).toContain("--status-trade:");
    });

    it("includes spacing variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--spacing-xs:");
      expect(css).toContain("--spacing-md:");
      expect(css).toContain("--spacing-xl:");
    });

    it("includes typography variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--font-display:");
      expect(css).toContain("--font-body:");
      expect(css).toContain("--font-accent:");
    });

    it("includes shadow variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--shadow-sm:");
      expect(css).toContain("--shadow-lg:");
      expect(css).toContain("--shadow-glow:");
    });

    it("includes animation variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--duration-fast:");
      expect(css).toContain("--duration-medium:");
      expect(css).toContain("--easing-default:");
    });

    it("includes border radius variables", () => {
      const css = generateCSSVariables();
      expect(css).toContain("--radius-sm:");
      expect(css).toContain("--radius-lg:");
      expect(css).toContain("--radius-full:");
    });
  });
});
