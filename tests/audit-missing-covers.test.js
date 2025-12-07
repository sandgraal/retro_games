import { describe, it, expect } from "vitest";
import {
  parseArgs,
  isValidCoverUrl,
  categorizeIssue,
  auditCovers,
  formatResults,
} from "../scripts/audit-missing-covers.js";

describe("audit-missing-covers script", () => {
  describe("parseArgs", () => {
    it("returns default options when no args", () => {
      const options = parseArgs([]);
      expect(options.source).toBe("json");
      expect(options.output).toBe(null);
    });

    it("parses --source option", () => {
      const options = parseArgs(["--source", "supabase"]);
      expect(options.source).toBe("supabase");
    });

    it("parses --output option", () => {
      const options = parseArgs(["--output", "/tmp/results.json"]);
      expect(options.output).toContain("results.json");
    });

    it("parses -o shorthand for output", () => {
      const options = parseArgs(["-o", "/tmp/audit.json"]);
      expect(options.output).toContain("audit.json");
    });

    it("parses multiple options", () => {
      const options = parseArgs(["--source", "supabase", "--output", "/tmp/out.json"]);
      expect(options.source).toBe("supabase");
      expect(options.output).toContain("out.json");
    });
  });

  describe("isValidCoverUrl", () => {
    it("returns true for valid https URL", () => {
      expect(isValidCoverUrl("https://example.com/cover.jpg")).toBe(true);
    });

    it("returns true for valid http URL", () => {
      expect(isValidCoverUrl("http://example.com/cover.png")).toBe(true);
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

    it("returns false for whitespace-only string", () => {
      expect(isValidCoverUrl("   ")).toBe(false);
    });

    it("returns false for non-URL string", () => {
      expect(isValidCoverUrl("not-a-url")).toBe(false);
    });

    it("returns false for number", () => {
      expect(isValidCoverUrl(123)).toBe(false);
    });

    it("returns false for object", () => {
      expect(isValidCoverUrl({ url: "https://example.com" })).toBe(false);
    });
  });

  describe("categorizeIssue", () => {
    it('returns "missing" for undefined', () => {
      expect(categorizeIssue(undefined)).toBe("missing");
    });

    it('returns "null" for null', () => {
      expect(categorizeIssue(null)).toBe("null");
    });

    it('returns "empty" for empty string', () => {
      expect(categorizeIssue("")).toBe("empty");
    });

    it('returns "invalid-type" for non-string', () => {
      expect(categorizeIssue(123)).toBe("invalid-type");
      expect(categorizeIssue({})).toBe("invalid-type");
    });

    it('returns "invalid-url" for non-URL string', () => {
      expect(categorizeIssue("not-a-url")).toBe("invalid-url");
    });
  });

  describe("auditCovers", () => {
    it("returns correct stats for all valid covers", () => {
      const games = [
        { game_name: "Game 1", platform: "SNES", cover: "https://example.com/1.jpg" },
        { game_name: "Game 2", platform: "PS1", cover: "https://example.com/2.jpg" },
      ];
      const result = auditCovers(games);
      expect(result.stats.total).toBe(2);
      expect(result.stats.withCover).toBe(2);
      expect(result.issues).toHaveLength(0);
    });

    it("identifies missing covers", () => {
      const games = [
        { game_name: "Game 1", platform: "SNES" },
        { game_name: "Game 2", platform: "PS1", cover: null },
        { game_name: "Game 3", platform: "N64", cover: "" },
      ];
      const result = auditCovers(games);
      expect(result.stats.total).toBe(3);
      expect(result.stats.withCover).toBe(0);
      expect(result.stats.missing).toBe(1);
      expect(result.stats.null).toBe(1);
      expect(result.stats.empty).toBe(1);
      expect(result.issues).toHaveLength(3);
    });

    it("identifies invalid URLs", () => {
      const games = [{ game_name: "Game 1", platform: "SNES", cover: "not-a-valid-url" }];
      const result = auditCovers(games);
      expect(result.stats.invalidUrl).toBe(1);
      expect(result.issues[0].issue).toBe("invalid-url");
    });

    it("sorts issues by game name", () => {
      const games = [
        { game_name: "Zelda", platform: "NES" },
        { game_name: "Asteroids", platform: "Atari" },
        { game_name: "Mario", platform: "NES" },
      ];
      const result = auditCovers(games);
      expect(result.issues[0].game_name).toBe("Asteroids");
      expect(result.issues[1].game_name).toBe("Mario");
      expect(result.issues[2].game_name).toBe("Zelda");
    });

    it("handles games without name gracefully", () => {
      const games = [{ platform: "SNES" }];
      const result = auditCovers(games);
      expect(result.issues[0].game_name).toBe("(unknown)");
    });
  });

  describe("formatResults", () => {
    it("formats summary correctly", () => {
      const results = {
        stats: {
          total: 100,
          withCover: 95,
          missing: 2,
          null: 1,
          empty: 1,
          invalidType: 0,
          invalidUrl: 1,
        },
        issues: [{ game_name: "Test Game", platform: "SNES", issue: "missing" }],
      };
      const output = formatResults(results);
      expect(output).toContain("Cover Audit Report");
      expect(output).toContain("Total games:      100");
      expect(output).toContain("With valid cover: 95");
      expect(output).toContain("Test Game (SNES) - missing");
    });

    it("shows success message when no issues", () => {
      const results = {
        stats: {
          total: 10,
          withCover: 10,
          missing: 0,
          null: 0,
          empty: 0,
          invalidType: 0,
          invalidUrl: 0,
        },
        issues: [],
      };
      const output = formatResults(results);
      expect(output).toContain("All games have valid cover URLs!");
    });
  });
});
