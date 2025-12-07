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
