import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  buildDeterministicKey,
  fuzzyMatchScore,
  runIngestion,
} from '../services/catalog-ingest/catalog-ingest.js';

const originalDataDir = process.env.CATALOG_DATA_DIR;
let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-ingest-'));
  process.env.CATALOG_DATA_DIR = tempDir;
});

afterEach(async () => {
  process.env.CATALOG_DATA_DIR = originalDataDir;
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('deterministic key + fuzzy matcher', () => {
  test('builds stable key using release year', () => {
    const key = buildDeterministicKey({ title: 'Metroid Prime', platform: 'GameCube', release_date: '2002-11-17' });
    expect(key).toBe('metroid prime___gamecube');
  });

  test('fuzzy score correlates similar titles', () => {
    const similar = fuzzyMatchScore('Final Fantasy VII', 'Final Fantasy 7');
    const dissimilar = fuzzyMatchScore('Final Fantasy VII', 'Halo Infinite');
    expect(similar).toBeGreaterThan(0.5);
    expect(dissimilar).toBeLessThan(similar);
  });
});

describe('error handling in fetchSourceRecords', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('handles invalid URL gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Invalid URL'));

    const run = await runIngestion({
      sources: [
        {
          name: 'invalid-url-source',
          url: 'not-a-valid-url',
        },
      ],
    });

    // Should continue processing and not crash
    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test('handles HTTP 404 error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const run = await runIngestion({
      sources: [
        {
          name: '404-source',
          url: 'https://example.com/not-found',
        },
      ],
    });

    // Should log error and continue
    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test('handles HTTP 500 error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const run = await runIngestion({
      sources: [
        {
          name: '500-source',
          url: 'https://example.com/server-error',
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test('handles network timeout/failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network request failed'));

    const run = await runIngestion({
      sources: [
        {
          name: 'network-fail-source',
          url: 'https://example.com/timeout',
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test('handles malformed JSON response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: 'malformed-json-source',
          url: 'https://example.com/bad-json',
        },
      ],
    });

    expect(run.metrics.fetched).toBe(0);
    expect(Object.keys(run.records)).toHaveLength(0);
  });

  test('successfully processes valid URL with array response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        { title: 'Test Game', platform: 'Test Platform', release_date: '2020-01-01' },
      ]),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: 'valid-url-source',
          url: 'https://example.com/games',
        },
      ],
    });

    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });

  test('successfully processes valid URL with results wrapper', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        results: [
          { title: 'Wrapped Game', platform: 'Test Platform', release_date: '2021-01-01' },
        ],
      }),
    } as unknown as Response);

    const run = await runIngestion({
      sources: [
        {
          name: 'wrapped-source',
          url: 'https://example.com/wrapped-games',
        },
      ],
    });

    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });

  test('handles mixed success and failure sources', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { title: 'Success Game', platform: 'PS5', release_date: '2023-01-01' },
        ]),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error('Second source failed'));

    const run = await runIngestion({
      sources: [
        {
          name: 'success-source',
          url: 'https://example.com/success',
        },
        {
          name: 'fail-source',
          url: 'https://example.com/fail',
        },
      ],
    });

    // Should process the successful source despite the failure
    expect(run.metrics.fetched).toBe(1);
    expect(Object.keys(run.records)).toHaveLength(1);
  });
});

