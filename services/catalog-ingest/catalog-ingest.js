import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import * as jose from "jose";

// Supabase client for database operations
import {
  initSupabase,
  insertSubmission,
  fetchSubmissions,
  updateSubmissionDecision,
  insertAuditLog,
  startIngestionRun,
  completeIngestionRun,
  syncGamesToSupabase,
} from "./supabase-client.js";

// Source adapters
let rawgAdapter = null;
let igdbAdapter = null;
try {
  rawgAdapter = await import("./sources/rawg.js");
} catch {
  // RAWG adapter not available - will use generic fetch
}
try {
  igdbAdapter = await import("./sources/igdb.js");
} catch {
  // IGDB adapter not available - will use generic fetch
}

// Initialize Supabase connection
const { enabled: supabaseEnabled, client: supabaseClient } = initSupabase();

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
    suggestionsPath: path.join(dataDir, "suggestions.json"),
    auditLogPath: path.join(dataDir, "audit-log.json"),
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
  return `${normalizedTitle}___${normalizedPlatform}`;
}
/**
 * Creates a set of bigrams (2-character pairs) from the given value.
 * Edge cases:
 * - Empty strings or strings with only whitespace return an empty set
 * - Single-character strings return an empty set
 * - This means very short titles will have zero similarity with any other title
 * @param {string} value - The string to create bigrams from
 * @returns {Set<string>} A set of 2-character bigrams
 */
