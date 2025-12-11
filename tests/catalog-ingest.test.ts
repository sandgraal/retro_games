import { describe, expect, test, beforeEach, afterEach } from 'vitest';
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

  test('fuzzy score handles empty strings', () => {
    const score1 = fuzzyMatchScore('', '');
    const score2 = fuzzyMatchScore('', 'Some Game');
    const score3 = fuzzyMatchScore('Some Game', '');
    expect(score1).toBe(0);
    expect(score2).toBe(0);
    expect(score3).toBe(0);
  });

  test('fuzzy score handles single-character strings', () => {
    const score1 = fuzzyMatchScore('A', 'A');
    const score2 = fuzzyMatchScore('A', 'B');
    const score3 = fuzzyMatchScore('A', 'Another Game');
    expect(score1).toBe(0);
    expect(score2).toBe(0);
    expect(score3).toBe(0);
  });

  test('fuzzy score handles two-character strings', () => {
    const score1 = fuzzyMatchScore('AB', 'AB');
    const score2 = fuzzyMatchScore('AB', 'ABC');
    const score3 = fuzzyMatchScore('AB', 'XY');
    expect(score1).toBe(1); // Identical bigram
    expect(score2).toBeGreaterThan(0); // Partial match
    expect(score3).toBe(0); // No match
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
});
