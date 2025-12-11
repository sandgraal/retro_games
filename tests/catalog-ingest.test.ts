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
    path: string
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}${path}`, (res) => {
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

  test("POST /api/v1/games/:targetId/suggestions - successful submission with valid auth", async () => {
    const port = 9883;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const targetId = "chrono-trigger___snes";
    const delta = {
      release_date: "1995-03-11",
      genres: ["RPG", "Adventure"],
    };

    const response = await makePostRequest(
      port,
      `/api/v1/games/${targetId}/suggestions`,
      { delta, notes: "Updating release date" },
      {
        "x-role": "contributor",
        "x-user-email": "test@example.com",
        "x-session-id": "test-session-123",
      }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion).toBeDefined();
    expect(json.suggestion.id).toBeDefined();
    expect(json.suggestion.type).toBe("update");
    expect(json.suggestion.targetId).toBe(targetId);
    expect(json.suggestion.delta).toEqual(delta);
    expect(json.suggestion.status).toBe("pending");
    expect(json.suggestion.author).toEqual({
      role: "contributor",
      email: "test@example.com",
      sessionId: "test-session-123",
    });
    expect(json.suggestion.submittedAt).toBeDefined();
    expect(json.suggestion.notes).toBe("Updating release date");
  });

  test("POST /api/v1/games/:targetId/suggestions - rejects invalid delta payload (null)", async () => {
    const port = 9884;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/test-game___platform/suggestions`,
      { delta: null }
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Missing suggestion payload");
  });

  test("POST /api/v1/games/:targetId/suggestions - rejects invalid delta payload (not object)", async () => {
    const port = 9885;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/test-game___platform/suggestions`,
      { delta: "string instead of object" }
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Missing suggestion payload");
  });

  test("POST /api/v1/games/:targetId/suggestions - handles missing delta key and uses body directly", async () => {
    const port = 9886;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const delta = {
      title: "Final Fantasy VII",
      platform: "PlayStation",
    };

    const response = await makePostRequest(
      port,
      `/api/v1/games/ff7___ps1/suggestions`,
      delta // Sending delta directly without wrapping
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.delta).toEqual(delta);
  });

  test("POST /api/v1/games/:targetId/suggestions - stores author metadata correctly", async () => {
    const port = 9887;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/game___platform/suggestions`,
      { delta: { title: "Updated" } },
      {
        "x-role": "admin",
        "x-user-email": "admin@example.com",
        "x-session-id": "admin-session",
      }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.author.role).toBe("admin");
    expect(json.suggestion.author.email).toBe("admin@example.com");
    expect(json.suggestion.author.sessionId).toBe("admin-session");
  });

  test("POST /api/v1/games/:targetId/suggestions - defaults to anonymous auth when headers missing", async () => {
    const port = 9888;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/game___platform/suggestions`,
      { delta: { title: "Test" } }
      // No auth headers
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.author.role).toBe("anonymous");
    expect(json.suggestion.author.email).toBeNull();
    expect(json.suggestion.author.sessionId).toMatch(/^sess_/); // Auto-generated
  });

  test("POST /api/v1/games/:targetId/suggestions - handles targetId with special characters", async () => {
    const port = 9889;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const targetId = "pokémon red & blue___game boy";
    const encodedTargetId = encodeURIComponent(targetId);

    const response = await makePostRequest(
      port,
      `/api/v1/games/${encodedTargetId}/suggestions`,
      { delta: { region: "EU" } }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.targetId).toBe(targetId);
  });

  test("POST /api/v1/games/:targetId/suggestions - stores timestamp in ISO format", async () => {
    const port = 9890;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const beforeSubmit = new Date();
    const response = await makePostRequest(
      port,
      `/api/v1/games/test___platform/suggestions`,
      { delta: { rating: "E" } }
    );
    const afterSubmit = new Date();

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    const submittedAt = new Date(json.suggestion.submittedAt);

    expect(submittedAt.getTime()).toBeGreaterThanOrEqual(beforeSubmit.getTime());
    expect(submittedAt.getTime()).toBeLessThanOrEqual(afterSubmit.getTime());
    expect(json.suggestion.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test("POST /api/v1/games/:targetId/suggestions - handles notes field correctly", async () => {
    const port = 9891;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/test___platform/suggestions`,
      {
        delta: { title: "Updated Title" },
        notes: "This is a correction based on official release",
      }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.notes).toBe("This is a correction based on official release");
  });

  test("POST /api/v1/games/:targetId/suggestions - handles missing notes field", async () => {
    const port = 9892;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/games/test___platform/suggestions`,
      { delta: { title: "Updated" } }
      // No notes field
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.notes).toBeNull();
  });

  test("POST /api/v1/games/:targetId/suggestions - persists suggestions to file", async () => {
    const port = 9893;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await makePostRequest(
      port,
      `/api/v1/games/game1___platform1/suggestions`,
      { delta: { title: "First" } }
    );

    await makePostRequest(
      port,
      `/api/v1/games/game2___platform2/suggestions`,
      { delta: { title: "Second" } }
    );

    // Read suggestions file directly from tempDir
    const suggestionsPath = path.join(tempDir, "suggestions.json");
    const suggestionsData = JSON.parse(
      await fs.readFile(suggestionsPath, "utf-8")
    );

    expect(suggestionsData.suggestions).toHaveLength(2);
    expect(suggestionsData.suggestions[0].targetId).toBe("game1___platform1");
    expect(suggestionsData.suggestions[1].targetId).toBe("game2___platform2");
  });

  test("POST /api/v1/games/:targetId/suggestions - generates unique IDs for each submission", async () => {
    const port = 9894;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response1 = await makePostRequest(
      port,
      `/api/v1/games/test___platform/suggestions`,
      { delta: { title: "First" } }
    );

    const response2 = await makePostRequest(
      port,
      `/api/v1/games/test___platform/suggestions`,
      { delta: { title: "Second" } }
    );

    const json1 = JSON.parse(response1.body);
    const json2 = JSON.parse(response2.body);

    expect(json1.suggestion.id).toBeDefined();
    expect(json2.suggestion.id).toBeDefined();
    expect(json1.suggestion.id).not.toBe(json2.suggestion.id);
  });
});

describe("POST /api/v1/games/new - new game suggestions", () => {
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

  async function makePostRequest(
    port: number,
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const bodyData = JSON.stringify(body);
      const options = {
        hostname: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyData),
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: responseBody,
          });
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(bodyData);
      req.end();
    });
  }

  test("accepts new game with title field", async () => {
    const port = 9883;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      "/api/v1/games/new",
      {
        delta: {
          title: "New Test Game",
          platform: "PlayStation 5",
          release_date: "2024-01-01",
        },
      },
      {
        "x-role": "contributor",
        "x-user-email": "test@example.com",
      }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion).toBeDefined();
    expect(json.suggestion.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(json.suggestion.type).toBe("new");
    expect(json.suggestion.targetId).toBeNull();
    expect(json.suggestion.delta.title).toBe("New Test Game");
    expect(json.suggestion.status).toBe("pending");
    expect(json.suggestion.author).toEqual({
      role: "contributor",
      email: "test@example.com",
      sessionId: expect.any(String),
    });
    expect(json.suggestion.submittedAt).toBeDefined();
  });

  test("accepts new game with game_name field", async () => {
    const port = 9884;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(port, "/api/v1/games/new", {
      delta: {
        game_name: "Another Test Game",
        platform: "Xbox Series X",
      },
    });

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion).toBeDefined();
    expect(json.suggestion.delta.game_name).toBe("Another Test Game");
  });

  test("rejects request when both title and game_name are missing", async () => {
    const port = 9885;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(port, "/api/v1/games/new", {
      delta: {
        platform: "Nintendo Switch",
        release_date: "2024-01-01",
      },
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("New game submissions require a title");
  });

  test("rejects request when delta is missing title and game_name", async () => {
    const port = 9886;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(port, "/api/v1/games/new", {
      delta: {},
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("New game submissions require a title");
  });

  test("generates unique UUID for each suggestion", async () => {
    const port = 9887;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response1 = await makePostRequest(port, "/api/v1/games/new", {
      delta: {
        title: "Game 1",
        platform: "PS5",
      },
    });

    const response2 = await makePostRequest(port, "/api/v1/games/new", {
      delta: {
        title: "Game 2",
        platform: "PS5",
      },
    });

    expect(response1.statusCode).toBe(201);
    expect(response2.statusCode).toBe(201);

    const json1 = JSON.parse(response1.body);
    const json2 = JSON.parse(response2.body);

    expect(json1.suggestion.id).not.toBe(json2.suggestion.id);
    expect(json1.suggestion.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(json2.suggestion.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test("captures author metadata with role from headers", async () => {
    const port = 9888;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      "/api/v1/games/new",
      {
        delta: {
          title: "Test Game",
          platform: "PC",
        },
      },
      {
        "x-role": "moderator",
        "x-user-email": "moderator@example.com",
        "x-session-id": "test-session-123",
      }
    );

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.author).toEqual({
      role: "moderator",
      email: "moderator@example.com",
      sessionId: "test-session-123",
    });
  });

  test("defaults to anonymous role when no role header provided", async () => {
    const port = 9889;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(port, "/api/v1/games/new", {
      delta: {
        title: "Anonymous Game",
        platform: "PC",
      },
    });

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.author.role).toBe("anonymous");
    expect(json.suggestion.author.email).toBeNull();
  });

  test("stores suggestion in suggestions.json file", async () => {
    const port = 9890;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      "/api/v1/games/new",
      {
        delta: {
          title: "Persistent Game",
          platform: "GameCube",
          release_date: "2003-01-01",
        },
        notes: "This is a test note",
      },
      {
        "x-role": "contributor",
        "x-user-email": "contributor@example.com",
      }
    );

    expect(response.statusCode).toBe(201);

    // Verify the suggestion was stored
    const suggestionsPath = path.join(tempDir, "suggestions.json");
    const suggestionsContent = await fs.readFile(suggestionsPath, "utf-8");
    const suggestionsData = JSON.parse(suggestionsContent);

    expect(suggestionsData.suggestions).toBeInstanceOf(Array);
    expect(suggestionsData.suggestions.length).toBeGreaterThan(0);

    const storedSuggestion = suggestionsData.suggestions.find(
      (s: { delta: { title: string } }) => s.delta.title === "Persistent Game"
    );

    expect(storedSuggestion).toBeDefined();
    expect(storedSuggestion.type).toBe("new");
    expect(storedSuggestion.targetId).toBeNull();
    expect(storedSuggestion.status).toBe("pending");
    expect(storedSuggestion.notes).toBe("This is a test note");
    expect(storedSuggestion.delta.platform).toBe("GameCube");
  });

  test("handles body without delta wrapper", async () => {
    const port = 9891;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(port, "/api/v1/games/new", {
      title: "Direct Title",
      platform: "Dreamcast",
    });

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.suggestion.delta.title).toBe("Direct Title");
    expect(json.suggestion.delta.platform).toBe("Dreamcast");
  });

  test("stores multiple suggestions sequentially", async () => {
    const port = 9892;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await makePostRequest(port, "/api/v1/games/new", {
      delta: { title: "First Game", platform: "PS5" },
    });

    await makePostRequest(port, "/api/v1/games/new", {
      delta: { title: "Second Game", platform: "Xbox" },
    });

    await makePostRequest(port, "/api/v1/games/new", {
      delta: { title: "Third Game", platform: "Switch" },
    });

    const suggestionsPath = path.join(tempDir, "suggestions.json");
    const suggestionsContent = await fs.readFile(suggestionsPath, "utf-8");
    const suggestionsData = JSON.parse(suggestionsContent);

    expect(suggestionsData.suggestions).toHaveLength(3);
    expect(suggestionsData.suggestions[0].delta.title).toBe("First Game");
    expect(suggestionsData.suggestions[1].delta.title).toBe("Second Game");
    expect(suggestionsData.suggestions[2].delta.title).toBe("Third Game");
  });

  test("includes submittedAt timestamp in ISO format", async () => {
    const port = 9893;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const beforeRequest = new Date().toISOString();
    const response = await makePostRequest(port, "/api/v1/games/new", {
      delta: { title: "Timed Game", platform: "PC" },
    });
    const afterRequest = new Date().toISOString();

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);

    expect(json.suggestion.submittedAt).toBeDefined();
    expect(json.suggestion.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(json.suggestion.submittedAt >= beforeRequest).toBe(true);
    expect(json.suggestion.submittedAt <= afterRequest).toBe(true);
  });
});

describe("POST /api/v1/moderation/suggestions/:id/decision endpoint", () => {
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

  async function makePostRequest(
    port: number,
    path: string,
    body: any,
    headers: Record<string, string> = {}
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const options = {
        hostname: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: responseBody,
          });
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(postData);
      req.end();
    });
  }

  async function makeGetRequest(
    port: number,
    path: string,
    headers: Record<string, string> = {}
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port,
        path,
        method: "GET",
        headers,
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

      req.end();
    });
  }

  test("rejects request with 403 for anonymous role", async () => {
    // Setup: Create a suggestion
    const { suggestionsPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-1";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );

    const port = 9900;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved" },
      { "x-role": "anonymous" }
    );

    expect(response.statusCode).toBe(403);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Moderator access required");
  });

  test("rejects request with 403 for contributor role", async () => {
    // Setup: Create a suggestion
    const { suggestionsPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-2";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );

    const port = 9901;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved" },
      { "x-role": "contributor" }
    );

    expect(response.statusCode).toBe(403);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Moderator access required");
  });

  test("accepts request with 200 for moderator role", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-3";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9902;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved", notes: "Looks good" },
      { "x-role": "moderator", "x-user-email": "mod@example.com" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.suggestion).toBeDefined();
    expect(json.audit).toBeDefined();
  });

  test("accepts request with 200 for admin role", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-4";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9903;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved" },
      { "x-role": "admin", "x-user-email": "admin@example.com" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.suggestion).toBeDefined();
    expect(json.audit).toBeDefined();
  });

  test("rejects request with 400 for invalid status value", async () => {
    // Setup: Create a suggestion
    const { suggestionsPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-5";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );

    const port = 9904;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "invalid-status" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Decision status must be approved or rejected");
  });

  test("rejects request with 400 for missing status field", async () => {
    // Setup: Create a suggestion
    const { suggestionsPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-6";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );

    const port = 9905;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { notes: "Some notes without status" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Decision status must be approved or rejected");
  });

  test("accepts 'approved' as valid status value", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-7";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9906;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.suggestion.status).toBe("approved");
  });

  test("accepts 'rejected' as valid status value", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-8";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9907;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "rejected" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.suggestion.status).toBe("rejected");
  });

  test("returns 404 for non-existent suggestion", async () => {
    // Setup: Create an empty suggestions file
    const { suggestionsPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [],
      })
    );

    const port = 9908;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/non-existent-id/decision`,
      { status: "approved" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(404);
    const json = JSON.parse(response.body);
    expect(json.error).toBe("Suggestion not found");
  });

  test("creates audit log entry with correct structure", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-9";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9909;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved", notes: "Approved after review" },
      { "x-role": "moderator", "x-user-email": "mod@example.com" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    
    // Verify audit entry structure
    expect(json.audit).toBeDefined();
    expect(json.audit.suggestionId).toBe(suggestionId);
    expect(json.audit.decision).toBe("approved");
    expect(json.audit.notes).toBe("Approved after review");
    expect(json.audit.moderator).toBeDefined();
    expect(json.audit.moderator.role).toBe("moderator");
    expect(json.audit.moderator.email).toBe("mod@example.com");
    expect(json.audit.timestamp).toBeDefined();

    // Verify audit entry was persisted to file
    const auditLog = JSON.parse(await fs.readFile(auditLogPath, "utf-8"));
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].suggestionId).toBe(suggestionId);
    expect(auditLog[0].decision).toBe("approved");
  });

  test("updates suggestion status and adds decidedAt timestamp", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-10";
    const submittedAt = new Date().toISOString();
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt,
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9910;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const beforeTimestamp = new Date().toISOString();
    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "rejected", notes: "Duplicate entry" },
      { "x-role": "admin" }
    );
    const afterTimestamp = new Date().toISOString();

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);

    // Verify suggestion was updated
    expect(json.suggestion.status).toBe("rejected");
    expect(json.suggestion.moderationNotes).toBe("Duplicate entry");
    expect(json.suggestion.decidedAt).toBeDefined();
    
    // Verify timestamp is reasonable (between before and after)
    expect(json.suggestion.decidedAt >= beforeTimestamp).toBe(true);
    expect(json.suggestion.decidedAt <= afterTimestamp).toBe(true);

    // Verify original fields are preserved
    expect(json.suggestion.id).toBe(suggestionId);
    expect(json.suggestion.gameName).toBe("Test Game");
    expect(json.suggestion.submittedAt).toBe(submittedAt);

    // Verify suggestion was persisted to file
    const suggestions = JSON.parse(await fs.readFile(suggestionsPath, "utf-8"));
    expect(suggestions.suggestions[0].status).toBe("rejected");
    expect(suggestions.suggestions[0].decidedAt).toBeDefined();
  });

  test("handles notes field when not provided (sets to null)", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-11";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Test Game",
            platform: "Test Platform",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9911;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved" },
      { "x-role": "moderator" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.suggestion.moderationNotes).toBe(null);
    expect(json.audit.notes).toBe(null);
  });

  test("returns both suggestion and audit data in response", async () => {
    // Setup: Create a suggestion and audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    const suggestionId = "test-suggestion-12";
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestionId,
            gameName: "Final Fantasy VII",
            platform: "PlayStation",
            genre: "RPG",
            status: "pending",
            submittedAt: new Date().toISOString(),
            submittedBy: "user@example.com",
          },
        ],
      })
    );
    await fs.writeFile(auditLogPath, JSON.stringify([]));

    const port = 9912;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestionId}/decision`,
      { status: "approved", notes: "Classic title, approved" },
      { "x-role": "moderator", "x-user-email": "mod@example.com" }
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);

    // Verify both top-level keys exist
    expect(json.suggestion).toBeDefined();
    expect(json.audit).toBeDefined();

    // Verify suggestion data is complete
    expect(json.suggestion.id).toBe(suggestionId);
    expect(json.suggestion.gameName).toBe("Final Fantasy VII");
    expect(json.suggestion.platform).toBe("PlayStation");
    expect(json.suggestion.genre).toBe("RPG");
    expect(json.suggestion.status).toBe("approved");
    expect(json.suggestion.moderationNotes).toBe("Classic title, approved");
    expect(json.suggestion.decidedAt).toBeDefined();
    expect(json.suggestion.submittedAt).toBeDefined();
    expect(json.suggestion.submittedBy).toBe("user@example.com");

    // Verify audit data is complete
    expect(json.audit.suggestionId).toBe(suggestionId);
    expect(json.audit.decision).toBe("approved");
    expect(json.audit.notes).toBe("Classic title, approved");
    expect(json.audit.moderator).toBeDefined();
    expect(json.audit.moderator.role).toBe("moderator");
    expect(json.audit.moderator.email).toBe("mod@example.com");
    expect(json.audit.timestamp).toBeDefined();

    // Verify audit and suggestion timestamps match
    expect(json.audit.timestamp).toBe(json.suggestion.decidedAt);
  });

  test("handles multiple audit entries correctly", async () => {
    // Setup: Create suggestions and existing audit log
    const { suggestionsPath, auditLogPath } = {
      suggestionsPath: path.join(tempDir, "suggestions.json"),
      auditLogPath: path.join(tempDir, "audit-log.json"),
    };
    await fs.mkdir(tempDir, { recursive: true });
    
    const suggestion1Id = "test-suggestion-13a";
    const suggestion2Id = "test-suggestion-13b";
    
    await fs.writeFile(
      suggestionsPath,
      JSON.stringify({
        suggestions: [
          {
            id: suggestion1Id,
            gameName: "Game 1",
            platform: "Platform 1",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
          {
            id: suggestion2Id,
            gameName: "Game 2",
            platform: "Platform 2",
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        ],
      })
    );
    
    // Start with existing audit entry
    await fs.writeFile(
      auditLogPath,
      JSON.stringify([
        {
          suggestionId: "old-suggestion",
          decision: "approved",
          notes: "Old decision",
          moderator: { role: "admin", email: "old@example.com" },
          timestamp: new Date().toISOString(),
        },
      ])
    );

    const port = 9913;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Make first decision
    const response1 = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestion1Id}/decision`,
      { status: "approved" },
      { "x-role": "moderator", "x-user-email": "mod1@example.com" }
    );
    expect(response1.statusCode).toBe(200);

    // Make second decision
    const response2 = await makePostRequest(
      port,
      `/api/v1/moderation/suggestions/${suggestion2Id}/decision`,
      { status: "rejected" },
      { "x-role": "admin", "x-user-email": "admin@example.com" }
    );
    expect(response2.statusCode).toBe(200);

    // Verify audit log has all three entries
    const auditLog = JSON.parse(await fs.readFile(auditLogPath, "utf-8"));
    expect(auditLog).toHaveLength(3);
    expect(auditLog[0].suggestionId).toBe("old-suggestion");
    expect(auditLog[1].suggestionId).toBe(suggestion1Id);
    expect(auditLog[2].suggestionId).toBe(suggestion2Id);
  });
});
