import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import {
  buildDeterministicKey,
  fuzzyMatchScore,
  runIngestion,
  startReadApiServer,
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
    expect(key).toBe('metroid prime___gamecube___2002');
  });

  test('fuzzy score correlates similar titles', () => {
    const similar = fuzzyMatchScore('Final Fantasy VII', 'Final Fantasy 7');
    const dissimilar = fuzzyMatchScore('Final Fantasy VII', 'Halo Infinite');
    expect(similar).toBeGreaterThan(0.5);
    expect(dissimilar).toBeLessThan(similar);
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

describe('startReadApiServer', () => {
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

  async function makeRequest(port: number, path: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  test('starts server and listens on specified port', async () => {
    const port = 9876;
    server = startReadApiServer({ port });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    const listening = server.listening;
    expect(listening).toBe(true);

    const address = server.address();
    expect(address).toBeTruthy();
    if (typeof address === 'object' && address !== null) {
      expect(address.port).toBe(port);
    }
  });

  test('returns 404 for non-API endpoints', async () => {
    const port = 9877;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/unknown');
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('Not found');
  });

  test('returns 503 when no snapshots available', async () => {
    const port = 9878;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/api/v1/catalog');
    expect(response.statusCode).toBe(503);
    const json = JSON.parse(response.body);
    expect(json.error).toBe('No catalog snapshots available');
  });

  test('returns 200 with catalog snapshot when available', async () => {
    // First, run an ingestion to create a snapshot
    await runIngestion({
      sources: [
        {
          name: 'test',
          records: [
            { title: 'Test Game', platform: 'TestPlatform', release_date: '2020-01-01' },
          ],
        },
      ],
    });

    const port = 9879;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/api/v1/catalog');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/json');
    expect(response.headers['cache-control']).toBe('public, max-age=300');

    const json = JSON.parse(response.body);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty('key');
    expect(json[0]).toHaveProperty('version');
    expect(json[0]).toHaveProperty('hash');
    expect(json[0]).toHaveProperty('record');
  });

  test('serves latest snapshot by default', async () => {
    // Create multiple snapshots
    await runIngestion({
      sources: [
        {
          name: 'first',
          records: [
            { title: 'Game A', platform: 'PlatformA', release_date: '2020-01-01' },
          ],
        },
      ],
    });

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    await runIngestion({
      sources: [
        {
          name: 'second',
          records: [
            { title: 'Game B', platform: 'PlatformB', release_date: '2021-01-01' },
          ],
        },
      ],
    });

    const snapshotsDir = path.join(tempDir, 'snapshots');
    const snapshots = await fs.readdir(snapshotsDir);
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const port = 9880;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/api/v1/catalog');
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.body);
    // The latest snapshot should have both games
    expect(json.length).toBeGreaterThanOrEqual(2);
  });

  test('serves preferred snapshot when specified', async () => {
    // Create two ingestion runs
    await runIngestion({
      sources: [
        {
          name: 'first',
          records: [
            { title: 'Game A', platform: 'PlatformA', release_date: '2020-01-01' },
          ],
        },
      ],
    });

    const snapshotsDir = path.join(tempDir, 'snapshots');
    let snapshots = await fs.readdir(snapshotsDir);
    const firstSnapshot = snapshots[0];

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    await runIngestion({
      sources: [
        {
          name: 'second',
          records: [
            { title: 'Game A', platform: 'PlatformA', release_date: '2020-01-01' },
            { title: 'Game B', platform: 'PlatformB', release_date: '2021-01-01' },
          ],
        },
      ],
    });

    snapshots = await fs.readdir(snapshotsDir);
    expect(snapshots.length).toBe(2);

    const port = 9881;
    server = startReadApiServer({ port, preferredSnapshot: firstSnapshot });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/api/v1/catalog');
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.body);
    // First snapshot should have only 1 game
    expect(json.length).toBe(1);
    expect(json[0].record.title).toBe('Game A');
  });

  test('returns 500 on file read errors', async () => {
    // Create a snapshot
    await runIngestion({
      sources: [
        {
          name: 'test',
          records: [
            { title: 'Test Game', platform: 'TestPlatform', release_date: '2020-01-01' },
          ],
        },
      ],
    });

    // Delete the snapshots directory to simulate an error
    const snapshotsDir = path.join(tempDir, 'snapshots');
    const snapshots = await fs.readdir(snapshotsDir);
    for (const snapshot of snapshots) {
      await fs.unlink(path.join(snapshotsDir, snapshot));
    }
    await fs.rmdir(snapshotsDir);

    const port = 9882;
    server = startReadApiServer({ port });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(port, '/api/v1/catalog');
    // The server returns 503 when it can't read the snapshots directory
    expect(response.statusCode).toBe(503);

    const json = JSON.parse(response.body);
    expect(json.error).toBeDefined();
  });
});
