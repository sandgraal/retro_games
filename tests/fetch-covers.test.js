import { describe, it, expect } from "vitest";
import {
  parseArgs,
  normalizeGameName,
  buildSearchQueries,
  isValidCoverUrl,
} from "../scripts/fetch-covers.js";

describe("fetch-covers script", () => {
  describe("parseArgs", () => {
    it("returns default options when no args", () => {
      const options = parseArgs([]);
      expect(options.limit).toBe(50);
      expect(options.dryRun).toBe(false);
      expect(options.output).toBe(null);
      expect(options.force).toBe(false);
    });

    it("parses --limit option", () => {
      const options = parseArgs(["--limit", "100"]);
      expect(options.limit).toBe(100);
    });

    it("defaults limit to 50 for invalid value", () => {
      const options = parseArgs(["--limit", "notanumber"]);
      expect(options.limit).toBe(50);
    });

    it("parses --dry-run flag", () => {
      const options = parseArgs(["--dry-run"]);
      expect(options.dryRun).toBe(true);
    });

    it("parses --force flag", () => {
      const options = parseArgs(["--force"]);
      expect(options.force).toBe(true);
    });

    it("parses --output option", () => {
      const options = parseArgs(["--output", "/tmp/results.json"]);
      expect(options.output).toContain("results.json");
    });

    it("parses -o shorthand for output", () => {
      const options = parseArgs(["-o", "/tmp/covers.json"]);
      expect(options.output).toContain("covers.json");
    });

    it("parses multiple options together", () => {
      const options = parseArgs([
        "--limit",
        "25",
        "--dry-run",
        "--force",
        "--output",
        "/tmp/out.json",
      ]);
      expect(options.limit).toBe(25);
      expect(options.dryRun).toBe(true);
      expect(options.force).toBe(true);
      expect(options.output).toContain("out.json");
    });
  });

  describe("normalizeGameName", () => {
    it("trims whitespace", () => {
      expect(normalizeGameName("  Game Title  ")).toBe("Game Title");
    });

    it("replaces hyphens with spaces", () => {
      expect(normalizeGameName("Mega-Man")).toBe("Mega Man");
    });

    it("handles multiple hyphens", () => {
      expect(normalizeGameName("Mega-Man-X")).toBe("Mega Man X");
    });

    it("normalizes fancy apostrophes", () => {
      expect(normalizeGameName("Link\u2019s Awakening")).toBe("Link's Awakening");
      expect(normalizeGameName("Link\u2018s Awakening")).toBe("Link's Awakening");
    });

    it("normalizes fancy double quotes", () => {
      expect(normalizeGameName("\u201CGame\u201D")).toBe('"Game"');
    });

    it("collapses multiple spaces", () => {
      expect(normalizeGameName("Super   Mario   Bros")).toBe("Super Mario Bros");
    });

    it("handles complex names", () => {
      expect(normalizeGameName("  Zelda - Link's  Awakening  ")).toBe(
        "Zelda Link's Awakening"
      );
    });
  });

  describe("buildSearchQueries", () => {
    it("generates video game queries for basic game", () => {
      const queries = buildSearchQueries("Chrono Trigger", "SNES");
      expect(queries).toContain("Chrono Trigger (video game)");
      expect(queries).toContain("Chrono Trigger video game");
      expect(queries).toContain("Chrono Trigger");
    });

    it("includes platform-specific query for SNES", () => {
      const queries = buildSearchQueries("Super Mario World", "SNES");
      expect(queries.some((q) => q.includes("Super Nintendo"))).toBe(true);
    });

    it("includes platform-specific query for NES", () => {
      const queries = buildSearchQueries("Super Mario Bros", "NES");
      expect(queries.some((q) => q.includes("Nintendo Entertainment System"))).toBe(true);
    });

    it("includes arcade-specific queries for arcade games", () => {
      const queries = buildSearchQueries("Pac-Man", "Arcade");
      expect(queries.some((q) => q.includes("arcade game"))).toBe(true);
      expect(queries.some((q) => q.includes("arcade"))).toBe(true);
    });

    it("adds year-based queries for platforms with known release years", () => {
      const nesQueries = buildSearchQueries("Legend of Zelda", "NES");
      expect(nesQueries.some((q) => q.includes("1986"))).toBe(true);

      const snesQueries = buildSearchQueries("Super Metroid", "SNES");
      expect(snesQueries.some((q) => q.includes("1991"))).toBe(true);
    });

    it("adds Roman numeral variations for III", () => {
      const queries = buildSearchQueries("Final Fantasy III", "SNES");
      expect(queries.some((q) => q.includes("Final Fantasy 3"))).toBe(true);
    });

    it("adds Roman numeral variations for II", () => {
      const queries = buildSearchQueries("Zelda II", "NES");
      expect(queries.some((q) => q.includes("Zelda 2"))).toBe(true);
    });

    it("does not add II->2 variation when III is present", () => {
      const queries = buildSearchQueries("Final Fantasy III", "SNES");
      // Should not add "Final Fantasy I3" (replacing II with 2)
      expect(queries.every((q) => !q.includes("I3"))).toBe(true);
    });

    it("handles N/A platform gracefully", () => {
      const queries = buildSearchQueries("Some Game", "N/A");
      expect(queries).toContain("Some Game (video game)");
      // Should not have platform-specific query
      expect(queries.every((q) => !q.includes("N/A video game"))).toBe(true);
    });

    it("normalizes game name before building queries", () => {
      const queries = buildSearchQueries("  Mega-Man  ", "NES");
      expect(queries.some((q) => q.includes("Mega Man"))).toBe(true);
      expect(queries.every((q) => !q.includes("Mega-Man"))).toBe(true);
    });
  });

  describe("isValidCoverUrl", () => {
    it("returns true for valid https jpg URL", () => {
      expect(isValidCoverUrl("https://example.com/cover.jpg")).toBe(true);
    });

    it("returns true for valid https png URL", () => {
      expect(isValidCoverUrl("https://upload.wikimedia.org/cover.png")).toBe(true);
    });

    it("returns true for valid http URL", () => {
      expect(isValidCoverUrl("http://example.com/image.jpeg")).toBe(true);
    });

    it("returns true for webp images", () => {
      expect(isValidCoverUrl("https://example.com/cover.webp")).toBe(true);
    });

    it("returns true for gif images", () => {
      expect(isValidCoverUrl("https://example.com/cover.gif")).toBe(true);
    });

    it("returns false for null", () => {
      expect(isValidCoverUrl(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidCoverUrl(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidCoverUrl("")).toBe(false);
    });

    it("returns false for non-string", () => {
      expect(isValidCoverUrl(123)).toBe(false);
      expect(isValidCoverUrl({})).toBe(false);
      expect(isValidCoverUrl([])).toBe(false);
    });

    it("returns false for non-http URLs", () => {
      expect(isValidCoverUrl("ftp://example.com/cover.jpg")).toBe(false);
      expect(isValidCoverUrl("file:///cover.jpg")).toBe(false);
    });

    it("returns false for relative URLs", () => {
      expect(isValidCoverUrl("/images/cover.jpg")).toBe(false);
      expect(isValidCoverUrl("cover.jpg")).toBe(false);
    });

    it("returns false for SVG files", () => {
      expect(isValidCoverUrl("https://example.com/logo.svg")).toBe(false);
    });

    it("returns false for flag images", () => {
      expect(isValidCoverUrl("https://example.com/flag_usa.png")).toBe(false);
    });

    it("returns false for map images", () => {
      expect(isValidCoverUrl("https://example.com/world_map.jpg")).toBe(false);
    });

    it("returns false for logo images", () => {
      expect(isValidCoverUrl("https://example.com/company_logo.png")).toBe(false);
    });

    it("returns false for icon images", () => {
      expect(isValidCoverUrl("https://example.com/game_icon.png")).toBe(false);
    });

    it("returns false for banner images", () => {
      expect(isValidCoverUrl("https://example.com/banner.jpg")).toBe(false);
    });

    it("returns false for screenshot images", () => {
      expect(isValidCoverUrl("https://example.com/screenshot.png")).toBe(false);
    });

    it("returns false for URLs without image extension", () => {
      expect(isValidCoverUrl("https://example.com/page")).toBe(false);
      expect(isValidCoverUrl("https://example.com/cover.html")).toBe(false);
      expect(isValidCoverUrl("https://example.com/data.json")).toBe(false);
    });

    it("is case insensitive for extensions", () => {
      expect(isValidCoverUrl("https://example.com/cover.JPG")).toBe(true);
      expect(isValidCoverUrl("https://example.com/cover.PNG")).toBe(true);
    });

    it("is case insensitive for blacklisted patterns", () => {
      expect(isValidCoverUrl("https://example.com/FLAG.png")).toBe(false);
      expect(isValidCoverUrl("https://example.com/LOGO.jpg")).toBe(false);
    });

    it("accepts Wikipedia upload URLs", () => {
      expect(
        isValidCoverUrl(
          "https://upload.wikimedia.org/wikipedia/en/4/42/Chrono_Trigger.png"
        )
      ).toBe(true);
    });

    it("accepts URLs with query parameters", () => {
      expect(isValidCoverUrl("https://example.com/cover.jpg?size=300")).toBe(true);
    });
  });
});
