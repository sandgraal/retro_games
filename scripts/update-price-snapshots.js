#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  loadEnv,
  ensureFileExists,
  readGames,
  readCache,
  writeCache,
  hoursSince,
  ensureFetch,
} = require("./shared/ingestion.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "games.csv");
const CACHE_PATH = path.join(ROOT, "data", "pricecharting-cache.json");
const CONSOLE_MAP_PATH = path.join(ROOT, "data", "pricecharting-console-map.json");
const DEFAULT_PRICE_BASE = "https://www.pricecharting.com/api";
const CACHE_HISTORY_LIMIT = 64;
const DEFAULT_REFRESH_HOURS = 24;
const REQUEST_DELAY_MS = 600;
const SOURCE = "pricecharting";
const REGION_FACTORS = {
  NTSC: { loose: 1, cib: 1, new: 1 },
  PAL: { loose: 1.12, cib: 1.1, new: 1.15 },
  JPN: { loose: 0.85, cib: 0.88, new: 0.92 },
};

function parseArgs(argv) {
  const options = {
    limit: Infinity,
    filter: null,
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit" && argv[i + 1]) {
      options.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === "--filter" && argv[i + 1]) {
      options.filter = argv[i + 1].toLowerCase();
      i += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }
  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    options.limit = Infinity;
  }
  return options;
}

function readConsoleMap() {
  try {
    const raw = fs.readFileSync(CONSOLE_MAP_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const normalized = {};
    Object.entries(parsed).forEach(([key, value]) => {
      normalized[key.toUpperCase()] = value;
    });
    return normalized;
  } catch (err) {
    console.warn(
      "⚠️  Unable to load PriceCharting console map. Continuing without hints.",
      err.message
    );
    return {};
  }
}

function resolvePrimaryRegion(game) {
  if (Array.isArray(game.regionCodes) && game.regionCodes.length) {
    if (game.regionCodes.includes("NTSC")) return "NTSC";
    if (game.regionCodes.includes("PAL")) return "PAL";
    if (game.regionCodes.includes("JPN")) return "JPN";
  }
  return "NTSC";
}

function resolveConsole(platform, map) {
  if (!platform) return "";
  const upper = platform.toUpperCase();
  return map[upper] || platform;
}

async function fetchProduct({ name, platform }, queryConsole, baseUrl, token) {
  const fetchImpl = await ensureFetch();
  const queryParts = [name];
  if (queryConsole) {
    queryParts.push(queryConsole);
  } else if (platform) {
    queryParts.push(platform);
  }
  const query = encodeURIComponent(queryParts.filter(Boolean).join(" "));
  const url = `${baseUrl.replace(/\/$/, "")}/product?t=${encodeURIComponent(token)}&q=${query}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PriceCharting request failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  if (!payload || payload.status !== "success") {
    throw new Error(payload?.message || "PriceCharting returned an error");
  }
  return payload;
}

function toSnapshot(game, payload, regionCode) {
  const now = new Date();
  return {
    game_key: game.key,
    game_name: game.name,
    platform: game.platform,
    product_id: payload.id || null,
    product_name: payload["product-name"] || game.name,
    console_name: payload["console-name"] || null,
    currency: "USD",
    loose_price_cents: normalizePrice(payload["loose-price"]),
    cib_price_cents: normalizePrice(payload["cib-price"]),
    new_price_cents: normalizePrice(payload["new-price"]),
    source: SOURCE,
    snapshot_date: now.toISOString().slice(0, 10),
    fetched_at: now.toISOString(),
    region_code: regionCode || "NTSC",
    metadata: {
      release_date: payload["release-date"] || null,
    },
  };
}

function normalizePrice(value) {
  if (value === null || value === undefined) return null;
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function updateCacheRecord(cache, snapshot) {
  const key = snapshot.game_key;
  const entry = cache[key] || { snapshots: [] };
  entry.game_name = snapshot.game_name;
  entry.platform = snapshot.platform;
  entry.product_id = snapshot.product_id;
  entry.console_name = snapshot.console_name;
  entry.lastFetched = snapshot.fetched_at;
  const history = Array.isArray(entry.snapshots) ? entry.snapshots : [];
  history.push({
    snapshot_date: snapshot.snapshot_date,
    loose_price_cents: snapshot.loose_price_cents,
    cib_price_cents: snapshot.cib_price_cents,
    new_price_cents: snapshot.new_price_cents,
  });
  entry.snapshots = history.slice(-CACHE_HISTORY_LIMIT);
  cache[key] = entry;
}

async function persistSnapshotSupabase(snapshot, endpoint, serviceKey) {
  if (!endpoint || !serviceKey) return false;
  const fetchImpl = await ensureFetch();
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${text}`);
  }
  return true;
}

