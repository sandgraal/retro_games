#!/usr/bin/env node
const path = require("path");
const {
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
} = require("./shared/ingestion.cjs");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "games.csv");
const CACHE_PATH = path.join(ROOT, "data", "ebay-price-cache.json");
const DEFAULT_REFRESH_HOURS = 24;
const CACHE_HISTORY_LIMIT = 64;
const REQUEST_DELAY_MS = 850;
const SOURCE = "ebay";
const EBAY_ENDPOINT = "https://svcs.ebay.com/services/search/FindingService/v1";

class SkipEbayPriceError extends Error {
  constructor(message) {
    super(message);
    this.name = "SkipEbayPriceError";
    this.isSkip = true;
  }
}

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

function resolvePrimaryRegion(game) {
  if (Array.isArray(game.regionCodes) && game.regionCodes.length) {
    if (game.regionCodes.includes("NTSC")) return "NTSC";
    if (game.regionCodes.includes("PAL")) return "PAL";
    if (game.regionCodes.includes("JPN")) return "JPN";
  }
  return "NTSC";
}

function buildSearchQuery(game) {
  return [game.name, game.platform].filter(Boolean).join(" ");
}

function toCents(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

async function fetchEbayPrice(game, appId, globalId) {
  const fetchImpl = await ensureFetch();
  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords: buildSearchQuery(game),
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "HideDuplicateItems",
    "itemFilter(1).value": "true",
    "paginationInput.entriesPerPage": "24",
    sortOrder: "EndTimeSoonest",
    "GLOBAL-ID": globalId,
  });
  const url = `${EBAY_ENDPOINT}?${params.toString()}`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay request failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  const root = payload?.findCompletedItemsResponse?.[0];
  if (!root || root.ack?.[0] !== "Success") {
    throw new Error(
      root?.errorMessage?.[0]?.error?.[0]?.message?.[0] || "eBay returned an error"
    );
  }
  const items = root.searchResult?.[0]?.item || [];
  const cents = items
    .map((item) => item?.sellingStatus?.[0]?.currentPrice?.[0])
    .filter((price) => price && price["@currencyId"] === "USD")
    .map((price) => toCents(price.__value__))
    .filter((value) => Number.isFinite(value));
  const selected = median(cents);
  if (!Number.isFinite(selected)) {
    throw new SkipEbayPriceError(
      `No sold prices in USD found (GLOBAL-ID=${globalId}); skipping`
    );
  }
  return { price_cents: selected, sampleSize: cents.length };
}

function updateCacheRecord(cache, snapshot) {
  const key = snapshot.game_key;
  const entry = cache[key] || {
    key,
    name: snapshot.game_name,
    platform: snapshot.platform,
  };
  const history = Array.isArray(entry.snapshots) ? entry.snapshots : [];
  history.push({
    snapshot_date: snapshot.snapshot_date,
    loose_price_cents: snapshot.loose_price_cents,
    cib_price_cents: snapshot.cib_price_cents,
    new_price_cents: snapshot.new_price_cents,
  });
  entry.snapshots = history.slice(-CACHE_HISTORY_LIMIT);
  entry.lastFetched = snapshot.fetched_at;
  entry.source = snapshot.source;
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
  const REGION_FACTORS = {
    NTSC: { loose: 1, cib: 1, new: 1 },
    PAL: { loose: 1.12, cib: 1.1, new: 1.15 },
    JPN: { loose: 0.85, cib: 0.88, new: 0.92 },
  };
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

function buildSnapshot(game, cents, sampleSize) {
  const now = new Date();
  return {
    game_key: game.key,
    game_name: game.name,
    platform: game.platform,
    currency: "USD",
    loose_price_cents: cents,
    cib_price_cents: null,
    new_price_cents: null,
    source: SOURCE,
    snapshot_date: now.toISOString().slice(0, 10),
    fetched_at: now.toISOString(),
    region_code: resolvePrimaryRegion(game),
    metadata: {
      ebay_sample_size: sampleSize,
      region_inferred: resolvePrimaryRegion(game),
    },
  };
}

async function main() {
  loadEnv(ROOT);
  const options = parseArgs(process.argv.slice(2));
  ensureFileExists(CSV_PATH, "games.csv");
  const ebayAppId = (process.env.EBAY_APP_ID || "").trim();
  if (!ebayAppId) {
    console.error("❌ EBAY_APP_ID missing. Update your .env file.");
    process.exit(1);
  }
  const ebayGlobalId = (process.env.EBAY_GLOBAL_ID || "EBAY-US").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  const supabaseEndpoint = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_price_snapshots`
    : null;
  const variantEndpoint = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_variant_prices`
    : null;
  const refreshHours = normalizeRefreshHours(
    process.env.EBAY_REFRESH_HOURS,
    DEFAULT_REFRESH_HOURS
  );

  const games = readGames(CSV_PATH, options.filter);
  const cache = readCache(CACHE_PATH);
  const targets = selectGames(games, cache, options, refreshHours);
  if (!targets.length) {
    console.log("No games selected for refresh.");
    return;
  }

  console.log(
    `Fetching eBay sold listings for ${targets.length} game(s).${options.dryRun ? " (dry run)" : ""}`
  );
  let success = 0;
  let failures = 0;
  let skipped = 0;
  for (const game of targets) {
    try {
      const { price_cents: cents, sampleSize } = await fetchEbayPrice(
        game,
        ebayAppId,
        ebayGlobalId
      );
      const snapshot = buildSnapshot(game, cents, sampleSize);
      updateCacheRecord(cache, snapshot);
      if (!options.dryRun) {
        await persistSnapshotSupabase(snapshot, supabaseEndpoint, serviceKey);
        await persistVariantPricesSupabase(game, snapshot, variantEndpoint, serviceKey);
      }
      success += 1;
      console.log(
        `✅ ${game.name} [${game.platform}] – Median sold $${(cents / 100).toFixed(2)} (${sampleSize})`
      );
    } catch (err) {
      if (err instanceof SkipEbayPriceError || err?.isSkip) {
        skipped += 1;
        console.info(`ℹ️  ${game.name} [${game.platform}] skipped: ${err.message}`);
      } else {
        failures += 1;
        console.warn(`⚠️  ${game.name} [${game.platform}] failed: ${err.message}`);
      }
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (!options.dryRun) {
    writeCache(CACHE_PATH, cache);
  }
  console.log(`Done. ${success} succeeded, ${failures} failed, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error("❌ Unexpected error", err);
  process.exit(1);
});
