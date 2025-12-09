/**
 * Format Utilities Tests
 */

import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatRating,
  formatPercent,
  formatFieldLabel,
  timeAgo,
  formatAbsoluteDate,
  formatBytes,
  formatDuration,
} from "../src/utils/format";

describe("formatCurrency", () => {
  it("formats positive values", () => {
    expect(formatCurrency(100)).toBe("$100.00");
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(99.99)).toBe("$99.99");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles invalid values returning $0", () => {
    // Invalid values return "$0" (no decimal) because they're NaN/not finite
    expect(formatCurrency(null)).toBe("$0");
    expect(formatCurrency(undefined)).toBe("$0");
    expect(formatCurrency("abc")).toBe("$0");
  });

  it("converts from cents", () => {
    expect(formatCurrency(1999, { fromCents: true })).toBe("$20");
    expect(formatCurrency(50, { fromCents: true })).toBe("$1");
  });

  it("respects precision option", () => {
    expect(formatCurrency(99.999, { precision: 3 })).toBe("$99.999");
    expect(formatCurrency(99.999, { precision: 0 })).toBe("$100");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("handles invalid values", () => {
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(undefined)).toBe("0");
    expect(formatNumber("abc")).toBe("0");
  });
});

describe("formatRating", () => {
  it("formats to one decimal place", () => {
    expect(formatRating(9.6)).toBe("9.6");
    expect(formatRating(10)).toBe("10.0");
    expect(formatRating(8.55)).toBe("8.6"); // rounds to nearest
  });

  it("returns N/A for invalid values", () => {
    expect(formatRating(0)).toBe("N/A");
    expect(formatRating(-1)).toBe("N/A");
    expect(formatRating(null)).toBe("N/A");
    expect(formatRating(undefined)).toBe("N/A");
  });
});

describe("formatPercent", () => {
  it("formats percentages", () => {
    expect(formatPercent(50, 100)).toBe("50%");
    expect(formatPercent(100, 100)).toBe("100%");
  });

  it("handles small values", () => {
    expect(formatPercent(0.5, 100)).toBe("<1%");
    expect(formatPercent(5.5, 100)).toBe("5.5%");
  });

  it("returns 0% for edge cases", () => {
    expect(formatPercent(0, 0)).toBe("0%");
    expect(formatPercent(null, 100)).toBe("0%");
  });
});

describe("formatFieldLabel", () => {
  it("converts snake_case", () => {
    expect(formatFieldLabel("game_name")).toBe("Game Name");
    expect(formatFieldLabel("release_year")).toBe("Release Year");
  });

  it("converts camelCase", () => {
    expect(formatFieldLabel("gameName")).toBe("Game Name");
  });

  it("converts kebab-case", () => {
    expect(formatFieldLabel("game-name")).toBe("Game Name");
  });

  it("handles empty values", () => {
    expect(formatFieldLabel(null)).toBe("");
    expect(formatFieldLabel(undefined)).toBe("");
    expect(formatFieldLabel("")).toBe("");
  });
});

describe("timeAgo", () => {
  it("returns just now for recent times", () => {
    expect(timeAgo(Date.now())).toBe("just now");
    expect(timeAgo(Date.now() - 30000)).toBe("just now");
  });

  it("returns minutes", () => {
    expect(timeAgo(Date.now() - 120000)).toBe("2m");
  });

  it("returns hours", () => {
    expect(timeAgo(Date.now() - 7200000)).toBe("2h");
  });

  it("returns days", () => {
    expect(timeAgo(Date.now() - 172800000)).toBe("2d");
  });

  it("handles invalid values", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
  });
});

describe("formatAbsoluteDate", () => {
  it("formats dates", () => {
    const date = new Date(2025, 11, 9);
    const result = formatAbsoluteDate(date);
    expect(result).toContain("2025");
    expect(result).toContain("9");
  });

  it("handles timestamps", () => {
    const result = formatAbsoluteDate(1733702400000);
    expect(result).toContain("2024");
  });

  it("handles empty values", () => {
    expect(formatAbsoluteDate(null)).toBe("");
    expect(formatAbsoluteDate(undefined)).toBe("");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(30000)).toBe("30.0s");
  });

  it("formats minutes", () => {
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(300000)).toBe("5m 0s");
  });

  it("formats hours", () => {
    expect(formatDuration(7200000)).toBe("2h 0m");
    expect(formatDuration(5400000)).toBe("1h 30m");
  });
});