function multiplyPrice(value, factor) {
  if (!Number.isFinite(value) || !Number.isFinite(factor)) return null;
  return Math.round(value * factor);
}

async function persistVariantPricesSupabase(game, snapshot, endpoint, serviceKey) {
  if (!endpoint || !serviceKey) return false;
  const fetchImpl = await ensureFetch();
  const regions = Array.isArray(game.regionCodes) ? game.regionCodes : [];
  const baseRegion = snapshot.region_code || resolvePrimaryRegion(game);
  const variants = regions.filter((code) => code && code !== baseRegion);
  if (!variants.length) return false;
  const payload = variants.map((code) => {
    const factors = REGION_FACTORS[code] || REGION_FACTORS.NTSC;
    return {
      game_key: game.key,
      region_code: code,
      currency: snapshot.currency,
      loose_price_cents: multiplyPrice(snapshot.loose_price_cents, factors.loose),
      cib_price_cents: multiplyPrice(snapshot.cib_price_cents, factors.cib),
      new_price_cents: multiplyPrice(snapshot.new_price_cents, factors.new),
      source: snapshot.source,
      snapshot_date: snapshot.snapshot_date,
    };
  });
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Variant upsert failed (${response.status}): ${text}`);
  }
  return true;
}

function selectGames(games, cache, options, refreshHours) {
  const decorated = games.map((game) => {
    const cached = cache[game.key];
    return {
      ...game,
      lastFetched: cached?.lastFetched || null,
      ageHours: hoursSince(cached?.lastFetched || 0),
    };
  });
  const candidates = decorated
    .filter((entry) => options.force || entry.ageHours >= refreshHours)
    .sort((a, b) => {
      if (!a.lastFetched && b.lastFetched) return -1;
      if (!b.lastFetched && a.lastFetched) return 1;
      return a.ageHours - b.ageHours;
    });
  if (!candidates.length && !options.force) {
    console.log(
      `All tracked games were refreshed in the last ${refreshHours}h. Pass --force to override.`
    );
  }
  return candidates.slice(0, options.limit === Infinity ? undefined : options.limit);
}

async function sleep(ms) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnv(ROOT);
  const options = parseArgs(process.argv.slice(2));
  const priceToken = (process.env.PRICECHARTING_TOKEN || "").trim();
  if (!priceToken) {
    console.error("❌ PRICECHARTING_TOKEN missing. Update your .env file.");
    process.exit(1);
  }
  ensureFileExists(CSV_PATH, "games.csv");
  const priceBase = (process.env.PRICECHARTING_BASE_URL || DEFAULT_PRICE_BASE).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  const supabaseEndpoint = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_price_snapshots`
    : null;
  const variantEndpoint = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_variant_prices`
    : null;
  const consoleMap = readConsoleMap();
  const games = readGames(CSV_PATH, options.filter);
  const cache = readCache(CACHE_PATH);
  const refreshHours = Number.parseInt(
    process.env.PRICECHARTING_REFRESH_HOURS || DEFAULT_REFRESH_HOURS,
    10
  );
  const targets = selectGames(games, cache, options, refreshHours);
  if (!targets.length) {
    console.log("No games selected for refresh.");
    return;
  }

  console.log(
    `Fetching PriceCharting data for ${targets.length} game(s).${
      options.dryRun ? " (dry run)" : ""
    }`
  );
  let success = 0;
  let failures = 0;
  for (const game of targets) {
    const consoleHint = resolveConsole(game.platform, consoleMap);
    try {
      const payload = await fetchProduct(game, consoleHint, priceBase, priceToken);
      const primaryRegion = resolvePrimaryRegion(game);
      const snapshot = toSnapshot(game, payload, primaryRegion);
      updateCacheRecord(cache, snapshot);
      if (!options.dryRun) {
        await persistSnapshotSupabase(snapshot, supabaseEndpoint, serviceKey);
        await persistVariantPricesSupabase(game, snapshot, variantEndpoint, serviceKey);
      }
      success += 1;
      console.log(
        `✅ ${game.name} [${game.platform}] – Loose $${formatDollars(
          snapshot.loose_price_cents
        )}`
      );
    } catch (err) {
      failures += 1;
      console.warn(`⚠️  ${game.name} [${game.platform}] failed: ${err.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (!options.dryRun) {
    writeCache(CACHE_PATH, cache);
  }
  console.log(`Done. ${success} succeeded, ${failures} failed.`);
}

function formatDollars(cents) {
  if (!Number.isFinite(cents)) return "-";
  return (cents / 100).toFixed(2);
}

main().catch((err) => {
  console.error("❌ Unexpected error", err);
  process.exit(1);
});
