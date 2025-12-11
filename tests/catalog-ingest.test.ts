import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import http from "http";
import {
  buildDeterministicKey,
  fuzzyMatchScore,
  runIngestion,
  startReadApiServer,
  applyApprovedSuggestions,
  normalizeRecord,
  computeRecordHash,
} from "../services/catalog-ingest/catalog-ingest.js";

const originalDataDir = process.env.CATALOG_DATA_DIR;
let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-ingest-"));
  process.env.CATALOG_DATA_DIR = tempDir;
});

afterEach(async () => {
  process.env.CATALOG_DATA_DIR = originalDataDir;
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("deterministic key + fuzzy matcher", () => {
  test("builds stable key", () => {
    const key = buildDeterministicKey({
      title: "Metroid Prime",
      platform: "GameCube",
      release_date: "2002-11-17",
    });
    expect(key).toBe("metroid prime___gamecube");
  });

  test("fuzzy score correlates similar titles", () => {
    const similar = fuzzyMatchScore("Final Fantasy VII", "Final Fantasy 7");
    const dissimilar = fuzzyMatchScore("Final Fantasy VII", "Halo Infinite");
    expect(similar).toBeGreaterThan(0.5);
    expect(dissimilar).toBeLessThan(similar);
  });

  test("fuzzy score handles empty strings", () => {
    const score1 = fuzzyMatchScore("", "");
    const score2 = fuzzyMatchScore("", "Some Game");
    const score3 = fuzzyMatchScore("Some Game", "");
    expect(score1).toBe(0);
    expect(score2).toBe(0);
    expect(score3).toBe(0);
  });

  test("fuzzy score handles single-character strings", () => {
    const score1 = fuzzyMatchScore("A", "A");
    const score2 = fuzzyMatchScore("A", "B");
    const score3 = fuzzyMatchScore("A", "Another Game");
    expect(score1).toBe(0);
    expect(score2).toBe(0);
    expect(score3).toBe(0);
  });

  test("fuzzy score handles two-character strings", () => {
    const score1 = fuzzyMatchScore("AB", "AB");
    const score2 = fuzzyMatchScore("AB", "ABC");
    const score3 = fuzzyMatchScore("AB", "XY");
    expect(score1).toBe(1); // Identical bigram
    expect(score2).toBeGreaterThan(0); // Partial match
    expect(score3).toBe(0); // No match
  });

  test("builds key using platform_slug fallback when platform is undefined", () => {
    const key = buildDeterministicKey({
      title: "Chrono Trigger",
      platform: undefined,
      platform_slug: "snes",
    });
    expect(key).toBe("chrono trigger___snes");
  });

  test("builds key using platform when both platform and platform_slug are provided", () => {
    const key = buildDeterministicKey({
      title: "Final Fantasy VII",
      platform: "PlayStation",
      platform_slug: "ps1",
    });
    expect(key).toBe("final fantasy vii___playstation");
  });

  test("builds key with platform_slug when platform is null", () => {
    const key = buildDeterministicKey({
      title: "Super Mario 64",
      platform: null,
      platform_slug: "n64",
    });
    expect(key).toBe("super mario 64___n64");
  });

  test("builds key with empty string when both platform and platform_slug are missing", () => {
    const key = buildDeterministicKey({
      title: "Mystery Game",
      platform: undefined,
      platform_slug: undefined,
    });
    expect(key).toBe("mystery game___");
  });
});

describe("error handling in fetchSourceRecords", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("handles invalid URL gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Invalid URL"));

    const run = await runIngestion({
      sources: [
        {
          name: "invalid-url-source",
          url: "not-a-valid-url",
        },
      ],
    });

    // Should continue processing and not crash
    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test("handles HTTP 404 error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const run = await runIngestion({
      sources: [
        {
          name: "404-source",
          url: "https://example.com/not-found",
        },
      ],
    });

    // Should log error and continue
    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test("handles HTTP 500 error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const run = await runIngestion({
      sources: [
        {
          name: "500-source",
          url: "https://example.com/server-error",
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test("handles network timeout/failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network request failed"));

    const run = await runIngestion({
      sources: [
        {
          name: "network-fail-source",
          url: "https://example.com/timeout",
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test("handles malformed JSON response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: "malformed-json-source",
          url: "https://example.com/bad-json",
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test("successfully processes valid URL with array response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi
        .fn()
        .mockResolvedValue([
          { title: "Test Game", platform: "Test Platform", release_date: "2020-01-01" },
        ]),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: "valid-url-source",
          url: "https://example.com/games",
        },
      ],
    });

    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });

  test("successfully processes valid URL with results wrapper", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            title: "Wrapped Game",
            platform: "Test Platform",
            release_date: "2021-01-01",
          },
        ],
      }),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: "wrapped-source",
          url: "https://example.com/wrapped-games",
        },
      ],
    });

    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });

  test("handles mixed success and failure sources", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue([
            { title: "Success Game", platform: "PS5", release_date: "2023-01-01" },
          ]),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error("Second source failed"));

    const run = await runIngestion({
      sources: [
        {
          name: "success-source",
          url: "https://example.com/success",
        },
        {
          name: "fail-source",
          url: "https://example.com/fail",
        },
      ],
    });

    // Should process the successful source despite the failure
    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });
});