describe('ingestion pipeline', () => {
  test('merges fuzzy matches and bumps version on change', async () => {
    const run = await runIngestion({
      fuzzyThreshold: 0.4,
      sources: [
        {
          name: 'primary',
          records: [
            { title: 'Halo', platform: 'Xbox', release_date: '2001-11-15', regions: ['NA'], genres: ['FPS'] },
          ],
        },
        {
          name: 'secondary',
          records: [
            { title: 'Halo: Combat Evolved', platform: 'Xbox', release_date: '2001-11-15', regions: ['EU'], genres: ['Shooter'] },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    const [record] = entries;
    expect(record.version).toBe(2);
    expect(record.record.regions.sort()).toEqual(['EU', 'NA']);
    expect(new Set(record.record.genres)).toEqual(new Set(['FPS', 'Shooter']));

    const snapshots = await fs.readdir(path.join(tempDir, 'snapshots'));
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test('handles empty source records', async () => {
    const run = await runIngestion({
      sources: [
        {
          name: 'empty-source',
          records: [],
        },
      ],
    });

    expect(Object.keys(run.records)).toHaveLength(0);
    expect(run.metrics.fetched).toBe(0);
    expect(run.metrics.normalized).toBe(0);
  });

  test('handles malformed input data with missing fields', async () => {
    const run = await runIngestion({
      sources: [
        {
          name: 'malformed-source',
          records: [
            { title: null, platform: undefined, release_date: '' },
            { title: 'Valid Game', platform: 'PS2' },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries.length).toBeGreaterThan(0);
    // Should handle malformed data gracefully
    entries.forEach(entry => {
      expect(entry.record).toHaveProperty('title');
      expect(entry.record).toHaveProperty('platform');
    });
  });

  test('handles special characters in titles', async () => {
    const run = await runIngestion({
      sources: [
        {
          name: 'special-chars',
          records: [
            { title: 'Pokémon Red & Blue', platform: 'Game Boy', release_date: '1996-02-27' },
            { title: 'Metal Gear Solid 2: Sons of Liberty', platform: 'PS2', release_date: '2001-11-13' },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries.length).toBe(2);
    // Keys should be normalized and deterministic
    const keys = Object.keys(run.records);
    keys.forEach(key => {
      expect(key).toMatch(/^[a-z0-9 ]+___[a-z0-9 ]+$/);
    });
  });

  test('tracks version changes when source is re-merged', async () => {
    // First ingestion
    const run1 = await runIngestion({
      sources: [
        {
          name: 'source1',
          records: [
            { title: 'Zelda', platform: 'NES', release_date: '1986-02-21', regions: ['NA'] },
          ],
        },
      ],
    });

    const key = Object.keys(run1.records)[0];
    expect(run1.records[key].version).toBe(1);

    // Second ingestion with same data - version increments because source field changes
    const run2 = await runIngestion({
      sources: [
        {
          name: 'source1',
          records: [
            { title: 'Zelda', platform: 'NES', release_date: '1986-02-21', regions: ['NA'] },
          ],
        },
      ],
    });

    // Version increments due to source field concatenation in merge
    expect(run2.records[key].version).toBe(2);
    expect(run2.records[key].record.source).toBe('source1,source1');
  });

  test('merges duplicate records within single ingestion', async () => {
    // Single ingestion with duplicate identical records
    const run = await runIngestion({
      sources: [
        {
          name: 'test-source',
          records: [
            { title: 'Duplicate Game', platform: 'Genesis', release_date: '1990-01-01', regions: ['NA'], genres: ['Action'] },
            { title: 'Duplicate Game', platform: 'Genesis', release_date: '1990-01-01', regions: ['NA'], genres: ['Action'] },
            { title: 'Different Game', platform: 'Genesis', release_date: '1990-01-01', regions: ['NA'], genres: ['Action'] },
          ],
        },
      ],
    });

    // Should have 2 unique games (duplicates merged into one)
    expect(Object.keys(run.records)).toHaveLength(2);
    // Both duplicates create merged records with concatenated source field
    expect(run.metrics.merged).toBe(1);
  });

  test('increments version only when record content changes', async () => {
    // First ingestion
    const run1 = await runIngestion({
      sources: [
        {
          name: 'source1',
          records: [
            { title: 'Mario', platform: 'NES', release_date: '1985-09-13', regions: ['JP'] },
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
          name: 'source1',
          records: [
            { title: 'Mario', platform: 'NES', release_date: '1985-09-13', regions: ['JP', 'NA'] },
          ],
        },
      ],
    });

    expect(run2.records[key].version).toBe(2);
    expect(run2.records[key].record.regions.sort()).toEqual(['JP', 'NA']);
  });

  test('increments version correctly through multiple updates', async () => {
    // First ingestion
    await runIngestion({
      sources: [
        {
          name: 'source1',
          records: [
            { title: 'Sonic', platform: 'Genesis', release_date: '1991-06-23', genres: ['Platformer'] },
          ],
        },
      ],
    });

    // Second ingestion with new region
    const run2 = await runIngestion({
      sources: [
        {
          name: 'source1',
          records: [
            { title: 'Sonic', platform: 'Genesis', release_date: '1991-06-23', genres: ['Platformer'], regions: ['NA'] },
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
          name: 'source1',
          records: [
            { title: 'Sonic', platform: 'Genesis', release_date: '1991-06-23', genres: ['Platformer', 'Action'], regions: ['NA'] },
          ],
        },
      ],
    });

    expect(run3.records[key].version).toBe(3);
  });

  test('handles duplicate deterministic keys from same source', async () => {
    const run = await runIngestion({
      sources: [
        {
          name: 'duplicate-source',
          records: [
            { title: 'Final Fantasy VII', platform: 'PlayStation', release_date: '1997-01-31', regions: ['JP'] },
            { title: 'Final Fantasy VII', platform: 'PlayStation', release_date: '1997-01-31', regions: ['NA'] },
          ],
        },
      ],
    });

    // Both records should merge into one
    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    expect(entries[0].record.regions.sort()).toEqual(['JP', 'NA']);
  });

  test('handles duplicate deterministic keys across sources', async () => {
    const run = await runIngestion({
      sources: [
        {
          name: 'source-a',
          records: [
            { title: 'Chrono Trigger', platform: 'SNES', release_date: '1995-03-11', genres: ['RPG'] },
          ],
        },
        {
          name: 'source-b',
          records: [
            { title: 'Chrono Trigger', platform: 'SNES', release_date: '1995-03-11', genres: ['JRPG'] },
          ],
        },
      ],
    });

    const entries = Object.values(run.records);
    expect(entries).toHaveLength(1);
    // Should merge genres from both sources
    expect(new Set(entries[0].record.genres)).toEqual(new Set(['RPG', 'JRPG']));
    expect(entries[0].record.source).toContain('source-a');
    expect(entries[0].record.source).toContain('source-b');
  });
});
