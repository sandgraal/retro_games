import { createHash } from "crypto";
import { promises as fs } from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePaths() {
  const dataDir = path.resolve(
    process.env.CATALOG_DATA_DIR || path.join(__dirname, "data")
  );
  return {
    dataDir,
    mergeDecisionsPath: path.join(dataDir, "merge-decisions.json"),
    catalogStorePath: path.join(dataDir, "catalog-store.json"),
    ingestionLogPath: path.join(dataDir, "ingestion-log.json"),
    snapshotsDir: path.join(dataDir, "snapshots"),
  };
}

const DEFAULT_CONFIG = {
  scheduleMinutes: 1440,
  fuzzyThreshold: 0.82,
  sources: [],
};

function safeString(value) {
  return (value || "").toString().trim();
}

function normalizeTitle(title) {
  return safeString(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function releaseYear(releaseDate) {
  if (!releaseDate) return "unknown";
  const year = new Date(releaseDate).getUTCFullYear();
  return Number.isNaN(year) ? "unknown" : String(year);
}

export function buildDeterministicKey(record) {
  const normalizedTitle = normalizeTitle(record.title);
  const normalizedPlatform = normalizeTitle(record.platform || record.platform_slug);
  const year = releaseYear(record.release_date);
  return `${normalizedTitle}___${normalizedPlatform}___${year}`;
}

function bigramSet(value) {
  const normalized = normalizeTitle(value);
  const grams = new Set();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.add(normalized.slice(i, i + 2));
  }
  return grams;
}

export function fuzzyMatchScore(a, b) {
  const aSet = bigramSet(a);
  const bSet = bigramSet(b);
  const intersection = [...aSet].filter((gram) => bSet.has(gram)).length;
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function stableStringify(value) {
  const seen = new WeakSet();
  const stringify = (val) => {
    if (val && typeof val === "object") {
      if (seen.has(val)) return '"[circular]"';
      seen.add(val);
      if (Array.isArray(val)) {
        return `[${val.map(stringify).join(",")}]`;
      }
      const entries = Object.keys(val)
        .sort()
        .map((key) => `"${key}":${stringify(val[key])}`);
      return `{${entries.join(",")}}`;
    }
    if (typeof val === "string") return JSON.stringify(val);
    return String(val);
  };
  return stringify(value);
}

export function computeRecordHash(record) {
  return createHash("sha256").update(stableStringify(record)).digest("hex");
}

async function ensureFiles() {
  const {
    dataDir,
    snapshotsDir,
    mergeDecisionsPath,
    catalogStorePath,
    ingestionLogPath,
  } = resolvePaths();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(snapshotsDir, { recursive: true });
  for (const [filePath, fallback] of [
    [mergeDecisionsPath, {}],
    [catalogStorePath, { records: {}, lastRun: null }],
    [ingestionLogPath, []],
  ]) {
    try {
      await fs.access(filePath);
    } catch (error) {
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
    }
  }
}

async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function normalizeRecord(raw, sourceName) {
  return {
    title: safeString(raw.title || raw.name),
    platform: safeString(raw.platform || raw.platform_name),
    platform_slug: safeString(raw.platform_slug || raw.platform),
    release_date: raw.release_date || raw.releaseDate || null,
    regions: raw.regions || raw.region ? [].concat(raw.regions || raw.region) : [],
    genres: raw.genres || raw.genre ? [].concat(raw.genres || raw.genre) : [],
    esrb: raw.esrb || raw.rating || null,
    pegi: raw.pegi || null,
    assets: raw.assets || {
      cover: raw.cover_url || null,
      screenshots: raw.screenshots || [],
    },
    external_ids: raw.external_ids || { igdb: raw.igdb_id, giantbomb: raw.giantbomb_id },
    source: sourceName,
    source_id: raw.id || raw.slug || raw.external_id || null,
  };
}

function mergeRecords(base, incoming) {
  return {
    ...base,
    regions: Array.from(new Set([...(base.regions || []), ...(incoming.regions || [])])),
    genres: Array.from(new Set([...(base.genres || []), ...(incoming.genres || [])])),
    assets: {
      cover: incoming.assets?.cover || base.assets?.cover || null,
      screenshots: Array.from(
        new Set([
          ...(base.assets?.screenshots || []),
          ...(incoming.assets?.screenshots || []),
        ])
      ),
    },
    external_ids: {
      ...(base.external_ids || {}),
      ...(incoming.external_ids || {}),
    },
    esrb: incoming.esrb || base.esrb || null,
    pegi: incoming.pegi || base.pegi || null,
    release_date: incoming.release_date || base.release_date || null,
    source: `${base.source},${incoming.source}`,
  };
}

async function fetchSourceRecords(source) {
  if (source.records) {
    return source.records;
  }
  if (!source.url) return [];
  const response = await fetch(source.url, { headers: source.headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function evaluateMatch(record, existingRecords, decisions, threshold) {
  const deterministicKey = buildDeterministicKey(record);
  if (existingRecords[deterministicKey]) {
    return { key: deterministicKey, deterministicKey, reason: "deterministic" };
  }

  const priorDecision = decisions[deterministicKey];
  if (priorDecision && existingRecords[priorDecision]) {
    return { key: priorDecision, deterministicKey, reason: "decision" };
  }

  let best = { key: null, score: 0 };
  for (const [key, value] of Object.entries(existingRecords)) {
    const titleScore = fuzzyMatchScore(record.title, value.record.title);
    const platformScore = fuzzyMatchScore(record.platform, value.record.platform);
    const score = (titleScore * 0.7 + platformScore * 0.3).toFixed(3);
    const numericScore = Number(score);
    if (numericScore > best.score) {
      best = { key, score: numericScore };
    }
  }
  if (best.score >= threshold) {
    return { key: best.key, deterministicKey, reason: "fuzzy", score: best.score };
  }
  return { key: deterministicKey, deterministicKey, reason: "new" };
}

function buildSnapshot(records) {
  return Object.entries(records).map(([key, payload]) => ({
    key,
    version: payload.version,
    hash: payload.hash,
    record: payload.record,
  }));
}

export async function runIngestion(configOverrides = {}) {
  await ensureFiles();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const { mergeDecisionsPath, catalogStorePath, ingestionLogPath, snapshotsDir } =
    resolvePaths();
  const mergeDecisions = await readJson(mergeDecisionsPath, {});
  const catalogStore = await readJson(catalogStorePath, { records: {}, lastRun: null });

  const metrics = {
    fetched: 0,
    normalized: 0,
    merged: 0,
    upserted: 0,
    unchanged: 0,
    snapshotPath: null,
  };

  const records = { ...catalogStore.records };

  for (const source of config.sources) {
    try {
      const rawRecords = await fetchSourceRecords(source);
      metrics.fetched += rawRecords.length;
      for (const raw of rawRecords) {
        const normalized = normalizeRecord(raw, source.name);
        metrics.normalized += 1;
        const { key, reason, deterministicKey } = evaluateMatch(
          normalized,
          records,
          mergeDecisions,
          config.fuzzyThreshold
        );
        if (!records[key]) {
          records[key] = {
            record: normalized,
            hash: computeRecordHash(normalized),
            version: 1,
            lastSeen: new Date().toISOString(),
          };
          if (reason === "fuzzy") {
            mergeDecisions[deterministicKey] = key;
          }
          metrics.upserted += 1;
          continue;
        }
        const merged = mergeRecords(records[key].record, normalized);
        const hash = computeRecordHash(merged);
        if (hash !== records[key].hash) {
          records[key] = {
            ...records[key],
            record: merged,
            hash,
            version: records[key].version + 1,
            lastSeen: new Date().toISOString(),
          };
          metrics.upserted += 1;
        } else {
          metrics.unchanged += 1;
        }
        metrics.merged += 1;
        mergeDecisions[deterministicKey] = key;
      }
    } catch (error) {
      console.error(`[ingest] Source ${source.name} failed:`, error.message);
    }
  }

  const snapshot = buildSnapshot(records);
  const snapshotPath = path.join(
    snapshotsDir,
    `catalog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  metrics.snapshotPath = snapshotPath;

  await fs.writeFile(mergeDecisionsPath, JSON.stringify(mergeDecisions, null, 2));
  await fs.writeFile(
    catalogStorePath,
    JSON.stringify({ records, lastRun: new Date().toISOString() }, null, 2)
  );

  const ingestionLog = await readJson(ingestionLogPath, []);
  ingestionLog.push({ ...metrics, completedAt: new Date().toISOString() });
  await fs.writeFile(ingestionLogPath, JSON.stringify(ingestionLog, null, 2));

  return { records, metrics, snapshotPath };
}

export function startReadApiServer({ port = 8787, preferredSnapshot } = {}) {
  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith("/api/v1/catalog")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      await ensureFiles();
      const { snapshotsDir } = resolvePaths();
      const snapshots = await fs.readdir(snapshotsDir);
      if (!snapshots.length) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: "No catalog snapshots available" }));
        return;
      }
      const target =
        preferredSnapshot && snapshots.includes(preferredSnapshot)
          ? path.join(snapshotsDir, preferredSnapshot)
          : path.join(snapshotsDir, snapshots.sort().at(-1));
      const payload = await fs.readFile(target, "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      });
      res.end(payload);
    } catch (error) {
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error: "Failed to load catalog snapshot",
          detail: error.message,
        })
      );
    }
  });
  server.listen(port, () => {
    console.log(`[catalog-api] listening on http://localhost:${port}/api/v1/catalog`);
  });
  return server;
}

async function runCli() {
  const args = process.argv.slice(2);
  const configPath = args.includes("--config")
    ? args[args.indexOf("--config") + 1]
    : null;
  const once = args.includes("--once");
  const serve = args.includes("--serve");
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 ? Number(args[portIndex + 1]) : undefined;

  const config = configPath
    ? { ...DEFAULT_CONFIG, ...(await readJson(configPath, {})) }
    : DEFAULT_CONFIG;

  if (once) {
    const result = await runIngestion(config);
    console.log("[ingest] run complete", result.metrics);
  }

  if (serve) {
    startReadApiServer({ port });
  }

  if (!once && !serve) {
    const interval = setInterval(
      () => runIngestion(config),
      config.scheduleMinutes * 60 * 1000
    );
    await runIngestion(config);
    console.log(`[ingest] scheduled every ${config.scheduleMinutes} minutes`);
    process.on("SIGINT", () => {
      clearInterval(interval);
      process.exit(0);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