describe("ingestion pipeline", () => {
  test("merges fuzzy matches and bumps version on change", async () => {
    const run = await runIngestion({
      fuzzyThreshold: 0.4,
      sources: [
        {
          name: "primary",
          records: [
            {
              title: "Halo",
              platform: "Xbox",
              release_date: "2001-11-15",
              regions: ["NA"],
              genres: ["FPS"],
            },
          ],
        },
        {
          name: "secondary",
          records: [
            {
              title: "Halo: Combat Evolved",
              platform: "Xbox",
              release_date: "2001-11-15",
              regions: ["EU"],
              genres: ["Shooter"],
            },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    const [record] = entries;
    expect(record.version).toBe(2);
    expect(record.record.regions.sort()).toEqual(["EU", "NA"]);
    expect(new Set(record.record.genres)).toEqual(new Set(["FPS", "Shooter"]));
    // Verify source array is properly merged and deduplicated
    expect(record.record.source).toEqual(
      expect.arrayContaining(["primary", "secondary"])
    );
    expect(record.record.source).toHaveLength(2);

    const snapshots = await fs.readdir(path.join(tempDir, "snapshots"));
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test("handles empty source records", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "empty-source",
          records: [],
        },
      ],
    });

    expect(Object.keys(run.records)).toHaveLength(0);
    expect(run.metrics.fetched).toBe(0);
    expect(run.metrics.normalized).toBe(0);
  });

  test("handles malformed input data with missing fields", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "malformed-source",
          records: [
            { title: null, platform: undefined, release_date: "" },
            { title: "Valid Game", platform: "PS2" },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries.length).toBeGreaterThan(0);
    // Should handle malformed data gracefully
    entries.forEach((entry) => {
      expect(entry.record).toHaveProperty("title");
      expect(entry.record).toHaveProperty("platform");
    });
  });

  test("handles special characters in titles", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "special-chars",
          records: [
            {
              title: "Pokémon Red & Blue",
              platform: "Game Boy",
              release_date: "1996-02-27",
            },
            {
              title: "Metal Gear Solid 2: Sons of Liberty",
              platform: "PS2",
              release_date: "2001-11-13",
            },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries.length).toBe(2);
    // Keys should be normalized and deterministic
    const keys = Object.keys(run.records);
    keys.forEach((key) => {
      expect(key).toMatch(/^[a-z0-9 ]+___[a-z0-9 ]+$/);
    });
  });

  test("tracks version changes when source is re-merged", async () => {
    // First ingestion
    const run1 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Zelda",
              platform: "NES",
              release_date: "1986-02-21",
              regions: ["NA"],
            },
          ],
        },
      ],
    });

    const key = Object.keys(run1.records)[0];
    expect(run1.records[key].version).toBe(1);

    // Second ingestion with same data - version does NOT increment because deduplication prevents changes
    const run2 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Zelda",
              platform: "NES",
              release_date: "1986-02-21",
              regions: ["NA"],
            },
          ],
        },
      ],
    });

    // Version stays the same because source array is deduplicated (no actual change)
    expect(run2.records[key].version).toBe(1);
    // Source array should be deduplicated to contain 'source1' only once
    expect(run2.records[key].record.source).toEqual(["source1"]);
  });

  test("merges duplicate records within single ingestion", async () => {
    // Single ingestion with duplicate identical records
    const run = await runIngestion({
      sources: [
        {
          name: "test-source",
          records: [
            {
              title: "Duplicate Game",
              platform: "Genesis",
              release_date: "1990-01-01",
              regions: ["NA"],
              genres: ["Action"],
            },
            {
              title: "Duplicate Game",
              platform: "Genesis",
              release_date: "1990-01-01",
              regions: ["NA"],
              genres: ["Action"],
            },
            {
              title: "Different Game",
              platform: "Genesis",
              release_date: "1990-01-01",
              regions: ["NA"],
              genres: ["Action"],
            },
          ],
        },
      ],
    });

    // Should have 2 unique games (duplicates merged into one)
    expect(Object.keys(run.records)).toHaveLength(2);
    // Both duplicates create merged records with concatenated source field
    expect(run.metrics.merged).toBe(1);
  });

  test("increments version only when record content changes", async () => {
    // First ingestion
    const run1 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Mario",
              platform: "NES",
              release_date: "1985-09-13",
              regions: ["JP"],
            },
          ],
        },
      ],
    });

    const key = Object.keys(run1.records)[0];
    expect(run1.records[key].version).toBe(1);

    // Second ingestion with additional data
    const run2 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Mario",
              platform: "NES",
              release_date: "1985-09-13",
              regions: ["JP", "NA"],
            },
          ],
        },
      ],
    });

    expect(run2.records[key].version).toBe(2);
    expect(run2.records[key].record.regions.sort()).toEqual(["JP", "NA"]);
  });

  test("increments version correctly through multiple updates", async () => {
    // First ingestion
    await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Sonic",
              platform: "Genesis",
              release_date: "1991-06-23",
              genres: ["Platformer"],
            },
          ],
        },
      ],
    });

    // Second ingestion with new region
    const run2 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Sonic",
              platform: "Genesis",
              release_date: "1991-06-23",
              genres: ["Platformer"],
              regions: ["NA"],
            },
          ],
        },
      ],
    });

    const key = Object.keys(run2.records)[0];
    expect(run2.records[key].version).toBe(2);

    // Third ingestion with new genre
    const run3 = await runIngestion({
      sources: [
        {
          name: "source1",
          records: [
            {
              title: "Sonic",
              platform: "Genesis",
              release_date: "1991-06-23",
              genres: ["Platformer", "Action"],
              regions: ["NA"],
            },
          ],
        },
      ],
    });

    expect(run3.records[key].version).toBe(3);
  });

  test("handles duplicate deterministic keys from same source", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "duplicate-source",
          records: [
            {
              title: "Final Fantasy VII",
              platform: "PlayStation",
              release_date: "1997-01-31",
              regions: ["JP"],
            },
            {
              title: "Final Fantasy VII",
              platform: "PlayStation",
              release_date: "1997-01-31",
              regions: ["NA"],
            },
          ],
        },
      ],
    });

    // Both records should merge into one
    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    expect(entries[0].record.regions.sort()).toEqual(["JP", "NA"]);
    // Source array should be deduplicated to contain the source name only once
    expect(entries[0].record.source).toEqual(["duplicate-source"]);
  });

  test("handles duplicate deterministic keys across sources", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "source-a",
          records: [
            {
              title: "Chrono Trigger",
              platform: "SNES",
              release_date: "1995-03-11",
              genres: ["RPG"],
            },
          ],
        },
        {
          name: "source-b",
          records: [
            {
              title: "Chrono Trigger",
              platform: "SNES",
              release_date: "1995-03-11",
              genres: ["JRPG"],
            },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    // Should merge genres from both sources
    expect(new Set(entries[0].record.genres)).toEqual(new Set(["RPG", "JRPG"]));
    // Source should be an array containing both source names
    expect(entries[0].record.source).toEqual(
      expect.arrayContaining(["source-a", "source-b"])
    );
    expect(entries[0].record.source).toHaveLength(2);
  });

  test("handles source names containing commas correctly", async () => {
    const run = await runIngestion({
      sources: [
        {
          name: "Source, with comma",
          records: [
            {
              title: "Test Game 1",
              platform: "PC",
              release_date: "2020-01-01",
              genres: ["Action"],
            },
          ],
        },
        {
          name: "Another, source",
          records: [
            {
              title: "Test Game 1",
              platform: "PC",
              release_date: "2020-01-01",
              genres: ["Adventure"],
            },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    // Source names with commas should be preserved intact in the array
    expect(entries[0].record.source).toEqual(
      expect.arrayContaining(["Source, with comma", "Another, source"])
    );
    expect(entries[0].record.source).toHaveLength(2);
    // Verify no string concatenation occurred (would break comma-containing names)
    expect(typeof entries[0].record.source).toBe("object");
    expect(Array.isArray(entries[0].record.source)).toBe(true);
  });
});

describe("startReadApiServer", () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          server = null;
          resolve();
        });
      });
    }
  });

  async function makeRequest(
    port: number,
    path: string,
    options: { headers?: Record<string, string> } = {}
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}${path}`,
        { headers: options.headers },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body,
            });
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  async function makePostRequest(
    port: number,
    path: string,
    payload?: object,
    headers?: Record<string, string>
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const data = payload ? JSON.stringify(payload) : "";
      const options = {
        hostname: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  test("starts server and listens on specified port", async () => {
    const port = 9876;
    server = startReadApiServer({ port });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    const listening = server.listening;
    expect(listening).toBe(true);

    const address = server.address();
    expect(address).toBeTruthy();
    if (typeof address === "object" && address !== null) {
      expect(address.port).toBe(port);
    }
  });

  test("returns 404 for non-API endpoints", async () => {
    const port = 9877;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/unknown");
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe("Not found");
  });

  test("returns 503 when no snapshots available", async () => {
    const port = 9878;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/api/v1/catalog");
    expect(response.statusCode).toBe(503);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("No catalog snapshots available");
  });

  test("returns 200 with catalog snapshot when available", async () => {
    // First, run an ingestion to create a snapshot
    await runIngestion({
      sources: [
        {
          name: "test",
          records: [
            { title: "Test Game", platform: "TestPlatform", release_date: "2020-01-01" },
          ],
        },
      ],
    });

    const port = 9879;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/api/v1/catalog");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(response.headers["cache-control"]).toBe("public, max-age=300");

    const json = JSON.parse(response.body);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty("key");
    expect(json[0]).toHaveProperty("version");
    expect(json[0]).toHaveProperty("hash");
    expect(json[0]).toHaveProperty("record");
  });

  test("serves latest snapshot by default", async () => {
    // Create multiple snapshots
    await runIngestion({
      sources: [
        {
          name: "first",
          records: [
            { title: "Game A", platform: "PlatformA", release_date: "2020-01-01" },
          ],
        },
      ],
    });

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    await runIngestion({
      sources: [
        {
          name: "second",
          records: [
            { title: "Game B", platform: "PlatformB", release_date: "2021-01-01" },
          ],
        },
      ],
    });

    const snapshotsDir = path.join(tempDir, "snapshots");
    const snapshots = await fs.readdir(snapshotsDir);
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const port = 9880;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/api/v1/catalog");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.body);
    // The latest snapshot should have both games
    expect(json.length).toBeGreaterThanOrEqual(2);
  });

  test("serves preferred snapshot when specified", async () => {
    // Create two ingestion runs
    await runIngestion({
      sources: [
        {
          name: "first",
          records: [
            { title: "Game A", platform: "PlatformA", release_date: "2020-01-01" },
          ],
        },
      ],
    });

    const snapshotsDir = path.join(tempDir, "snapshots");
    let snapshots = await fs.readdir(snapshotsDir);
    const firstSnapshot = snapshots[0];

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    await runIngestion({
      sources: [
        {
          name: "second",
          records: [
            { title: "Game A", platform: "PlatformA", release_date: "2020-01-01" },
            { title: "Game B", platform: "PlatformB", release_date: "2021-01-01" },
          ],
        },
      ],
    });

    snapshots = await fs.readdir(snapshotsDir);
    expect(snapshots.length).toBe(2);

    const port = 9881;
    server = startReadApiServer({ port, preferredSnapshot: firstSnapshot });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/api/v1/catalog");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.body);
    // First snapshot should have only 1 game
    expect(json.length).toBe(1);
    expect(json[0].record.title).toBe("Game A");
  });

  test("returns 503 when snapshots directory is empty after deletion", async () => {
    // Create a snapshot
    await runIngestion({
      sources: [
        {
          name: "test",
          records: [
            { title: "Test Game", platform: "TestPlatform", release_date: "2020-01-01" },
          ],
        },
      ],
    });

    // Delete the snapshots directory to simulate an error
    const snapshotsDir = path.join(tempDir, "snapshots");
    const snapshots = await fs.readdir(snapshotsDir);
    for (const snapshot of snapshots) {
      await fs.unlink(path.join(snapshotsDir, snapshot));
    }
    await fs.rmdir(snapshotsDir);

    const port = 9882;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, "/api/v1/catalog");
    // The server returns 503 when it can't read the snapshots directory
    expect(response.statusCode).toBe(503);

    const json = JSON.parse(response.body);
    expect(json.error).toBeDefined();
  });

  describe("GET /api/v1/moderation/suggestions", () => {
    test("returns 403 for anonymous user", async () => {
      const port = 9883;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await makeRequest(port, "/api/v1/moderation/suggestions");
      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error).toBe("Moderator access required");
    });

    test("returns 403 for contributor role", async () => {
      const port = 9884;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await makeRequest(port, "/api/v1/moderation/suggestions", {
        headers: { "x-role": "contributor" },
      });
      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error).toBe("Moderator access required");
    });

    test("returns 200 with empty suggestions for moderator when no suggestions exist", async () => {
      const port = 9885;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await makeRequest(port, "/api/v1/moderation/suggestions", {
        headers: { "x-role": "moderator" },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.suggestions).toEqual([]);
    });

    test("returns 200 with empty suggestions for admin when no suggestions exist", async () => {
      const port = 9886;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const adminToken = getTestJwt("admin");
      const response = await makeRequest(port, "/api/v1/moderation/suggestions", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.suggestions).toEqual([]);
    });

    test.each([
      {
        role: "moderator",
        port: 9887,
        game: {
          title: "Chrono Trigger",
          platform: "SNES",
          release_date: "1995-03-11",
          genres: ["RPG"],
        },
        suggestionId: "test-suggestion-1",
      },
      {
        role: "admin",
        port: 9888,
        game: {
          title: "Final Fantasy VII",
          platform: "PlayStation",
          release_date: "1997-01-31",
          genres: ["RPG"],
        },
        suggestionId: "test-suggestion-2",
      },
    ])(
      "enriches suggestions with canonical data from catalog-store for $role",
      async ({ role, port, game, suggestionId }) => {
        // First, create a game in the catalog
        await runIngestion({
          sources: [
            {
              name: "test-source",
              records: [game],
            },
          ],
        });

        // Get the game key to use as targetId
        const catalogStorePath = path.join(tempDir, "catalog-store.json");
        const suggestionsPath = path.join(tempDir, "suggestions.json");
        const catalogStoreData = await fs.readFile(catalogStorePath, "utf-8");
        const catalogStore = JSON.parse(catalogStoreData);
        const gameKey = Object.keys(catalogStore.records)[0];

        // Create a suggestion
        const suggestions = {
          suggestions: [
            {
              id: suggestionId,
              type: "update",
              targetId: gameKey,
              delta: { genres: ["RPG", "Updated"] },
              status: "pending",
              author: {
                role: "contributor",
                email: "user@example.com",
                sessionId: "sess_123",
              },
              submittedAt: "2024-01-01T00:00:00.000Z",
              notes: "Updating genres",
            },
          ],
        };
        await fs.writeFile(suggestionsPath, JSON.stringify(suggestions, null, 2));

        server = startReadApiServer({ port });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = await makeRequest(port, "/api/v1/moderation/suggestions", {
          headers: { "x-role": role },
        });
        expect(response.statusCode).toBe(200);
        const json = JSON.parse(response.body);
        expect(json.suggestions).toHaveLength(1);
        expect(json.suggestions[0].id).toBe(suggestionId);
        expect(json.suggestions[0].canonical).toBeDefined();
        expect(json.suggestions[0].canonical.title).toBe(game.title);
        expect(json.suggestions[0].canonical.platform).toBe(game.platform);
      }
    );

    test("handles suggestions with no targetId (new game suggestions)", async () => {
      const suggestionsPath = path.join(tempDir, "suggestions.json");

      // Create a new game suggestion without targetId
      const suggestions = {
        suggestions: [
          {
            id: "test-suggestion-3",
            type: "new",
            targetId: null,
            delta: {
              title: "New Game",
              platform: "Switch",
              release_date: "2024-01-01",
              genres: ["Adventure"],
            },
            status: "pending",
            author: {
              role: "contributor",
              email: "user@example.com",
              sessionId: "sess_789",
            },
            submittedAt: "2024-01-03T00:00:00.000Z",
            notes: "Submitting new game",
          },
        ],
      };
      await fs.writeFile(suggestionsPath, JSON.stringify(suggestions, null, 2));

      const port = 9889;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await makeRequest(port, "/api/v1/moderation/suggestions", {
        headers: { "x-role": "moderator" },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.suggestions).toHaveLength(1);
      expect(json.suggestions[0].id).toBe("test-suggestion-3");
      expect(json.suggestions[0].canonical).toBeNull();
    });

    test("filters suggestions by status query parameter", async () => {
      const suggestionsPath = path.join(tempDir, "suggestions.json");

      // Create suggestions with different statuses
      const suggestions = {
        suggestions: [
          {
            id: "pending-suggestion",
            type: "new",
            targetId: null,
            delta: { title: "Pending Game", platform: "PS5" },
            status: "pending",
            author: {
              role: "contributor",
              email: "user1@example.com",
              sessionId: "sess_1",
            },
            submittedAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "approved-suggestion",
            type: "new",
            targetId: null,
            delta: { title: "Approved Game", platform: "Xbox" },
            status: "approved",
            author: {
              role: "contributor",
              email: "user2@example.com",
              sessionId: "sess_2",
            },
            submittedAt: "2024-01-02T00:00:00.000Z",
          },
          {
            id: "rejected-suggestion",
            type: "new",
            targetId: null,
            delta: { title: "Rejected Game", platform: "PC" },
            status: "rejected",
            author: {
              role: "contributor",
              email: "user3@example.com",
              sessionId: "sess_3",
            },
            submittedAt: "2024-01-03T00:00:00.000Z",
          },
        ],
      };
      await fs.writeFile(suggestionsPath, JSON.stringify(suggestions, null, 2));

      const port = 9890;
      server = startReadApiServer({ port });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test default (pending)
      const pendingResponse = await makeRequest(port, "/api/v1/moderation/suggestions", {
        headers: { "x-role": "moderator" },
      });
      expect(pendingResponse.statusCode).toBe(200);
      const pendingJson = JSON.parse(pendingResponse.body);
      expect(pendingJson.suggestions).toHaveLength(1);
      expect(pendingJson.suggestions[0].id).toBe("pending-suggestion");

      // Test approved filter
      const approvedResponse = await makeRequest(
        port,
        "/api/v1/moderation/suggestions?status=approved",
        {
          headers: { "x-role": "moderator" },
        }
      );
      expect(approvedResponse.statusCode).toBe(200);
      const approvedJson = JSON.parse(approvedResponse.body);
      expect(approvedJson.suggestions).toHaveLength(1);
      expect(approvedJson.suggestions[0].id).toBe("approved-suggestion");

      // Test rejected filter
      const rejectedResponse = await makeRequest(
        port,
        "/api/v1/moderation/suggestions?status=rejected",
        {
          headers: { "x-role": "moderator" },
        }
      );
      expect(rejectedResponse.statusCode).toBe(200);
      const rejectedJson = JSON.parse(rejectedResponse.body);
      expect(rejectedJson.suggestions).toHaveLength(1);
      expect(rejectedJson.suggestions[0].id).toBe("rejected-suggestion");
    });
  });
});

describe("applyApprovedSuggestions", () => {
  test("applies approved update suggestion to existing record", () => {
    const records = {
      sonic___genesis: {
        record: {
          title: "Sonic",
          platform: "Genesis",
          genres: ["Platformer"],
          regions: ["NA"],
          source: ["original"],
        },
        hash: "hash1",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg1",
        type: "update",
        targetId: "sonic___genesis",
        status: "approved",
        delta: {
          regions: ["NA", "EU", "JP"],
          genres: ["Platformer", "Action"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["sonic___genesis"].version).toBe(2);
    expect(records["sonic___genesis"].record.regions).toEqual(["NA", "EU", "JP"]);
    expect(records["sonic___genesis"].record.genres).toEqual(["Platformer", "Action"]);
    expect(records["sonic___genesis"].hash).not.toBe("hash1");
  });

  test("inserts approved new game suggestion", () => {
    const records = {};

    const suggestions = [
      {
        id: "sugg2",
        type: "new",
        status: "approved",
        payload: {
          title: "Earthbound",
          platform: "SNES",
          release_date: "1994-08-27",
          genres: ["RPG"],
          regions: ["NA"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    const key = "earthbound___snes";
    expect(records[key]).toBeDefined();
    expect(records[key].version).toBe(1);
    expect(records[key].record.title).toBe("Earthbound");
    expect(records[key].record.platform).toBe("SNES");
    expect(records[key].hash).toBeDefined();
  });

  test("increments version for updated records", () => {
    const records = {
      mario___nes: {
        record: {
          title: "Mario",
          platform: "NES",
          genres: ["Platformer"],
          source: ["original"],
        },
        hash: computeRecordHash({
          title: "Mario",
          platform: "NES",
          genres: ["Platformer"],
          source: ["original"],
        }),
        version: 5,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg3",
        type: "update",
        targetId: "mario___nes",
        status: "approved",
        delta: {
          regions: ["JP", "NA"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["mario___nes"].version).toBe(6);
  });

  test("recalculates hash after merging", () => {
    const originalRecord = {
      title: "Zelda",
      platform: "NES",
      genres: ["Adventure"],
      source: ["original"],
    };

    const records = {
      zelda___nes: {
        record: originalRecord,
        hash: computeRecordHash(originalRecord),
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const originalHash = records["zelda___nes"].hash;

    const suggestions = [
      {
        id: "sugg4",
        type: "update",
        targetId: "zelda___nes",
        status: "approved",
        delta: {
          release_date: "1986-02-21",
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["zelda___nes"].hash).not.toBe(originalHash);
    const expectedMerged = { ...originalRecord, release_date: "1986-02-21" };
    expect(records["zelda___nes"].hash).toBe(computeRecordHash(expectedMerged));
  });

  test("skips pending suggestions", () => {
    const records = {
      metroid___nes: {
        record: {
          title: "Metroid",
          platform: "NES",
          source: ["original"],
        },
        hash: "hash2",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg5",
        type: "update",
        targetId: "metroid___nes",
        status: "pending",
        delta: {
          genres: ["Action", "Adventure"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(0);
    expect(records["metroid___nes"].version).toBe(1);
    expect(records["metroid___nes"].hash).toBe("hash2");
    expect(records["metroid___nes"].record.genres).toBeUndefined();
  });

  test("skips rejected suggestions", () => {
    const records = {
      castlevania___nes: {
        record: {
          title: "Castlevania",
          platform: "NES",
          genres: ["Action"],
          source: ["original"],
        },
        hash: "hash3",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg6",
        type: "update",
        targetId: "castlevania___nes",
        status: "rejected",
        delta: {
          genres: ["Horror"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(0);
    expect(records["castlevania___nes"].version).toBe(1);
    expect(records["castlevania___nes"].record.genres).toEqual(["Action"]);
  });

  test("properly counts applied suggestions", () => {
    const records = {
      game1___platform1: {
        record: { title: "Game1", platform: "Platform1", source: ["src1"] },
        hash: "hash4",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
      game2___platform2: {
        record: { title: "Game2", platform: "Platform2", source: ["src2"] },
        hash: "hash5",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg7",
        type: "update",
        targetId: "game1___platform1",
        status: "approved",
        delta: { regions: ["NA"] },
      },
      {
        id: "sugg8",
        type: "update",
        targetId: "game2___platform2",
        status: "approved",
        delta: { genres: ["RPG"] },
      },
      {
        id: "sugg9",
        type: "update",
        targetId: "game2___platform2",
        status: "pending",
        delta: { regions: ["EU"] },
      },
      {
        id: "sugg10",
        type: "new",
        status: "approved",
        payload: {
          title: "Game3",
          platform: "Platform3",
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(3);
  });

  test("handles suggestions with missing delta/payload", () => {
    const records = {
      game___platform: {
        record: { title: "Game", platform: "Platform", source: ["src"] },
        hash: "hash6",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg11",
        type: "update",
        targetId: "game___platform",
        status: "approved",
        // Missing delta
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    // Should not crash, but might not apply anything meaningful
    expect(applied).toBeGreaterThanOrEqual(0);
    expect(records["game___platform"]).toBeDefined();
  });

  test("handles update suggestions with non-existent targetId", () => {
    const records = {
      existing___game: {
        record: { title: "Existing", platform: "Game", source: ["src"] },
        hash: "hash7",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg12",
        type: "update",
        targetId: "nonexistent___game",
        status: "approved",
        delta: {
          genres: ["Action"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(0);
    expect(records["nonexistent___game"]).toBeUndefined();
    expect(Object.keys(records)).toHaveLength(1);
  });

  test("handles new suggestions with existing keys", () => {
    const records = {
      duplicate___game: {
        record: { title: "Duplicate", platform: "Game", source: ["original"] },
        hash: "hash8",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg13",
        type: "new",
        status: "approved",
        payload: {
          title: "Duplicate",
          platform: "Game",
          genres: ["Strategy"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    // Should not overwrite existing record
    expect(applied).toBe(0);
    expect(records["duplicate___game"].version).toBe(1);
    expect(records["duplicate___game"].record.genres).toBeUndefined();
  });

  test("handles mixed approved and non-approved suggestions", () => {
    const records = {};

    const suggestions = [
      {
        id: "sugg14",
        type: "new",
        status: "approved",
        payload: { title: "Approved1", platform: "PS1" },
      },
      {
        id: "sugg15",
        type: "new",
        status: "pending",
        payload: { title: "Pending1", platform: "PS2" },
      },
      {
        id: "sugg16",
        type: "new",
        status: "approved",
        payload: { title: "Approved2", platform: "PS3" },
      },
      {
        id: "sugg17",
        type: "new",
        status: "rejected",
        payload: { title: "Rejected1", platform: "PS4" },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(2);
    expect(records["approved1___ps1"]).toBeDefined();
    expect(records["approved2___ps3"]).toBeDefined();
    expect(records["pending1___ps2"]).toBeUndefined();
    expect(records["rejected1___ps4"]).toBeUndefined();
  });

  test("handles update with no actual changes", () => {
    const originalRecord = {
      title: "Unchanged",
      platform: "Platform",
      genres: ["Action"],
      source: ["src"],
    };

    const records = {
      unchanged___platform: {
        record: originalRecord,
        hash: computeRecordHash(originalRecord),
        version: 2,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const originalVersion = records["unchanged___platform"].version;
    const originalHash = records["unchanged___platform"].hash;

    const suggestions = [
      {
        id: "sugg18",
        type: "update",
        targetId: "unchanged___platform",
        status: "approved",
        delta: {
          // Delta doesn't actually change anything
          genres: ["Action"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    // Should not increment version if hash is unchanged
    expect(applied).toBe(0);
    expect(records["unchanged___platform"].version).toBe(originalVersion);
    expect(records["unchanged___platform"].hash).toBe(originalHash);
  });

  test("uses delta field for updates", () => {
    const records = {
      game___platform: {
        record: { title: "Game", platform: "Platform", source: ["src"] },
        hash: "hash9",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg19",
        type: "update",
        targetId: "game___platform",
        status: "approved",
        delta: { genres: ["RPG"] },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["game___platform"].record.genres).toEqual(["RPG"]);
  });

  test("uses payload field for updates when delta is missing", () => {
    const records = {
      game2___platform: {
        record: { title: "Game2", platform: "Platform", source: ["src"] },
        hash: "hash10",
        version: 1,
        lastSeen: "2024-01-01T00:00:00.000Z",
      },
    };

    const suggestions = [
      {
        id: "sugg20",
        type: "update",
        targetId: "game2___platform",
        status: "approved",
        payload: { regions: ["EU"] },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["game2___platform"].record.regions).toEqual(["EU"]);
  });

  test("normalizes new game suggestions correctly", () => {
    const records = {};

    const suggestions = [
      {
        id: "sugg21",
        type: "new",
        status: "approved",
        payload: {
          game_name: "Final Fantasy VII",
          platform: "PlayStation",
          platform_slug: "ps1",
          release_year: "1997",
          esrb_rating: "T",
          genres: ["RPG", "Adventure"],
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    const key = "final fantasy vii___playstation";
    expect(records[key]).toBeDefined();
    expect(records[key].record.title).toBe("Final Fantasy VII");
    expect(records[key].record.platform).toBe("PlayStation");
    expect(records[key].record.source).toEqual(["community"]);
  });

  test("uses targetId for new suggestions when provided", () => {
    const records = {};

    const suggestions = [
      {
        id: "sugg22",
        type: "new",
        targetId: "custom___key",
        status: "approved",
        payload: {
          title: "Custom Key Game",
          platform: "N64",
        },
      },
    ];

    const applied = applyApprovedSuggestions(records, suggestions);

    expect(applied).toBe(1);
    expect(records["custom___key"]).toBeDefined();
    expect(records["custom___key"].record.title).toBe("Custom Key Game");
  });
});

describe("field name variant handling in suggestions", () => {
  test("handles various field name variants consistently", async () => {
    const suggestionsPath = path.join(tempDir, "suggestions.json");

    // Create suggestions with different field name variants
    const suggestions = {
      suggestions: [
        {
          id: "test-1",
          type: "new",
          status: "approved",
          delta: {
            title: "Game with title field",
            platform: "SNES",
            release_date: "1995-01-01",
            esrb: "E",
          },
        },
        {
          id: "test-2",
          type: "new",
          status: "approved",
          delta: {
            game_name: "Game with game_name field",
            platform_slug: "genesis",
            release_year: "1994",
            esrb_rating: "T",
          },
        },
        {
          id: "test-3",
          type: "new",
          status: "approved",
          delta: {
            name: "Game with name field",
            platform_name: "PlayStation",
            releaseDate: "1996-03-15",
            rating: "M",
          },
        },
      ],
    };

    await fs.writeFile(suggestionsPath, JSON.stringify(suggestions, null, 2));

    // Run ingestion which will apply the approved suggestions
    const run = await runIngestion({ sources: [] });

    // All suggestions should have been applied despite different field names
    expect(run.metrics.suggestionsApplied).toBe(3);

    // Verify the records were created with normalized field names
    const keys = Object.keys(run.records);
    expect(keys).toHaveLength(3);

    // Check that each record has the expected normalized structure
    for (const key of keys) {
      const record = run.records[key].record;
      expect(record.title).toBeDefined();
      expect(record.platform).toBeDefined();
      expect(record.platform_slug).toBeDefined();
      expect(record.release_date).toBeDefined();
      expect(record.esrb).toBeDefined();
    }

    // Verify specific records
    const game1 = Object.values(run.records).find(
      (r: any) => r.record.title === "Game with title field"
    );
    expect(game1).toBeDefined();
    expect(game1!.record.platform).toBe("SNES");

    const game2 = Object.values(run.records).find(
      (r: any) => r.record.title === "Game with game_name field"
    );
    expect(game2).toBeDefined();
    expect(game2!.record.platform).toBe("genesis");
    expect(game2!.record.release_date).toBe("1994");

    const game3 = Object.values(run.records).find(
      (r: any) => r.record.title === "Game with name field"
    );
    expect(game3).toBeDefined();
    expect(game3!.record.platform).toBe("PlayStation");
    expect(game3!.record.esrb).toBe("M");
  });
});
