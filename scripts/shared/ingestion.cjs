const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");

function loadEnv(rootPath) {
  const envFile = path.join(rootPath, ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

function ensureFileExists(filePath, friendlyName) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing ${friendlyName}: ${filePath}`);
    process.exit(1);
  }
}

function buildGameKey(name, platform) {
  if (!name || !platform) return null;
  return `${name}___${platform}`;
}

function resolveRegionCodes(raw) {
  if (!raw) return [];
  const normalized = raw.toString().toLowerCase();
  const codes = new Set();
  if (/ntsc|usa|north america|canada/.test(normalized)) codes.add("NTSC");
  if (/pal|europe|uk|australia/.test(normalized)) codes.add("PAL");
  if (/jpn|japan/.test(normalized)) codes.add("JPN");
  return Array.from(codes);
}

function readGames(csvPath, filter) {
  ensureFileExists(csvPath, "games.csv");
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const unique = new Map();
  records.forEach((row) => {
    const name = row["Game Name"]?.trim();
    const platform = row["Platform"]?.trim();
    const key = buildGameKey(name, platform);
    if (!key || unique.has(key)) return;
    if (filter && !key.toLowerCase().includes(filter)) return;
    unique.set(key, {
      key,
      name,
      platform,
      regionRaw: row["Region"]?.trim() || "",
      regionCodes: resolveRegionCodes(row["Region"]?.trim()),
    });
  });
  return Array.from(unique.values());
}

function readCache(cachePath, logger = console) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch (error) {
    logger.warn(
      `Failed to parse cache file at ${cachePath}; ignoring cache and continuing.`,
      error
    );
    return {};
  }
}

function writeCache(cachePath, content) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(content, null, 2));
}

function hoursSince(timestamp) {
  if (!timestamp) return Infinity;
  const diff = Date.now() - new Date(timestamp).getTime();
  return diff / (1000 * 60 * 60);
}

async function ensureFetch() {
  if (typeof fetch === "function") return fetch;
  const { default: fetchImpl } = await import("node-fetch");
  global.fetch = fetchImpl;
  return fetchImpl;
}

function normalizeRefreshHours(value, defaultValue) {
  const parsed = Number.parseInt(value ?? defaultValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

module.exports = {
  loadEnv,
  ensureFileExists,
  buildGameKey,
  resolveRegionCodes,
  readGames,
  readCache,
  writeCache,
  hoursSince,
  ensureFetch,
  normalizeRefreshHours,
};
