/**
 * Features Tests
 * Tests for export and import functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  exportCollectionToCSV,
  createBackup,
  createShareCode,
  parseShareCode,
  parseBackup,
  parseCSVImport,
  getExportStats,
} from "../src/features";
import { setGames, setGameStatus, resetFilters, resetCollection } from "../src/state";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("features/export", () => {
  beforeEach(() => {
    localStorageMock.clear();
    resetFilters();
    resetCollection();
    setGames([]);
  });

  describe("exportCollectionToCSV", () => {
    it("should return headers only when no games in collection", () => {
      setGames([
        {
          game_name: "Test Game",
          platform: "SNES",
          genre: "RPG",
          rating: "9.0",
          release_year: "1995",
        },
      ]);

      const csv = exportCollectionToCSV();
      const lines = csv.split("\n");
      expect(lines).toHaveLength(1); // Just headers
      expect(lines[0]).toContain("Game Name");
    });

    it("should export owned games", () => {
      setGames([
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
      ]);
      setGameStatus("chrono trigger___snes", "owned");

      const csv = exportCollectionToCSV();
      const lines = csv.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("Chrono Trigger");
      expect(lines[1]).toContain("SNES");
      expect(lines[1]).toContain("owned");
    });

    it("should escape CSV values with commas", () => {
      setGames([
        {
          game_name: "Game, With Comma",
          platform: "SNES",
          genre: "RPG, Action",
          rating: "8.0",
          release_year: "1995",
        },
      ]);
      setGameStatus("game, with comma___snes", "owned");

      const csv = exportCollectionToCSV();
      expect(csv).toContain('"Game, With Comma"');
    });

    it("should filter by status when specified", () => {
      setGames([
        {
          game_name: "Game1",
          platform: "SNES",
          genre: "RPG",
          rating: "9.0",
          release_year: "1995",
        },
        {
          game_name: "Game2",
          platform: "SNES",
          genre: "RPG",
          rating: "8.0",
          release_year: "1996",
        },
      ]);
      setGameStatus("game1___snes", "owned");
      setGameStatus("game2___snes", "wishlist");

      const csv = exportCollectionToCSV("owned");
      expect(csv).toContain("Game1");
      expect(csv).not.toContain("Game2");
    });
  });

  describe("createBackup / parseBackup", () => {
    it("should create a valid backup payload", () => {
      setGames([
        {
          game_name: "Test",
          platform: "SNES",
          genre: "RPG",
          rating: "9.0",
          release_year: "1995",
        },
      ]);
      setGameStatus("test___snes", "owned");

      const backup = createBackup();
      expect(backup.version).toBe(2);
      expect(backup.timestamp).toBeGreaterThan(0);
      expect(backup.collection).toBeDefined();
    });

    it("should parse a valid backup", () => {
      const backup = {
        version: 2,
        timestamp: Date.now(),
        collection: {
          test___snes: { gameKey: "test___snes", status: "owned", addedAt: Date.now() },
        },
        notes: {},
      };

      const parsed = parseBackup(JSON.stringify(backup));
      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe(2);
    });

    it("should return null for invalid backup", () => {
      expect(parseBackup("invalid json")).toBeNull();
      expect(parseBackup("{}")).toBeNull();
    });

    it("should return null when collection is not an object", () => {
      const backup = {
        version: 2,
        timestamp: Date.now(),
        collection: [],
        notes: {},
      };

      expect(parseBackup(JSON.stringify(backup))).toBeNull();
    });
  });

  describe("createShareCode / parseShareCode", () => {
    it("should create and parse share code", () => {
      setGames([
        {
          game_name: "Game1",
          platform: "SNES",
          genre: "RPG",
          rating: "9.0",
          release_year: "1995",
        },
      ]);
      setGameStatus("game1___snes", "owned");

      const code = createShareCode();
      expect(code).toBeTruthy();

      const parsed = parseShareCode(code);
      expect(parsed).not.toBeNull();
      expect(parsed?.owned).toContain("game1___snes");
    });

    it("should include all status types", () => {
      setGames([
        {
          game_name: "G1",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "G2",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "G3",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "G4",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
      ]);
      setGameStatus("g1___snes", "owned");
      setGameStatus("g2___snes", "wishlist");
      setGameStatus("g3___snes", "backlog");
      setGameStatus("g4___snes", "trade");

      const code = createShareCode();
      const parsed = parseShareCode(code);

      expect(parsed?.owned).toContain("g1___snes");
      expect(parsed?.wishlist).toContain("g2___snes");
      expect(parsed?.backlog).toContain("g3___snes");
      expect(parsed?.trade).toContain("g4___snes");
    });

    it("should return null when payload arrays are invalid", () => {
      const invalidCode = btoa(
        JSON.stringify({
          v: 2,
          o: "not-an-array",
          w: [],
          b: [],
          t: [],
        })
      );

      expect(parseShareCode(invalidCode)).toBeNull();
    });

    it("should return null when decoded payload is not an object", () => {
      const nonObjectPayloads = [
        null,
        ["not", "an", "object"],
        "string-payload",
        123,
        true,
      ] as const;

      for (const payload of nonObjectPayloads) {
        const code = btoa(JSON.stringify(payload));
        expect(parseShareCode(code)).toBeNull();
      }
    });

    it("should return null when payload arrays contain non-string values", () => {
      const payloadsWithBadArrayValues = [
        // non-string in o
        {
          v: 2,
          o: ["ok", 1],
          w: [],
          b: [],
          t: [],
        },
        // non-string in w
        {
          v: 2,
          o: [],
          w: ["ok", { foo: "bar" }],
          b: [],
          t: [],
        },
        // non-string in b
        {
          v: 2,
          o: [],
          w: [],
          b: ["ok", null],
          t: [],
        },
        // non-string in t
        {
          v: 2,
          o: [],
          w: [],
          b: [],
          t: ["ok", 42],
        },
      ];

      for (const payload of payloadsWithBadArrayValues) {
        const code = btoa(JSON.stringify(payload));
        expect(parseShareCode(code)).toBeNull();
      }
    });

    it("should return null when a required array field is missing", () => {
      const payloadsMissingArrays = [
        // missing o
        {
          v: 2,
          w: [],
          b: [],
          t: [],
        } as any,
        // missing w
        {
          v: 2,
          o: [],
          b: [],
          t: [],
        } as any,
        // missing b
        {
          v: 2,
          o: [],
          w: [],
          t: [],
        } as any,
        // missing t
        {
          v: 2,
          o: [],
          w: [],
          b: [],
        } as any,
      ];

      for (const payload of payloadsMissingArrays) {
        const code = btoa(JSON.stringify(payload));
        expect(parseShareCode(code)).toBeNull();
      }
    });

    it("should return null for invalid share code", () => {
      expect(parseShareCode("not-base64!!")).toBeNull();
    });
  });

  describe("getExportStats", () => {
    it("should return zero counts when collection empty", () => {
      const stats = getExportStats();
      expect(stats.total).toBe(0);
      expect(stats.owned).toBe(0);
    });

    it("should count games by status", () => {
      setGames([
        {
          game_name: "G1",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "G2",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "G3",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
      ]);
      setGameStatus("g1___snes", "owned");
      setGameStatus("g2___snes", "owned");
      setGameStatus("g3___snes", "wishlist");

      const stats = getExportStats();
      expect(stats.total).toBe(3);
      expect(stats.owned).toBe(2);
      expect(stats.wishlist).toBe(1);
    });
  });

  describe("parseCSVImport", () => {
    it("should parse valid CSV with headers", () => {
      const csv = `Game Name,Platform,Genre,Rating,Year,Status,Notes
Chrono Trigger,SNES,RPG,9.6,1995,owned,Great game
Super Mario 64,N64,Platformer,9.8,1996,wishlist,`;
      const result = parseCSVImport(csv);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.data[0].key).toBe("chrono trigger___snes");
      expect(result.data[0].status).toBe("owned");
      expect(result.data[0].notes).toBe("Great game");
      expect(result.data[1].key).toBe("super mario 64___n64");
      expect(result.data[1].status).toBe("wishlist");
    });

    it("should handle quoted values with commas", () => {
      const csv = `Game Name,Platform,Status
"Game, With Comma",SNES,owned`;
      const result = parseCSVImport(csv);
      expect(result.imported).toBe(1);
      expect(result.data[0].key).toBe("game, with comma___snes");
    });

    it("should handle escaped quotes", () => {
      const csv = `Game Name,Platform,Status
"Game ""Quoted"" Name",SNES,owned`;
      const result = parseCSVImport(csv);
      expect(result.imported).toBe(1);
      expect(result.data[0].key).toBe('game "quoted" name___snes');
    });

    it("should skip rows with missing game name or platform", () => {
      const csv = `Game Name,Platform,Status
,SNES,owned
Chrono Trigger,,owned
Zelda,N64,owned`;
      const result = parseCSVImport(csv);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.data[0].key).toBe("zelda___n64");
    });

    it("should default to owned status when missing", () => {
      const csv = `Game Name,Platform
Chrono Trigger,SNES`;
      const result = parseCSVImport(csv);
      expect(result.data[0].status).toBe("owned");
    });

    it("should error on missing required headers", () => {
      const csv = `Name,System,Status
Chrono Trigger,SNES,owned`;
      const result = parseCSVImport(csv);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imported).toBe(0);
    });

    it("should handle empty CSV", () => {
      const csv = "";
      const result = parseCSVImport(csv);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imported).toBe(0);
    });

    it("should handle headers only", () => {
      const csv = "Game Name,Platform,Status";
      const result = parseCSVImport(csv);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it("should normalize invalid status to owned", () => {
      const csv = `Game Name,Platform,Status
Chrono Trigger,SNES,invalid_status`;
      const result = parseCSVImport(csv);
      expect(result.data[0].status).toBe("owned");
    });
  });
});
