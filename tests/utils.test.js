import { describe, expect, it, beforeEach } from "vitest";

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
  FALLBACK_COVER_RETRY_MS,
} from "../app/state/cache.js";

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