function bigramSet(value) {
  const normalized = normalizeTitle(value);
  const grams = new Set();
  // Strings with length < 2 will have no bigrams, resulting in fuzzy score of 0
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
    suggestionsPath,
    auditLogPath,
  } = resolvePaths();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(snapshotsDir, { recursive: true });
  for (const [filePath, fallback] of [
    [mergeDecisionsPath, {}],
    [catalogStorePath, { records: {}, lastRun: null }],
    [ingestionLogPath, []],
    [suggestionsPath, { suggestions: [] }],
    [auditLogPath, []],
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

/**
 * Substitutes ${VAR} patterns in an object with environment variable values.
 * Recursively processes nested objects and arrays.
 */
function substituteEnvVars(obj) {
  if (typeof obj === "string") {
    // Replace ${VAR} patterns with environment variable values
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        console.warn(`[config] Environment variable ${varName} is not set`);
        return match; // Keep original if not found
      }
      return value;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  if (obj !== null && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  return obj;
}

async function readSuggestions() {
  const { suggestionsPath } = resolvePaths();
  return readJson(suggestionsPath, { suggestions: [] });
}

async function writeSuggestions(payload) {
  const { suggestionsPath } = resolvePaths();
  await fs.writeFile(suggestionsPath, JSON.stringify(payload, null, 2));
}

async function appendAudit(entry) {
  const { auditLogPath } = resolvePaths();
  const existing = await readJson(auditLogPath, []);
  existing.push(entry);
  await fs.writeFile(auditLogPath, JSON.stringify(existing, null, 2));
}

function normalizeRole(rawRole) {
  const allowed = ["anonymous", "contributor", "moderator", "admin"];
  const role = typeof rawRole === "string" ? rawRole.toLowerCase() : "anonymous";
  return allowed.includes(role) ? role : "anonymous";
}

/**
 * Fallback JWT verification using Node's crypto module
 * Used when jose's jwtVerify fails (e.g., in jsdom test environments)
 * @param {string} token - The JWT token
 * @param {string} secret - The secret key
 * @returns {object|null} - The payload if valid, null otherwise
 */
function verifyJwtWithCrypto(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Recreate the signature
    const data = `${headerB64}.${payloadB64}`;
    const expectedSignature = createHash
      ? null
      : require("crypto")
          .createHmac("sha256", secret)
          .update(data)
          .digest("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

    // Use imported createHash (crypto module)
    const crypto = require("crypto");
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    // Constant-time comparison
    if (
      computedSignature.length !== signatureB64.length ||
      !crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureB64))
    ) {
      return null;
    }

    // Decode and parse payload
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate and extract authentication info from request
 * Validates JWT from Authorization header and extracts role from token claims
 * @param {http.IncomingMessage} req - HTTP request object
 * @returns {Promise<{role: string, email: string|null, sessionId: string}>}
 */
async function resolveAuth(req) {
  // Extract JWT from Authorization header (Node.js lowercases header names)
  const authHeader = req.headers.authorization;

  // If no authorization header, return anonymous
  if (!authHeader || typeof authHeader !== "string") {
    return {
      role: "anonymous",
      email: null,
      sessionId: `sess_${randomUUID()}`,
    };
  }

  // Extract Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      role: "anonymous",
      email: null,
      sessionId: `sess_${randomUUID()}`,
    };
  }

  const token = parts[1];

  // Get JWT secret from environment
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.warn("SUPABASE_JWT_SECRET not configured - authentication disabled");
    return {
      role: "anonymous",
      email: null,
      sessionId: `sess_${randomUUID()}`,
    };
  }

  let payload = null;

  // Try jose first, fall back to crypto-based verification
  try {
    // Verify JWT signature with jose
    const secret = new TextEncoder().encode(jwtSecret);
    const result = await jose.jwtVerify(token, secret, {
      algorithms: ["HS256"],
      // Validate issuer matches Supabase URL if configured
      ...(process.env.SUPABASE_URL && { issuer: process.env.SUPABASE_URL }),
    });
    payload = result.payload;
  } catch {
    // Fallback to crypto-based verification (handles jsdom Uint8Array issues)
    payload = verifyJwtWithCrypto(token, jwtSecret);
    if (!payload) {
      console.warn("Authentication failed - invalid or expired token");
      return {
        role: "anonymous",
        email: null,
        sessionId: `sess_${randomUUID()}`,
      };
    }
  }

  // Extract role from token claims - require explicit role assignment
  const role = normalizeRole(
    payload.app_metadata?.role || payload.user_metadata?.role || "anonymous"
  );

  // Extract email from token
  const email = payload.email || null;

  // Use sub (subject) as session ID if available
  const sessionId = payload.sub || `sess_${randomUUID()}`;

  return {
    role,
    email,
    sessionId,
  };
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let isDone = false;
    req.on("data", (chunk) => {
      if (isDone) return;
      data += chunk;
      // Basic guard against huge payloads
      if (data.length > 1e6) {
        isDone = true;
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (isDone) return;
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

/**
 * Normalizes a raw game record by standardizing field names and values.
 * Handles various field name variants from different data sources and community submissions:
 * - title: title, name, game_name
 * - platform: platform, platform_name, platform_slug
 * - platform_slug: platform_slug, platform
 * - release_date: release_date, releaseDate, release_year
 * - esrb: esrb, rating, esrb_rating
 * - genres: genres, genre (array or single value)
 * - regions: regions, region (array or single value)
 *
 * Fallback and coupling behavior:
 *   - For `platform` and `platform_slug`, if only one of these fields is provided in the input,
 *     both `platform` and `platform_slug` in the output will be set to that value.
 *   - If both are provided, their respective values are used.
 *   - The fallback order for `platform` is: platform, platform_name, platform_slug.
 *   - The fallback order for `platform_slug` is: platform_slug, platform.
 *
 * Example:
 *   If input is { platform_slug: "snes" }, then output will have
 *     platform: "snes", platform_slug: "snes"
 *   If input is { platform: "snes" }, then output will have
 *     platform: "snes", platform_slug: "snes"
 *   If input is { platform: "snes", platform_slug: "super-nintendo" }, then output will have
 *     platform: "snes", platform_slug: "super-nintendo"
 */
function normalizeRecord(raw, sourceName) {
  return {
    title: safeString(raw.title || raw.name || raw.game_name),
    platform: safeString(raw.platform || raw.platform_name || raw.platform_slug),
    platform_slug: safeString(raw.platform_slug || raw.platform),
    release_date: raw.release_date || raw.releaseDate || raw.release_year || null,
    regions: raw.regions || raw.region ? [].concat(raw.regions || raw.region) : [],
    genres: Array.isArray(raw.genres)
      ? raw.genres
      : raw.genres
        ? [raw.genres]
        : Array.isArray(raw.genre)
          ? raw.genre
          : raw.genre
            ? [raw.genre]
            : [],
    esrb: raw.esrb || raw.rating || raw.esrb_rating || null,
    pegi: raw.pegi || null,
    assets: raw.assets || {
      cover: raw.cover_url || null,
      screenshots: raw.screenshots || [],
    },
    external_ids: raw.external_ids || { igdb: raw.igdb_id, giantbomb: raw.giantbomb_id },
    source: [sourceName],
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
    source: Array.from(new Set([...(base.source || []), ...(incoming.source || [])])),
  };
}

// Only allow safe headers to be sent in fetch requests
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return undefined;
  // Whitelist of allowed header names (case-insensitive)
  const allowed = [
    "accept",
    "accept-language",
    "content-type",
    "user-agent",
    "x-requested-with",
    "referer",
    "origin",
  ];
  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (
      typeof key === "string" &&
      allowed.includes(key.toLowerCase()) &&
      typeof value === "string"
    ) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

async function fetchSourceRecords(source) {
  // If records are provided inline (for testing), use them directly
  if (source.records) {
    return source.records;
  }

  // Use source-specific adapters
  if (source.type === "igdb" && igdbAdapter) {
    return igdbAdapter.fetchIgdbSource(source);
  }
  if (source.type === "rawg" && rawgAdapter) {
    return rawgAdapter.fetchRawgSource(source);
  }

  // Generic URL-based fetch
  if (!source.url) return [];
  const safeHeaders = sanitizeHeaders(source.headers);
  const response = await fetch(source.url, { headers: safeHeaders });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function buildPlatformIndex(existingRecords) {
  const index = {};
  for (const [key, value] of Object.entries(existingRecords)) {
    const normalizedPlatform = normalizeTitle(value.record.platform || "");
    if (!index[normalizedPlatform]) {
      index[normalizedPlatform] = [];
    }
    index[normalizedPlatform].push({ key, value });
  }
  return index;
}

function updatePlatformIndex(platformIndex, key, recordValue, oldPlatform = null) {
  const newPlatform = normalizeTitle(recordValue.record.platform || "");

  // If platform changed, remove from old bucket
  if (oldPlatform && oldPlatform !== newPlatform) {
    const oldBucket = platformIndex[oldPlatform];
    if (oldBucket) {
      const oldIndex = oldBucket.findIndex((entry) => entry.key === key);
      if (oldIndex !== -1) {
        oldBucket.splice(oldIndex, 1);
      }
    }
  }

  // Add or update in new/current bucket
  if (!platformIndex[newPlatform]) {
    platformIndex[newPlatform] = [];
  }

  const bucket = platformIndex[newPlatform];
  const existingEntry = bucket.find((entry) => entry.key === key);

  if (existingEntry) {
    // Update existing entry
    existingEntry.value = recordValue;
  } else {
    // Add new entry
    bucket.push({ key, value: recordValue });
  }
}

function evaluateMatch(record, existingRecords, decisions, threshold, platformIndex) {
  const deterministicKey = buildDeterministicKey(record);
  if (existingRecords[deterministicKey]) {
    return { key: deterministicKey, deterministicKey, reason: "deterministic" };
  }

  const priorDecision = decisions[deterministicKey];
  if (priorDecision && existingRecords[priorDecision]) {
    return { key: priorDecision, deterministicKey, reason: "decision" };
  }

  let best = { key: null, score: 0 };
  const normalizedPlatform = normalizeTitle(record.platform || "");
  const platformBucket = platformIndex[normalizedPlatform] || [];

  for (const { key, value } of platformBucket) {
    const titleScore = fuzzyMatchScore(record.title, value.record.title);
    const platformScore = fuzzyMatchScore(record.platform, value.record.platform);
    const score = titleScore * 0.7 + platformScore * 0.3;
    if (score > best.score) {
      best = { key, score };
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

export function applyApprovedSuggestions(records, suggestions) {
  let applied = 0;
  for (const suggestion of suggestions) {
    if (suggestion.status !== "approved") continue;
    const delta = suggestion.delta || suggestion.payload || {};
    if (
      suggestion.type === "update" &&
      suggestion.targetId &&
      records[suggestion.targetId]
    ) {
      const merged = { ...records[suggestion.targetId].record, ...delta };
      const hash = computeRecordHash(merged);
      if (hash !== records[suggestion.targetId].hash) {
        records[suggestion.targetId] = {
          ...records[suggestion.targetId],
          record: merged,
          hash,
          version: records[suggestion.targetId].version + 1,
          lastSeen: new Date().toISOString(),
        };
        applied += 1;
      }
    } else if (suggestion.type === "new") {
      // Pass delta directly to normalizeRecord which handles all field name variants
      const normalized = normalizeRecord(
        {
          ...delta,
        },
        "community"
      );
      const key =
        suggestion.targetId ||
        buildDeterministicKey({
          title: normalized.title,
          platform: normalized.platform,
        });
      const hash = computeRecordHash(normalized);
      if (!records[key]) {
        records[key] = {
          record: normalized,
          hash,
          version: 1,
          lastSeen: new Date().toISOString(),
        };
        applied += 1;
      }
    }
  }
  return applied;
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
    suggestionsApplied: 0,
    snapshotPath: null,
  };

  const records = { ...catalogStore.records };
  let platformIndex = buildPlatformIndex(records);

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
          config.fuzzyThreshold,
          platformIndex
        );
        if (!records[key]) {
          const newRecord = {
            record: normalized,
            hash: computeRecordHash(normalized),
            version: 1,
            lastSeen: new Date().toISOString(),
          };
          records[key] = newRecord;
          updatePlatformIndex(platformIndex, key, newRecord);

          if (reason === "fuzzy") {
            mergeDecisions[deterministicKey] = key;
          }
          metrics.upserted += 1;
          continue;
        }
        const oldPlatform = normalizeTitle(records[key].record.platform || "");
        const merged = mergeRecords(records[key].record, normalized);
        const hash = computeRecordHash(merged);
        if (hash !== records[key].hash) {
          const updatedRecord = {
            ...records[key],
            record: merged,
            hash,
            version: records[key].version + 1,
            lastSeen: new Date().toISOString(),
          };
          records[key] = updatedRecord;
          updatePlatformIndex(platformIndex, key, updatedRecord, oldPlatform);

          metrics.upserted += 1;
        } else {
          metrics.unchanged += 1;
        }
        metrics.merged += 1;
        mergeDecisions[deterministicKey] = key;
      }
    } catch (error) {
      let extra = "";
      if (source.url) {
        extra += `\n  Source URL: ${source.url}`;
      }
      if (error.statusCode || error.status) {
        extra += `\n  Status: ${error.statusCode || error.status}`;
      }
      if (error.body) {
        extra += `\n  Response body: ${typeof error.body === "string" ? error.body : JSON.stringify(error.body)}`;
      }
      console.error(`[ingest] Source ${source.name} failed: ${error.message}${extra}`);
    }
  }

  const { suggestions } = await readSuggestions();
  metrics.suggestionsApplied = applyApprovedSuggestions(records, suggestions);

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

  // Sync to Supabase if enabled
  if (supabaseEnabled && supabaseClient && config.syncToSupabase !== false) {
    console.log("[supabase] Syncing catalog to Supabase...");
    const gamesToSync = Object.values(records).map((r) => r.record);
    const { synced, errors } = await syncGamesToSupabase(supabaseClient, gamesToSync);
    metrics.supabaseSynced = synced;
    if (errors.length > 0) {
      console.warn(`[supabase] ${errors.length} sync errors:`, errors[0]?.message);
    }
    console.log(`[supabase] Synced ${synced} games to Supabase`);
  }

  return { records, metrics, snapshotPath };
}

export function startReadApiServer({ port = 8787, preferredSnapshot } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      await ensureFiles();
      if (!req.url || !req.url.startsWith("/api/v1")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const { catalogStorePath } = resolvePaths();

      if (
        req.method === "POST" &&
        /^\/api\/v1\/games\/[^/]+\/suggestions$/.test(url.pathname)
      ) {
        const match = url.pathname.match(/^\/api\/v1\/games\/([^/]+)\/suggestions$/);
        const targetId = match ? decodeURIComponent(match[1]) : null;
        if (!targetId) {
          sendJson(res, 400, { error: "Invalid or missing targetId in URL" });
          return;
        }
        const auth = await resolveAuth(req);
        const body = await parseJsonBody(req);
        const delta = "delta" in body ? body.delta : body;
        if (!delta || typeof delta !== "object") {
          sendJson(res, 400, { error: "Missing suggestion payload" });
          return;
        }
        const store = await readSuggestions();
        const suggestion = {
          id: randomUUID(),
          type: "update",
          targetId,
          delta,
          status: "pending",
          author: auth,
          submittedAt: new Date().toISOString(),
          notes: body.notes || null,
        };
        store.suggestions.push(suggestion);
        await writeSuggestions(store);

        // Also write to Supabase if enabled
        if (supabaseEnabled && supabaseClient) {
          const { error: sbError } = await insertSubmission(supabaseClient, suggestion);
          if (sbError) {
            console.warn("[supabase] Failed to sync submission:", sbError.message);
          }
        }

        sendJson(res, 201, { suggestion });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/games/new") {
        const auth = await resolveAuth(req);
        const body = await parseJsonBody(req);
        const delta = body.delta || body;
        if (!delta?.title && !delta?.game_name) {
          sendJson(res, 400, { error: "New game submissions require a title" });
          return;
        }
        const store = await readSuggestions();
        const suggestion = {
          id: randomUUID(),
          type: "new",
          targetId: null,
          delta,
          status: "pending",
          author: auth,
          submittedAt: new Date().toISOString(),
          notes: body.notes || null,
        };
        store.suggestions.push(suggestion);
        await writeSuggestions(store);

        // Also write to Supabase if enabled
        if (supabaseEnabled && supabaseClient) {
          const { error: sbError } = await insertSubmission(supabaseClient, suggestion);
          if (sbError) {
            console.warn("[supabase] Failed to sync submission:", sbError.message);
          }
        }

        sendJson(res, 201, { suggestion });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/moderation/suggestions") {
        const auth = await resolveAuth(req);
        if (!["moderator", "admin"].includes(auth.role)) {
          sendJson(res, 403, { error: "Moderator access required" });
          return;
        }

        // Default to pending suggestions; allow overriding via ?status= query param
        const statusFilter = url.searchParams?.get("status") || "pending";

        const catalogStore = await readJson(catalogStorePath, { records: {} });
        const { suggestions } = await readSuggestions();

        const filtered = suggestions.filter((entry) =>
          statusFilter ? entry.status === statusFilter : true
        );

        const enriched = filtered.map((entry) => ({
          ...entry,
          canonical: entry.targetId
            ? catalogStore.records[entry.targetId]?.record || null
            : null,
        }));

        sendJson(res, 200, { suggestions: enriched });
        return;
      }

      if (
        req.method === "POST" &&
        url.pathname.startsWith("/api/v1/moderation/suggestions/") &&
        url.pathname.endsWith("/decision")
      ) {
        const auth = await resolveAuth(req);
        if (!["moderator", "admin"].includes(auth.role)) {
          sendJson(res, 403, { error: "Moderator access required" });
          return;
        }
        // Extract suggestionId using regex for robustness
        const match = url.pathname.match(
          /^\/api\/v1\/moderation\/suggestions\/([^/]+)\/decision$/
        );
        if (!match) {
          sendJson(res, 400, { error: "Invalid suggestion decision URL" });
          return;
        }
        const suggestionId = match[1];
        const body = await parseJsonBody(req);
        if (!body?.status || !["approved", "rejected"].includes(body.status)) {
          sendJson(res, 400, { error: "Decision status must be approved or rejected" });
          return;
        }
        const store = await readSuggestions();
        const target = store.suggestions.find((entry) => entry.id === suggestionId);
        if (!target) {
          sendJson(res, 404, { error: "Suggestion not found" });
          return;
        }
        target.status = body.status;
        target.moderationNotes = body.notes || null;
        target.decidedAt = new Date().toISOString();
        await writeSuggestions(store);
        const auditEntry = {
          suggestionId,
          decision: body.status,
          notes: target.moderationNotes,
          moderator: auth,
          timestamp: target.decidedAt,
        };
        await appendAudit(auditEntry);

        // Sync decision to Supabase if enabled
        if (supabaseEnabled && supabaseClient) {
          const { error: decisionError } = await updateSubmissionDecision(
            supabaseClient,
            suggestionId,
            body.status === "approved" ? "approved" : "rejected",
            auth.sessionId,
            body.notes || null
          );
          if (decisionError) {
            console.warn("[supabase] Failed to sync decision:", decisionError.message);
          }

          // Also log to audit table
          const { error: auditError } = await insertAuditLog(supabaseClient, {
            tableName: "catalog_submissions",
            recordId: suggestionId,
            action: body.status === "approved" ? "approve" : "reject",
            newData: { status: body.status, notes: body.notes },
            userId: auth.sessionId,
            reason: body.notes,
          });
          if (auditError) {
            console.warn("[supabase] Failed to log audit:", auditError.message);
          }
        }

        sendJson(res, 200, { suggestion: target, audit: auditEntry });
        return;
      }

      if (!url.pathname.startsWith("/api/v1/catalog")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

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
          detail: "Internal server error",
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
  let configPath = null;
  if (args.includes("--config")) {
    const configIndex = args.indexOf("--config");
    const nextArg = args[configIndex + 1];
    if (nextArg === undefined || nextArg.startsWith("--")) {
      console.error("Error: --config flag must be followed by a valid path.");
      process.exit(1);
    }
    configPath = nextArg;
  }
  const once = args.includes("--once");
  const serve = args.includes("--serve");
  const portIndex = args.indexOf("--port");
  let port = portIndex !== -1 ? args[portIndex + 1] : undefined;
  if (port !== undefined) {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      console.error(
        `[ingest] Invalid port: "${port}". Port must be an integer between 1 and 65535.`
      );
      process.exit(1);
    }
    port = Number(port);
  }

  const rawConfig = configPath
    ? { ...DEFAULT_CONFIG, ...(await readJson(configPath, {})) }
    : DEFAULT_CONFIG;

  // Substitute ${VAR} patterns with environment variable values
  const config = substituteEnvVars(rawConfig);

  if (once) {
    const result = await runIngestion(config);
    console.log("[ingest] run complete", result.metrics);
  }

  if (serve) {
    startReadApiServer({ port });
  }

  if (!once && !serve) {
    try {
      const result = await runIngestion(config);
      console.log("[ingest] initial run complete", result.metrics);
    } catch (error) {
      console.error("[ingest] initial run failed:", error.message);
      console.error(error.stack);
      process.exit(1);
    }

    const interval = setInterval(
      async () => {
        try {
          const result = await runIngestion(config);
          console.log("[ingest] scheduled run complete", result.metrics);
        } catch (error) {
          console.error("[ingest] scheduled run failed:", error.message);
          console.error(error.stack);
        }
      },
      config.scheduleMinutes * 60 * 1000
    );
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
