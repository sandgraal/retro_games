import { describe, expect, it } from "vitest";

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
