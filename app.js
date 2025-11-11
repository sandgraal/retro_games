// @ts-check

/*
  Sandgraal's Game List
  Author: Chris Sandgraal
  Github: https://github.com/sandgraal/retro_games
  Description: Retro ROM tracker and game explorer.
  2024-06
*/

// === Column Names and Keys ===

/**
 * @typedef {Object} GameRow
 * @property {string} [game_name]
 * @property {string} [platform]
 * @property {string} [genre]
 * @property {string} [cover]
 * @property {string|number} [rating]
 * @property {string|number} [release_year]
 * @property {string} [Details]
 * @property {string[]} [screenshots]
 * @property {string} [storage_bucket]
 * @property {string} [storage_path]
 * @property {string} [region_code]
 * @property {string[]} [region_codes]
 * @property {Record<string, any>} [key: string]
 */

/** @typedef {Record<string, string>} StatusMap */
/** @typedef {Record<string, string>} NoteMap */
/**
 * @typedef {Object} FilterState
 * @property {string} [filterStatus]
 * @property {string} [filterRatingMin]
 * @property {string} [filterYearStart]
 * @property {string} [filterYearEnd]
 * @property {string} [filterRegion]
 */
const COL_GAME = "game_name";
const COL_PLATFORM = "platform";
const COL_GENRE = "genre";
const COL_COVER = "cover";
const COL_RATING = "rating";
const COL_RELEASE_YEAR = "release_year";
const STORAGE_KEY = "roms_owned";
const NOTES_STORAGE_KEY = "rom_notes";
const STATUS_NONE = "none";
const STATUS_OWNED = "owned";
const STATUS_WISHLIST = "wishlist";
const STATUS_BACKLOG = "backlog";
const STATUS_TRADE = "trade";
const THEME_STORAGE_KEY = "rom_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const TYPEAHEAD_MIN_CHARS = 2;
const TYPEAHEAD_DEBOUNCE_MS = 180;
const TYPEAHEAD_LIMIT = 8;
const TYPEAHEAD_SELECT_COLUMNS = [COL_GAME, COL_PLATFORM, COL_GENRE, COL_RELEASE_YEAR]
  .map((column) => column.trim())
  .filter(Boolean)
  .join(",");

const STATUS_OPTIONS = [
  { value: STATUS_NONE, label: "None" },
  { value: STATUS_OWNED, label: "Owned" },
  { value: STATUS_WISHLIST, label: "Wishlist" },
  { value: STATUS_BACKLOG, label: "Backlog" },
  { value: STATUS_TRADE, label: "Trade" },
];
const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const SAMPLE_DATA_URL = "./data/sample-games.json";
const BACKUP_FILENAME = "sandgraal-collection.json";
const FILTER_STORAGE_KEY = "rom_filters";

// === Supabase Config ===
const SUPABASE_CONFIG = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_URL = SUPABASE_CONFIG.url || "";
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || "";
const DEFAULT_SUPABASE_TABLES = ["games", "games_view", "games_new"];
const SUPABASE_STREAM_PAGE_SIZE = resolveStreamPageSize();
const STREAM_PREFETCH_THRESHOLD = 0.65;
const DEFAULT_GENRE_RPC = "rpc_genre_counts";
const DEFAULT_TIMELINE_RPC = "rpc_timeline_counts";
const BROWSE_MODE_INFINITE = "stream";
const BROWSE_MODE_PAGED = "paged";
const BROWSE_PREFS_KEY = "rom_browse_prefs";
const PAGE_SIZE_CHOICES = [30, 60, 120];
const DEFAULT_PAGE_SIZE = 60;
const INFINITE_ROOT_MARGIN = "800px 0px 800px 0px";
const BROWSE_PRESERVE_PREFIXES = ["pager:", "infinite:", "stream:"];
const BROWSE_PRESERVE_REASONS = new Set(["status-select", "note-save"]);
const VIRTUALIZE_MIN_ITEMS = 80;
const VIRTUAL_DEFAULT_CARD_HEIGHT = 360;
const VIRTUAL_OVERSCAN_ROWS = 2;
const VIRTUAL_SCROLL_THROTTLE_MS = 80;
const FALLBACK_COVER_CACHE_KEY = "rom_cover_cache_v1";
const FALLBACK_COVER_CACHE_LIMIT = 400;
const FALLBACK_COVER_RETRY_MS = 1000 * 60 * 60 * 24 * 7;
const FALLBACK_COVER_ATTEMPT_LIMIT = 25;
const DEFAULT_STORAGE_PUBLIC_BUCKET = "game-covers";
const DEFAULT_STORAGE_PENDING_BUCKET = "media-pending";
const REGION_CODES = ["NTSC", "PAL", "JPN"];
const REGION_LABELS = {
  NTSC: "NTSC",
  PAL: "PAL",
  JPN: "JPN",
};
const REGION_PATTERNS = {
  NTSC: ["ntsc", "usa", "north america", "canada"],
  PAL: ["pal", "europe", "eu", "uk", "australia"],
  JPN: ["jpn", "japan"],
};
const REGION_MATCHERS = {
  NTSC: [/(^|\b)(ntsc|usa|north america|canada)(\b|$)/i],
  PAL: [/(^|\b)(pal|europe|eu|uk|australia)(\b|$)/i],
  JPN: [/(^|\b)(jpn|japan)(\b|$)/i],
};

const CONTRIBUTION_MAX_BYTES = 25 * 1024 * 1024;
const CONTRIBUTION_ALLOWED_TYPES = {
  image: ["image/png", "image/jpeg"],
  manual: ["application/pdf"],
  video: ["video/mp4"],
};
const PRICE_SAMPLE_URL = "./data/sample-price-history.json";
const VARIANT_PRICE_SAMPLE_URL = "./data/sample-variant-prices.json";
const PRICE_LATEST_VIEW = "game_price_latest";
const PRICE_SNAPSHOT_TABLE = "game_price_snapshots";
const PRICE_FETCH_CHUNK = 200;
const PRICE_HISTORY_PAD = 8;
const PRICE_STATUS_KEYS = [STATUS_OWNED, STATUS_WISHLIST, STATUS_BACKLOG, STATUS_TRADE];
const PRICE_SOURCE = "pricecharting";
const currencyFormatterWhole =
  typeof Intl !== "undefined"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : null;
const currencyFormatterPrecise =
  typeof Intl !== "undefined"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

/**
 * Format an integer (in cents) as a localized currency string.
 * Falls back to a basic USD representation when Intl is unavailable.
 * @param {number|string|null|undefined} value
 * @param {{ precise?: boolean }} [options]
 * @returns {string}
 */
function formatCurrencyFromCents(value, { precise = false } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const dollars = precise ? numeric / 100 : Math.round(numeric / 100);
  const formatter = precise ? currencyFormatterPrecise : currencyFormatterWhole;
  if (formatter) {
    return formatter.format(dollars);
  }
  const amount = precise ? (numeric / 100).toFixed(2) : dollars.toString();
  return `$${amount}`;
}
const PLATFORM_NAME_ALIASES = {
  SNES: ["Super Nintendo Entertainment System"],
  NES: ["Nintendo Entertainment System"],
  N64: ["Nintendo 64"],
  "NINTENDO 64": ["Nintendo 64"],
  "NINTENDO SWITCH": ["Nintendo Switch"],
  GAMECUBE: ["Nintendo GameCube", "GameCube"],
  GENESIS: ["Sega Genesis", "Mega Drive"],
  "MEGA DRIVE": ["Sega Genesis", "Mega Drive"],
  SATURN: ["Sega Saturn"],
  DREAMCAST: ["Sega Dreamcast", "Dreamcast"],
  PLAYSTATION: ["PlayStation", "PS1"],
  "PLAYSTATION 2": ["PlayStation 2", "PS2"],
  "PLAYSTATION 3": ["PlayStation 3", "PS3"],
  "PLAYSTATION 4": ["PlayStation 4", "PS4"],
  "PLAYSTATION 5": ["PlayStation 5", "PS5"],
  "XBOX 360": ["Xbox 360"],
  "XBOX ONE": ["Xbox One"],
  "XBOX SERIES X": ["Xbox Series X", "Xbox Series S", "Xbox Series X/S"],
  "XBOX SERIES S": ["Xbox Series S", "Xbox Series X", "Xbox Series X/S"],
  "GAME BOY": ["Game Boy"],
  "GAME BOY ADVANCE": ["Game Boy Advance"],
  "GAME BOY COLOR": ["Game Boy Color"],
  "NINTENDO DS": ["Nintendo DS"],
  "NINTENDO 3DS": ["Nintendo 3DS"],
  "MS-DOS": ["MS-DOS"],
  PC: ["Windows", "PC game", "PC"],
  ARCADE: ["Arcade game", "Arcade"],
  "ATARI 2600": ["Atari 2600"],
};
const PRICECHARTING_CONFIG = SUPABASE_CONFIG.pricing || {};
const PRICECHARTING_TOKEN = (PRICECHARTING_CONFIG.token || "").trim();
const PRICECHARTING_CURRENCY = (PRICECHARTING_CONFIG.currency || "USD")
  .toString()
  .trim()
  .toUpperCase();
const PRICECHARTING_CACHE_HOURS = Number(PRICECHARTING_CONFIG.cacheHours);
const PRICE_CACHE_TTL_MS =
  Number.isFinite(PRICECHARTING_CACHE_HOURS) && PRICECHARTING_CACHE_HOURS > 0
    ? PRICECHARTING_CACHE_HOURS * 60 * 60 * 1000
    : 1000 * 60 * 60 * 12;
const PRICE_CACHE_KEY = "rom_price_quotes_v1";
const PRICE_HISTORY_LIMIT = 40;
const PRICE_FETCH_CONCURRENCY = 2;
const PRICE_API_BASE_URL = "https://www.pricecharting.com";
const VALUATION_HISTORY_KEY = "rom_collection_valuation_history_v1";
const VALUATION_HISTORY_LIMIT = 120;
const STORAGE_CONFIG = SUPABASE_CONFIG.storage || {};
const STORAGE_PUBLIC_BUCKET =
  STORAGE_CONFIG.publicBucket || DEFAULT_STORAGE_PUBLIC_BUCKET;
const STORAGE_PENDING_BUCKET =
  STORAGE_CONFIG.pendingBucket || DEFAULT_STORAGE_PENDING_BUCKET;
const STORAGE_CDN_URL = (
  STORAGE_CONFIG.cdnUrl ||
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1` : "")
).replace(/\/$/, "");
const STORAGE_PUBLIC_BASE = STORAGE_CDN_URL ? `${STORAGE_CDN_URL}/object/public` : "";
const fallbackCoverCache = loadFallbackCoverCache();
const priceInsights = createPriceInsights();
const variantPriceMap = new Map();

const reduceMotionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const registeredCarouselWindows = new Set();

const FIELD_ALIAS_MAP = {
  [COL_GAME]: [COL_GAME, "gameName", "Game Name"],
  [COL_PLATFORM]: [COL_PLATFORM, "Platform"],
  [COL_GENRE]: [COL_GENRE, "Genre"],
  [COL_RELEASE_YEAR]: [COL_RELEASE_YEAR, "releaseYear", "Release Year"],
  [COL_RATING]: [COL_RATING, "Rating"],
  [COL_COVER]: [
    COL_COVER,
    "cover_url",
    "coverUrl",
    "Cover",
    "cover_path",
    "cover_storage_path",
    "coverPublicUrl",
    "cover_public_url",
  ],
  screenshots: ["screenshots", "Screenshots"],
  ratingCategory: ["rating_category", "ratingCategory", "Rating Category"],
  playerMode: ["player_mode", "playerMode", "Player Mode"],
  playerCount: ["player_count", "playerCount", "Player Count"],
  region: [
    "region",
    "Region",
    "region_code",
    "regionCode",
    "region_codes",
    "regionCodes",
  ],
  notes: ["notes", "Notes"],
  detailsUrl: ["details_url", "detailsUrl", "Details", "details"],
};
let carouselControlsBound = false;
const PERF_BUFFER_LIMIT = 50;
const perfMetrics = [];
const perfState = {
  debug:
    (typeof window !== "undefined" && !!window.__SANDGRAAL_DEBUG_METRICS__) ||
    (typeof globalThis !== "undefined" && !!globalThis.__SANDGRAAL_DEBUG_METRICS__),
};

function getNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function recordPerfMetric(name, duration, extra = {}) {
  const safeDuration = Number.isFinite(duration) ? Number(duration.toFixed(2)) : duration;
  const entry = {
    name,
    duration: safeDuration,
    timestamp: Date.now(),
    ...extra,
  };
  perfMetrics.push(entry);
  if (perfMetrics.length > PERF_BUFFER_LIMIT) perfMetrics.shift();
  if (perfState.debug && typeof console !== "undefined") {
    console.info("[perf]", name, `${safeDuration}ms`, extra);
  }
}

function exposePerfInterface() {
  if (typeof window === "undefined") return;
  window.__SANDGRAAL_PERF__ = {
    get buffer() {
      return [...perfMetrics];
    },
    enableDebug() {
      perfState.debug = true;
    },
    disableDebug() {
      perfState.debug = false;
    },
    clear() {
      perfMetrics.length = 0;
    },
  };
}

exposePerfInterface();

const SUPABASE_TABLE_CANDIDATES = (() => {
  const configuredTables = [];
  if (Array.isArray(SUPABASE_CONFIG.tables)) {
    configuredTables.push(...SUPABASE_CONFIG.tables);
  }
  if (typeof SUPABASE_CONFIG.tableName === "string") {
    configuredTables.push(SUPABASE_CONFIG.tableName);
  }
  const defaults = DEFAULT_SUPABASE_TABLES;
  const deduped = new Set(
    [...configuredTables, ...defaults]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
  );
  return Array.from(deduped);
})();
let forceSampleFlag = false;
if (typeof window !== "undefined") {
  forceSampleFlag = !!window.__SANDGRAAL_FORCE_SAMPLE__;
  try {
    if (window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("sample") === "1") forceSampleFlag = true;
    }
  } catch {
    /* noop */
  }
} else if (typeof globalThis !== "undefined") {
  forceSampleFlag = !!globalThis.__SANDGRAAL_FORCE_SAMPLE__;
}
const FORCE_SAMPLE = forceSampleFlag;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (FORCE_SAMPLE) {
  console.info("Sample dataset forced via __SANDGRAAL_FORCE_SAMPLE__.");
} else if (!supabase) {
  console.warn(
    "Supabase credentials missing. Provide window.__SUPABASE_CONFIG__ in config.js."
  );
}

// === Fetch paged data from Supabase ===
async function fetchGamesPage(
  rangeStart = 0,
  rangeEnd = rangeStart + SUPABASE_STREAM_PAGE_SIZE - 1,
  filters = null
) {
  if (!supabase) {
    throw new Error(
      "Supabase configuration missing. Copy config.example.js to config.js and add your credentials."
    );
  }

  const errors = [];
  const preferredTables = streamState.tableName
    ? [
        streamState.tableName,
        ...SUPABASE_TABLE_CANDIDATES.filter((name) => name !== streamState.tableName),
      ]
    : SUPABASE_TABLE_CANDIDATES;

  for (const tableName of preferredTables) {
    try {
      const selectedFilters = filters || streamState.filterPayload || null;
      let query = supabase.from(tableName).select("*", { count: "exact" });
      query = applySupabaseFilters(query, selectedFilters);
      const sortKey =
        (selectedFilters && selectedFilters.sortColumn) || sortColumn || COL_GAME;
      const sortDir =
        (selectedFilters && selectedFilters.sortDirection) || sortDirection || "asc";
      query = query.order(sortKey, {
        ascending: sortDir !== "desc",
        nullsLast: true,
      });
      query = query.range(Math.max(0, rangeStart), Math.max(rangeStart, rangeEnd));
      const { data, error, count } = await query;
      if (error) {
        throw new Error(`[${tableName}] ${error.message || "Unknown Supabase error"}`);
      }
      if (Array.isArray(data)) {
        if (streamState.tableName !== tableName && streamState.tableName) {
          console.info(`Switched Supabase table to ${tableName} for paged streaming.`);
        }
        return {
          data,
          tableName,
          count: typeof count === "number" ? count : null,
        };
      }
      throw new Error(`[${tableName}] Supabase returned unexpected payload.`);
    } catch (err) {
      errors.push(err);
      console.warn(`Supabase query failed for table ${tableName}:`, err);
    }
  }

  const finalError = new Error(
    `Unable to fetch games from Supabase tables: ${SUPABASE_TABLE_CANDIDATES.join(", ")}`
  );
  finalError.cause = errors;
  throw finalError;
}

async function fetchSampleGames() {
  const response = await fetch(SAMPLE_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Sample data missing or inaccessible.");
  }
  return response.json();
}

async function loadGameData() {
  const useFallback = async (reason) => {
    console.warn("Using local sample data due to Supabase issue:", reason);
    const start = getNow();
    const sample = await fetchSampleGames();
    normalizeIncomingRows(sample);
    recordPerfMetric("data-load", getNow() - start, {
      source: "sample",
      reason: typeof reason === "string" ? reason : reason?.message,
    });
    streamState.enabled = false;
    streamState.active = false;
    streamState.hasMore = false;
    streamState.loading = false;
    resetAggregateState(null);
    streamState.filterPayload = null;
    streamState.filterSignature = null;
    streamState.tableName = null;
    streamState.nextFrom = 0;
    streamState.totalCount = null;
    return { data: sample, source: "sample", reason };
  };

  if (FORCE_SAMPLE || !supabase) {
    return useFallback("Supabase not configured.");
  }

  try {
    const start = getNow();
    const baseFilters = shouldUseServerFiltering() ? buildRemoteFilterPayload() : null;
    const page = await fetchGamesPage(0, streamState.pageSize - 1, baseFilters);
    const data = Array.isArray(page.data) ? page.data : [];
    normalizeIncomingRows(data);
    const duration = getNow() - start;
    if (!data.length) {
      recordPerfMetric("data-load", duration, {
        source: "supabase",
        rows: 0,
        fallback: "empty-dataset",
      });
      streamState.active = false;
      return useFallback("Supabase returned zero rows.");
    }
    initStreamStateFromPage(page, data.length, baseFilters);
    recordPerfMetric("data-load", duration, {
      source: "supabase",
      rows: data.length,
      total: streamState.totalCount || undefined,
    });
    return { data, source: "supabase" };
  } catch (err) {
    streamState.active = false;
    return useFallback(err);
  }
}

let samplePriceDataPromise = null;

async function hydratePriceData(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const keys = Array.from(new Set(rows.map((row) => buildRowKey(row)).filter(Boolean)));
  if (!keys.length) return;
  try {
    let latestRecords = [];
    if (supabase) {
      latestRecords = await fetchLatestPricesFromSupabase(keys);
    } else {
      latestRecords = await fetchLatestPricesFromSample(keys);
      priceState.fallback = true;
    }
    if (!Array.isArray(latestRecords) || !latestRecords.length) return;
    indexLatestPrices(latestRecords);
    priceState.ready = true;
    priceState.summaryDirty = true;
    updateCollectionValueSummary();
  } catch (err) {
    console.warn("Price data unavailable:", err);
    if (!priceState.fallback) {
      try {
        const sampleRecords = await fetchLatestPricesFromSample(keys);
        if (Array.isArray(sampleRecords) && sampleRecords.length) {
          priceState.fallback = true;
          indexLatestPrices(sampleRecords);
          priceState.summaryDirty = true;
          updateCollectionValueSummary();
        }
      } catch (fallbackErr) {
        console.warn("Sample price history unavailable:", fallbackErr);
      }
    }
  }
}

async function fetchLatestPricesFromSupabase(keys) {
  if (!supabase || !keys.length) return [];
  const rows = [];
  for (let i = 0; i < keys.length; i += PRICE_FETCH_CHUNK) {
    const chunk = keys.slice(i, i + PRICE_FETCH_CHUNK);
    const { data, error } = await supabase
      .from(PRICE_LATEST_VIEW)
      .select(
        "game_key, game_name, platform, product_id, product_name, console_name, currency, loose_price_cents, cib_price_cents, new_price_cents, source, snapshot_date, fetched_at"
      )
      .in("game_key", chunk);
    if (error) {
      throw new Error(error.message || "Supabase price lookup failed.");
    }
    if (Array.isArray(data)) rows.push(...data);
  }
  return rows;
}

async function ensureSamplePriceData() {
  if (samplePriceDataPromise) return samplePriceDataPromise;
  if (typeof fetch !== "function") {
    throw new Error("Fetch API unavailable for loading sample pricing data.");
  }
  samplePriceDataPromise = fetch(PRICE_SAMPLE_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Sample price history missing.");
      return response.json();
    })
    .then((payload) => {
      priceState.fallbackLatest = Array.isArray(payload.latest) ? payload.latest : [];
      priceState.fallbackHistory = payload.history || {};
      return priceState.fallbackLatest;
    })
    .catch((err) => {
      samplePriceDataPromise = null;
      throw err;
    });
  return samplePriceDataPromise;
}

async function fetchLatestPricesFromSample(keys) {
  const latest = await ensureSamplePriceData();
  if (!Array.isArray(latest) || !latest.length) return [];
  if (!keys || !keys.length) return latest;
  const keySet = new Set(keys);
  return latest.filter((entry) => entry && keySet.has(entry.game_key));
}

function indexLatestPrices(records) {
  const nextMap = new Map();
  let newestSnapshot = null;
  records.forEach((record) => {
    if (!record || !record.game_key) return;
    nextMap.set(record.game_key, record);
    if (record.snapshot_date) {
      const date = new Date(record.snapshot_date);
      if (!Number.isNaN(date.getTime())) {
        if (!newestSnapshot || date > newestSnapshot) {
          newestSnapshot = date;
        }
      }
    }
  });
  priceState.latest = nextMap;
  priceState.lastUpdated = newestSnapshot;
}

function resolvePriceValue(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (Number.isFinite(entry.cib_price_cents)) return entry.cib_price_cents;
  if (Number.isFinite(entry.loose_price_cents)) return entry.loose_price_cents;
  if (Number.isFinite(entry.new_price_cents)) return entry.new_price_cents;
  return null;
}

async function loadPriceHistory(gameKey) {
  if (!gameKey) return [];
  if (priceState.histories.has(gameKey)) {
    const cached = priceState.histories.get(gameKey);
    return Array.isArray(cached) ? cached : [];
  }
  if (priceState.fallback && priceState.fallbackHistory[gameKey]) {
    const fallbackHistory = normalizeHistoryEntries(priceState.fallbackHistory[gameKey]);
    priceState.histories.set(gameKey, fallbackHistory);
    return fallbackHistory;
  }
  if (!supabase) return [];
  if (priceState.historyRequests.has(gameKey)) {
    return priceState.historyRequests.get(gameKey);
  }
  const historyPromise = (async () => {
    const { data, error } = await supabase
      .from(PRICE_SNAPSHOT_TABLE)
      .select("snapshot_date, loose_price_cents, cib_price_cents, new_price_cents")
      .eq("game_key", gameKey)
      .order("snapshot_date", { ascending: true })
      .limit(PRICE_HISTORY_LIMIT);
    if (error) {
      throw new Error(error.message || "Price history query failed.");
    }
    const normalized = normalizeHistoryEntries(data || []);
    priceState.histories.set(gameKey, normalized);
    return normalized;
  })();
  priceState.historyRequests.set(gameKey, historyPromise);
  return historyPromise.finally(() => priceState.historyRequests.delete(gameKey));
}

function normalizeHistoryEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      snapshot_date: entry.snapshot_date,
      loose_price_cents: normalizeCents(entry.loose_price_cents),
      cib_price_cents: normalizeCents(entry.cib_price_cents),
      new_price_cents: normalizeCents(entry.new_price_cents),
    }))
    .filter((entry) => entry && entry.snapshot_date)
    .sort((a, b) => {
      const timeA = new Date(a.snapshot_date).getTime();
      const timeB = new Date(b.snapshot_date).getTime();
      return timeA - timeB;
    });
}

function normalizeCents(value) {
  if (Number.isFinite(value)) return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function computePriceDelta(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const first = resolvePriceValue(history[0]);
  const last = resolvePriceValue(history[history.length - 1]);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / first) * 100;
}

function initStreamStateFromPage(page, rowsFetched, filterPayload = null) {
  if (!streamState.enabled) {
    streamState.active = false;
    return;
  }
  streamState.active = true;
  streamState.tableName =
    page.tableName || streamState.tableName || SUPABASE_TABLE_CANDIDATES[0];
  if (filterPayload) {
    streamState.filterPayload = { ...filterPayload };
    streamState.filterSignature = buildRemoteFilterSignature(streamState.filterPayload);
  } else if (!streamState.filterPayload) {
    const payload = buildRemoteFilterPayload();
    streamState.filterPayload = { ...payload };
    streamState.filterSignature = buildRemoteFilterSignature(streamState.filterPayload);
  }
  const currentSignature = streamState.filterSignature || null;
  if (currentSignature && aggregateState.signature !== currentSignature) {
    resetAggregateState(currentSignature);
  }
  streamState.nextFrom = rowsFetched;
  streamState.totalCount =
    typeof page.count === "number" && page.count >= rowsFetched
      ? page.count
      : streamState.totalCount;
  if (typeof streamState.totalCount === "number") {
    streamState.hasMore = streamState.nextFrom < streamState.totalCount;
  } else {
    streamState.hasMore = rowsFetched >= streamState.pageSize;
  }
}

/** @type {GameRow[]} */
let rawData = [];
/** @type {StatusMap} */
let gameStatuses = {};
/** @type {NoteMap} */
let gameNotes = {};
/** @type {StatusMap|null} */
let importedCollection = null;
/** @type {NoteMap|null} */
let importedNotes = null;
/** @type {FilterState} */
let persistedFilters = {};
const priceState = {
  latest: new Map(),
  histories: new Map(),
  fallbackHistory: {},
  fallbackLatest: [],
  lastUpdated: null,
  ready: false,
  fallback: false,
  summaryDirty: true,
  historyRequests: new Map(),
};
let filterPlatform = "",
  filterGenre = "",
  searchValue = "",
  filterStatus = "",
  filterRatingMin = "",
  filterYearStart = "",
  filterYearEnd = "",
  filterRegion = "",
  sortColumn = COL_GAME,
  sortDirection = "asc";
let typeaheadTimer = null;
let activeSuggestionRequest = 0;
let hideSuggestionsTimer = null;
const browsePreferences = loadBrowsePreferences();
let browseMode = browsePreferences.mode;
let paginationState = {
  pageSize: browsePreferences.pageSize,
  currentPage: Math.max(1, browsePreferences.page || 1),
  totalItems: 0,
  totalPages: 1,
  renderedCount: browsePreferences.pageSize,
};
let latestSortedData = [];
let infiniteObserver = null;
let infiniteTickScheduled = false;
const virtualizationState = {
  enabled: true,
  active: false,
  sourceData: [],
  container: null,
  visibleStart: 0,
  visibleEnd: 0,
  rowHeight: 0,
  columns: 1,
  topPadding: 0,
  bottomPadding: 0,
  scrollHandler: null,
  resizeHandler: null,
  pendingAnimationFrame: null,
  pendingMeasureFrame: null,
  gridGap: 0,
  lastRenderLength: 0,
  datasetOffset: 0,
};

let contributionModalOpen = false;
const streamState = {
  enabled: !FORCE_SAMPLE && !!supabase,
  active: false,
  pageSize: SUPABASE_STREAM_PAGE_SIZE,
  tableName: null,
  nextFrom: 0,
  totalCount: null,
  hasMore: false,
  loading: false,
  error: null,
  pendingPromise: null,
  filterPayload: null,
  filterSignature: null,
};
const statusRowCache = new Map();
let pendingStatusHydration = null;
let latestFilteredData = [];
const aggregateState = {
  signature: null,
  genres: null,
  timeline: null,
  loading: false,
  promise: null,
};

function resetAggregateState(signature = null) {
  aggregateState.signature = signature;
  aggregateState.genres = null;
  aggregateState.timeline = null;
  aggregateState.loading = false;
  aggregateState.promise = null;
}

/**
 * Parse a year string/number into an integer or null when invalid.
 * @param {string|number} value
 * @returns {number|null}
 */
function parseYear(value) {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Extracts release year from a data row using common field names.
 * @param {Record<string, any>} row
 * @returns {number|null}
 */
function getReleaseYear(row) {
  const fallbackValue =
    row[COL_RELEASE_YEAR] ?? row.release_year ?? row.releaseYear ?? row["Release Year"];
  return parseYear(fallbackValue);
}

function isValidTheme(theme) {
  return theme === THEME_LIGHT || theme === THEME_DARK;
}

function getStoredThemeChoice() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function getPreferredTheme() {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? THEME_LIGHT
        : THEME_DARK;
    } catch {
      /* noop */
    }
  }
  return THEME_DARK;
}

function applyThemeChoice(theme) {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (isValidTheme(theme)) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function persistThemeChoice(theme) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

function updateThemeToggleButton(activeTheme) {
  if (typeof document === "undefined") return;
  const button = document.getElementById("themeToggle");
  if (!button) return;
  const theme = isValidTheme(activeTheme) ? activeTheme : getPreferredTheme();
  const nextTheme = theme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
  const labelTarget = nextTheme === THEME_LIGHT ? "Light" : "Dark";
  button.textContent = `Switch to ${labelTarget} Theme`;
  button.setAttribute("aria-pressed", theme === THEME_LIGHT ? "true" : "false");
  button.setAttribute("aria-label", `Switch to ${labelTarget.toLowerCase()} theme`);
  button.setAttribute("title", button.textContent);
  button.dataset.nextTheme = nextTheme;
}

function initThemeToggle() {
  const initialStoredTheme = getStoredThemeChoice();
  const initialTheme = initialStoredTheme || getPreferredTheme();
  applyThemeChoice(initialTheme);
  updateThemeToggleButton(initialTheme);

  if (typeof document === "undefined") return;
  const button = document.getElementById("themeToggle");
  if (button) {
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || getPreferredTheme();
      const nextTheme = current === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      applyThemeChoice(nextTheme);
      persistThemeChoice(nextTheme);
      updateThemeToggleButton(nextTheme);
    });
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const syncThemeWithSystem = (event) => {
        if (getStoredThemeChoice()) return;
        const themeFromSystem = event.matches ? THEME_LIGHT : THEME_DARK;
        applyThemeChoice(themeFromSystem);
        updateThemeToggleButton(themeFromSystem);
      };
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncThemeWithSystem);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncThemeWithSystem);
      }
    } catch {
      /* noop */
    }
  }
}

/**
 * Resolve status for a given key, defaulting to STATUS_NONE.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
function getStatusForKey(key, sourceMap) {
  const map = sourceMap || gameStatuses;
  return map[key] || STATUS_NONE;
}

/**
 * Persist a status for the provided key.
 * @param {string} key
 * @param {string} status
 */
function setStatusForKey(key, status) {
  if (!status || status === STATUS_NONE) {
    delete gameStatuses[key];
  } else {
    gameStatuses[key] = status;
  }
}

/**
 * Resolve the status map that should be considered active.
 * Prefers an imported collection when present, otherwise falls back to local state.
 * @returns {StatusMap}
 */
function getActiveStatusMap() {
  return importedCollection || gameStatuses;
}

/**
 * Read a saved note for the given key.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
function getNoteForKey(key, sourceMap) {
  const map = sourceMap || gameNotes;
  return map[key] || "";
}

/**
 * Save a note (or remove when empty) for the given key.
 * @param {string} key
 * @param {string} note
 */
function setNoteForKey(key, note) {
  if (!note || !note.trim()) {
    delete gameNotes[key];
  } else {
    gameNotes[key] = note.trim();
  }
}

/**
 * Build the composite key (game + platform) for a given row.
 * @param {GameRow} row
 * @returns {string|null}
 */
function buildRowKey(row) {
  if (!row) return null;
  const game = row[COL_GAME];
  const platform = row[COL_PLATFORM];
  if (!game || !platform) return null;
  return `${game}___${platform}`;
}

function cacheStatusRows(rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    const key = buildRowKey(row);
    if (key) statusRowCache.set(key, row);
  });
}

function getAliasKeys(aliasKey) {
  if (!aliasKey) return [];
  const base = FIELD_ALIAS_MAP[aliasKey];
  if (base && Array.isArray(base)) return base;
  if (typeof aliasKey === "string" && aliasKey.includes("_")) {
    const spaced = aliasKey
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return [aliasKey, spaced];
  }
  return [aliasKey];
}

function resolveGameField(game, aliasKey) {
  if (!game) return "";
  const aliases = getAliasKeys(aliasKey);
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(game, key)) {
      const value = game[key];
      if (value !== undefined && value !== null && value !== "") {
        return typeof value === "string" ? value.trim() : value;
      }
    }
  }
  return "";
}

function markFieldConsumed(consumed, aliasKey) {
  const aliases = getAliasKeys(aliasKey);
  aliases.forEach((key) => consumed.add(key));
}

function formatFieldLabel(fieldName) {
  if (!fieldName) return "";
  return fieldName
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function prefersReducedMotion() {
  return !!(reduceMotionQuery && reduceMotionQuery.matches);
}

function formatPercent(value, count = 0) {
  if (!count || !Number.isFinite(value) || value <= 0) return "0%";
  if (value < 1) return "<1%";
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

function createCurrencyFormatter(currency) {
  const fallback = "USD";
  const normalized =
    currency && typeof currency === "string" ? currency.toUpperCase() : fallback;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: normalized });
  } catch {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: fallback });
  }
}

function normalizePriceValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number((numeric / 100).toFixed(2));
}

function selectStatusPrice(status, prices) {
  if (!prices) return null;
  const loose = prices.loose ?? null;
  const cib = prices.cib ?? null;
  const brandNew = prices.new ?? null;
  switch (status) {
    case STATUS_WISHLIST:
      return brandNew ?? cib ?? loose;
    case STATUS_TRADE:
      return loose ?? cib ?? brandNew;
    case STATUS_BACKLOG:
    case STATUS_OWNED:
    default:
      return cib ?? loose ?? brandNew;
  }
}

function resolveConsoleHint(platformName) {
  if (!platformName) return "";
  const upper = platformName.toUpperCase();
  if (PRICECHARTING_CONFIG.consoleHints && PRICECHARTING_CONFIG.consoleHints[upper]) {
    return PRICECHARTING_CONFIG.consoleHints[upper];
  }
  if (PLATFORM_NAME_ALIASES[upper] && PLATFORM_NAME_ALIASES[upper].length) {
    return PLATFORM_NAME_ALIASES[upper][0];
  }
  return platformName;
}

function buildPriceQuery(row) {
  if (!row) return "";
  const title = (row[COL_GAME] || "").trim();
  const platform = (row[COL_PLATFORM] || "").trim();
  if (!title) return "";
  const consoleHint = resolveConsoleHint(platform);
  return [title, consoleHint].filter(Boolean).join(" ").trim();
}

function createPriceInsights() {
  const supportsFetch = typeof fetch === "function";
  const enabled = Boolean(PRICECHARTING_TOKEN && supportsFetch);
  const currencyFormatter = createCurrencyFormatter(PRICECHARTING_CURRENCY);
  const cache =
    enabled && typeof localStorage !== "undefined"
      ? (() => {
          try {
            const raw = localStorage.getItem(PRICE_CACHE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
          } catch {
            return {};
          }
        })()
      : {};
  const valuationHistory =
    enabled && typeof localStorage !== "undefined"
      ? (() => {
          try {
            const raw = localStorage.getItem(VALUATION_HISTORY_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.slice(-VALUATION_HISTORY_LIMIT);
          } catch {
            return [];
          }
        })()
      : [];
  const listeners = new Set();
  const queue = [];
  const pending = new Map();
  let inflight = 0;
  const fetchImpl =
    supportsFetch && typeof window !== "undefined"
      ? fetch.bind(window)
      : supportsFetch && typeof globalThis !== "undefined"
        ? fetch.bind(globalThis)
        : null;

  function persistCache() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* noop */
    }
  }

  function persistHistory() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(VALUATION_HISTORY_KEY, JSON.stringify(valuationHistory));
    } catch {
      /* noop */
    }
  }

  function notify() {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* ignore subscriber errors */
      }
    });
  }

  function isEntryFresh(entry) {
    if (!entry || !entry.fetchedAt) return false;
    return Date.now() - entry.fetchedAt < PRICE_CACHE_TTL_MS;
  }

  function buildHistory(previous, prices) {
    const history = Array.isArray(previous?.history) ? [...previous.history] : [];
    history.push({
      ts: Date.now(),
      loose: prices.loose ?? null,
      cib: prices.cib ?? null,
      new: prices.new ?? null,
    });
    if (history.length > PRICE_HISTORY_LIMIT) {
      history.splice(0, history.length - PRICE_HISTORY_LIMIT);
    }
    return history;
  }

  async function requestPricecharting(path) {
    if (!fetchImpl) return null;
    const response = await fetchImpl(`${PRICE_API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`PriceCharting responded with ${response.status}`);
    }
    return response.json();
  }

  async function fetchQuote(row, previousEntry) {
    if (!row) return null;
    const query = buildPriceQuery(row);
    if (!query) return null;
    const key = buildRowKey(row);
    if (!key) return null;
    let payload = null;
    if (previousEntry && previousEntry.productId) {
      try {
        payload = await requestPricecharting(
          `/api/product?t=${PRICECHARTING_TOKEN}&id=${encodeURIComponent(previousEntry.productId)}`
        );
      } catch {
        payload = null;
      }
    }
    if (!payload) {
      payload = await requestPricecharting(
        `/api/product?t=${PRICECHARTING_TOKEN}&q=${encodeURIComponent(query)}`
      );
    }
    if (!payload || payload.status !== "success") return null;
    const prices = {
      loose: normalizePriceValue(payload["loose-price"]),
      cib: normalizePriceValue(payload["cib-price"]),
      new: normalizePriceValue(payload["new-price"]),
    };
    return {
      key,
      query,
      productId: payload.id,
      productName: payload["product-name"] || row[COL_GAME] || "",
      consoleName: payload["console-name"] || row[COL_PLATFORM] || "",
      fetchedAt: Date.now(),
      prices,
      history: buildHistory(previousEntry, prices),
    };
  }

  function dequeue() {
    if (!enabled) return;
    if (inflight >= PRICE_FETCH_CONCURRENCY) return;
    const job = queue.shift();
    if (!job) return;
    inflight += 1;
    const prior = job.force ? null : cache[job.key];
    fetchQuote(job.row, prior)
      .then((quote) => {
        if (quote) {
          cache[job.key] = quote;
          persistCache();
          notify();
        }
        job.resolve(quote);
      })
      .catch((error) => {
        if (typeof console !== "undefined" && typeof console.debug === "function") {
          console.debug("PriceCharting fetch failed", error);
        }
        job.resolve(null);
      })
      .finally(() => {
        inflight -= 1;
        dequeue();
      });
  }

  function schedule(entry, force) {
    const key = entry && (entry.key || buildRowKey(entry.row));
    if (!key || !entry.row) return Promise.resolve(null);
    if (!force && isEntryFresh(cache[key])) return Promise.resolve(cache[key]);
    if (pending.has(key)) return pending.get(key);
    const job = {
      key,
      row: entry.row,
      force: !!force,
    };
    const promise = new Promise((resolve) => {
      job.resolve = resolve;
    }).finally(() => {
      pending.delete(key);
    });
    pending.set(key, promise);
    queue.push(job);
    dequeue();
    return promise;
  }

  function queueRows(rows, options = {}) {
    if (!enabled || !Array.isArray(rows) || rows.length === 0) {
      return Promise.resolve([]);
    }
    return Promise.all(rows.map((entry) => schedule(entry, options.force)));
  }

  function summarize(rows) {
    const totals = {
      [STATUS_OWNED]: 0,
      [STATUS_WISHLIST]: 0,
      [STATUS_BACKLOG]: 0,
      [STATUS_TRADE]: 0,
      total: 0,
    };
    let missing = 0;
    let lastUpdated = 0;
    rows.forEach((entry) => {
      const key = entry.key || buildRowKey(entry.row);
      if (!key) {
        missing += 1;
        return;
      }
      const quote = cache[key];
      if (!quote) {
        missing += 1;
        return;
      }
      const value = selectStatusPrice(entry.status, quote.prices);
      if (!Number.isFinite(value)) {
        missing += 1;
        return;
      }
      totals[entry.status] = (totals[entry.status] || 0) + value;
      totals.total += value;
      if (quote.fetchedAt > lastUpdated) lastUpdated = quote.fetchedAt;
    });
    if (rows.length && missing === 0 && totals.total > 0) {
      const snapshot = Number(totals.total.toFixed(2));
      const latest = valuationHistory[valuationHistory.length - 1];
      if (!latest || latest.total !== snapshot) {
        valuationHistory.push({ ts: Date.now(), total: snapshot });
        if (valuationHistory.length > VALUATION_HISTORY_LIMIT) {
          valuationHistory.splice(0, valuationHistory.length - VALUATION_HISTORY_LIMIT);
        }
        persistHistory();
      }
    }
    return {
      totals,
      missing,
      lastUpdated,
      history: valuationHistory.slice(),
    };
  }

  function subscribe(listener) {
    if (typeof listener === "function") {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    return () => {};
  }

  function getQuote(key) {
    return cache[key] || null;
  }

  function getHistoryForKey(key) {
    const entry = cache[key];
    return entry && Array.isArray(entry.history) ? entry.history : [];
  }

  function formatCurrency(value) {
    if (!Number.isFinite(value)) return "—";
    return currencyFormatter.format(value);
  }

  function setQuoteForTest(key, entry) {
    if (!key || !entry) return;
    cache[key] = entry;
    persistCache();
  }

  return {
    isEnabled: () => enabled,
    queueRows,
    refreshRows(rows) {
      return queueRows(rows, { force: true });
    },
    summarize,
    subscribe,
    getQuote,
    getQuoteHistory: getHistoryForKey,
    getHistory: () => valuationHistory.slice(),
    formatCurrency,
    __setQuoteForTest: setQuoteForTest,
    __buildQuery: buildPriceQuery,
  };
}

function updateCarouselButtons(windowEl) {
  if (!windowEl || !windowEl.parentElement) return;
  const parent = windowEl.parentElement;
  const targetId = windowEl.id;
  if (!targetId) return;
  const prevBtn = parent.querySelector(
    `[data-carousel-target="${targetId}"][data-direction="prev"]`
  );
  const nextBtn = parent.querySelector(
    `[data-carousel-target="${targetId}"][data-direction="next"]`
  );
  const maxScroll = Math.max(0, windowEl.scrollWidth - windowEl.clientWidth);
  if (prevBtn) prevBtn.disabled = windowEl.scrollLeft <= 1;
  if (nextBtn) nextBtn.disabled = windowEl.scrollLeft >= maxScroll - 1;
}

function registerCarouselWindow(windowEl) {
  if (!windowEl || windowEl.dataset.carouselRegistered) return;
  windowEl.dataset.carouselRegistered = "true";
  registeredCarouselWindows.add(windowEl);
  windowEl.addEventListener("scroll", () => updateCarouselButtons(windowEl), {
    passive: true,
  });
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => updateCarouselButtons(windowEl));
    observer.observe(windowEl);
    windowEl.__carouselObserver = observer;
  }
  updateCarouselButtons(windowEl);
}

function initCarouselControls() {
  if (carouselControlsBound || typeof document === "undefined") return;
  const controls = document.querySelectorAll("[data-carousel-target]");
  controls.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-carousel-target");
      if (!targetId) return;
      const windowEl = document.getElementById(targetId);
      if (!windowEl) return;
      const direction = button.getAttribute("data-direction") === "next" ? 1 : -1;
      const stepAttr = Number(button.getAttribute("data-scroll-step"));
      const baseStep = Math.round(windowEl.clientWidth * 0.85) || 220;
      const step = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : baseStep;
      windowEl.scrollBy({
        left: step * direction,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      const update = () => updateCarouselButtons(windowEl);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(update);
        window.setTimeout(update, prefersReducedMotion() ? 0 : 320);
      } else {
        update();
      }
    });
  });
  carouselControlsBound = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    registeredCarouselWindows.forEach((el) => updateCarouselButtons(el));
  });
  if (reduceMotionQuery && typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", () => {
      registeredCarouselWindows.forEach((el) => updateCarouselButtons(el));
    });
  }
}

/**
 * Initialize gallery controls inside modal.
 * @param {HTMLElement} modal
 * @param {string[]} images
 */
function initializeGallery(modal, images) {
  const galleryEl = modal.querySelector(".modal-gallery");
  if (!galleryEl) return;
  const imgEl = galleryEl.querySelector(".gallery-image");
  const counterEl = galleryEl.querySelector(".gallery-counter");
  const prevBtn = galleryEl.querySelector(".gallery-nav.prev");
  const nextBtn = galleryEl.querySelector(".gallery-nav.next");
  let currentIndex = 0;

  const updateImage = () => {
    const boundedIndex = ((currentIndex % images.length) + images.length) % images.length;
    currentIndex = boundedIndex;
    imgEl.src = images[boundedIndex];
    imgEl.alt = `${images[boundedIndex]} screenshot`;
    counterEl.textContent = `${boundedIndex + 1} / ${images.length}`;
  };

  prevBtn.onclick = () => {
    currentIndex -= 1;
    updateImage();
  };
  nextBtn.onclick = () => {
    currentIndex += 1;
    updateImage();
  };
  galleryEl.onkeydown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      currentIndex -= 1;
      updateImage();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      currentIndex += 1;
      updateImage();
    }
  };
  galleryEl.setAttribute("tabindex", "0");
  updateImage();
}

/**
 * LocalStorage: Load & Save status state
 */
function loadStatuses() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (raw && typeof raw === "object") {
      gameStatuses = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (typeof value === "string") {
          gameStatuses[key] = value;
        } else if (value === true) {
          gameStatuses[key] = STATUS_OWNED;
        }
      });
    } else {
      gameStatuses = {};
    }
  } catch {
    gameStatuses = {};
  }
  markCollectionValueDirty();
}
function saveStatuses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameStatuses));
  markCollectionValueDirty();
}

function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "{}");
    gameNotes = raw && typeof raw === "object" ? raw : {};
  } catch {
    gameNotes = {};
  }
}

function saveNotes() {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(gameNotes));
}

function loadPersistedFilters() {
  try {
    persistedFilters = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}");
  } catch {
    persistedFilters = {};
  }
}

function savePersistedFilters() {
  const snapshot = {
    filterStatus,
    filterRatingMin,
    filterYearStart,
    filterYearEnd,
    filterRegion,
  };
  persistedFilters = snapshot;
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(snapshot));
}

function resolveStreamPageSize() {
  const configSize = Number(
    SUPABASE_CONFIG.streamPageSize ||
      SUPABASE_CONFIG.pageSize ||
      SUPABASE_CONFIG.chunkSize
  );
  if (Number.isFinite(configSize) && configSize > 0) {
    return Math.min(Math.max(Math.floor(configSize), 50), 1000);
  }
  return 400;
}

function shouldUseServerFiltering() {
  return streamState.enabled && !!supabase && !FORCE_SAMPLE;
}

function buildRemoteFilterPayload() {
  return {
    search: searchValue || "",
    platform: filterPlatform || "",
    genre: filterGenre || "",
    ratingMin: parseRating(filterRatingMin),
    yearStart: parseYear(filterYearStart),
    yearEnd: parseYear(filterYearEnd),
    region: filterRegion || "",
    sortColumn,
    sortDirection,
  };
}

function buildRemoteFilterSignature(payload) {
  return JSON.stringify(payload || {});
}

function parseRating(value) {
  const rating = parseFloat(value);
  return Number.isFinite(rating) ? rating : null;
}

function normalizeAggregatePayload(payload = {}) {
  return {
    search: payload.search || null,
    platform: payload.platform || null,
    genre: payload.genre || null,
    ratingMin: payload.ratingMin ?? null,
    yearStart: payload.yearStart ?? null,
    yearEnd: payload.yearEnd ?? null,
    region: payload.region || null,
  };
}

function applySupabaseFilters(query, filters = {}, columnPrefix = "") {
  if (!filters) return query;
  const column = (name) => (columnPrefix ? `${columnPrefix}.${name}` : name);
  if (filters.search) {
    query = query.ilike(column(COL_GAME), `%${filters.search}%`);
  }
  if (filters.platform) {
    query = query.eq(column(COL_PLATFORM), filters.platform);
  }
  if (filters.genre) {
    query = query.ilike(column(COL_GENRE), `%${filters.genre}%`);
  }
  if (filters.ratingMin !== null && filters.ratingMin !== undefined) {
    query = query.gte(column(COL_RATING), filters.ratingMin);
  }
  if (filters.yearStart !== null && filters.yearStart !== undefined) {
    query = query.gte(column(COL_RELEASE_YEAR), filters.yearStart);
  }
  if (filters.yearEnd !== null && filters.yearEnd !== undefined) {
    query = query.lte(column(COL_RELEASE_YEAR), filters.yearEnd);
  }
  if (filters.region) {
    const patterns = REGION_PATTERNS[filters.region];
    const clauses = [];
    if (patterns && patterns.length) {
      for (const pat of patterns) {
        clauses.push(`${column("region")}.ilike.%${pat}%`);
      }
    }
    if (clauses.length) {
      query = query.or(clauses.join(","));
    }
  }
  return query;
}

function normalizePageSize(value) {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  const normalized = PAGE_SIZE_CHOICES.find((choice) => choice === value);
  return normalized || DEFAULT_PAGE_SIZE;
}

function loadBrowsePreferences() {
  const defaults = {
    mode: BROWSE_MODE_INFINITE,
    pageSize: DEFAULT_PAGE_SIZE,
    page: 1,
  };
  if (typeof window === "undefined") return defaults;
  try {
    if (window.localStorage) {
      const stored = window.localStorage.getItem(BROWSE_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          if (parsed.mode === BROWSE_MODE_PAGED || parsed.mode === BROWSE_MODE_INFINITE) {
            defaults.mode = parsed.mode;
          }
          if (parsed.pageSize) {
            defaults.pageSize = normalizePageSize(Number(parsed.pageSize));
          }
        }
      }
    }
  } catch {
    /* noop */
  }
  try {
    if (window.location && typeof window.location.search === "string") {
      const params = new URLSearchParams(window.location.search);
      const pageSizeParam = normalizePageSize(Number(params.get("pageSize")));
      if (pageSizeParam) defaults.pageSize = pageSizeParam;
      const pageParam = parseInt(params.get("page") || "", 10);
      if (!Number.isNaN(pageParam) && pageParam > 0) {
        defaults.page = pageParam;
        defaults.mode = BROWSE_MODE_PAGED;
      }
      const modeParam = params.get("view");
      if (modeParam === BROWSE_MODE_PAGED || modeParam === BROWSE_MODE_INFINITE) {
        defaults.mode = modeParam;
      }
    }
  } catch {
    /* noop */
  }
  return defaults;
}

function saveBrowsePreferences() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      BROWSE_PREFS_KEY,
      JSON.stringify({
        mode: browseMode,
        pageSize: paginationState.pageSize,
      })
    );
  } catch {
    /* noop */
  }
}

function syncBrowseParams() {
  if (
    typeof window === "undefined" ||
    !window.history ||
    typeof window.history.replaceState !== "function" ||
    !window.location
  ) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("pageSize", paginationState.pageSize.toString());
  if (browseMode === BROWSE_MODE_PAGED) {
    url.searchParams.set("view", BROWSE_MODE_PAGED);
    url.searchParams.set("page", paginationState.currentPage.toString());
  } else {
    url.searchParams.set("view", BROWSE_MODE_INFINITE);
    url.searchParams.delete("page");
  }
  window.history.replaceState({}, "", url);
}

/** Sync current filter state into the DOM inputs. */
function applyFiltersToInputs() {
  const platformEl = document.getElementById("platformFilter");
  if (platformEl) platformEl.value = filterPlatform || "";
  const genreEl = document.getElementById("genreFilter");
  if (genreEl) genreEl.value = filterGenre || "";
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = searchValue || "";
  const statusEl = document.getElementById("statusFilter");
  if (statusEl) statusEl.value = filterStatus || "";
  const ratingEl = document.getElementById("ratingFilter");
  if (ratingEl) ratingEl.value = filterRatingMin || "";
  const yearStartEl = document.getElementById("yearStartFilter");
  if (yearStartEl) yearStartEl.value = filterYearStart || "";
  const yearEndEl = document.getElementById("yearEndFilter");
  if (yearEndEl) yearEndEl.value = filterYearEnd || "";
  const browseModeEl = document.getElementById("browseModeSelect");
  if (browseModeEl) browseModeEl.value = browseMode;
  const pageSizeEl = document.getElementById("pageSizeSelect");
  if (pageSizeEl) pageSizeEl.value = paginationState.pageSize.toString();
  updateRegionToggleActive();
  syncSortControl();
}

/**
 * Initialize platform and genre filter dropdowns from data.
 */
function setupFilters(data) {
  const platforms = [
    ...new Set(data.map((row) => row[COL_PLATFORM]).filter(Boolean)),
  ].sort();
  const platSel = document.getElementById("platformFilter");
  platSel.innerHTML =
    `<option value="">All Platforms</option>` +
    platforms.map((p) => `<option>${p}</option>`).join("");
  let allGenres = [];
  data.forEach((row) => {
    if (row[COL_GENRE])
      row[COL_GENRE].split(",")
        .map((g) => g.trim())
        .forEach((g) => allGenres.push(g));
  });
  const genres = [...new Set(allGenres)].sort();
  const genreSel = document.getElementById("genreFilter");
  genreSel.innerHTML =
    `<option value="">All Genres</option>` +
    genres.map((g) => `<option>${g}</option>`).join("");
}

function updateRegionToggleActive() {
  const buttons = document.querySelectorAll("[data-region-option]");
  buttons.forEach((button) => {
    const value = button.getAttribute("data-region-option") || "";
    if (value === filterRegion) {
      button.classList.add("is-active");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    }
  });
}

function setupRegionToggle() {
  const container = document.querySelector("[data-region-toggle]");
  if (!container) return;
  container.querySelectorAll("[data-region-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-region-option") || "";
      filterRegion = value;
      savePersistedFilters();
      updateRegionToggleActive();
      refreshFilteredView("filter:region");
    });
  });
  updateRegionToggleActive();
}

function getRegionCodesForRow(row) {
  if (!row) return [];
  if (Array.isArray(row.__regionCodes)) return row.__regionCodes;
  const computed = computeRegionCodes(row);
  row.__regionCodes = computed;
  return computed;
}

function rowMatchesRegion(row, regionCode) {
  if (!regionCode) return true;
  const codes = getRegionCodesForRow(row);
  if (!codes.length) {
    return regionCode === "NTSC";
  }
  return codes.includes(regionCode);
}

/**
 * Test whether a row matches the current filter state.
 * @param {GameRow} row
 * @param {StatusMap} [statusSource]
 * @returns {boolean}
 */
function doesRowMatchFilters(row, statusSource = getActiveStatusMap()) {
  if (!row) return false;
  if (filterPlatform && row[COL_PLATFORM] !== filterPlatform) return false;
  if (filterGenre) {
    const hasGenre =
      row[COL_GENRE] &&
      row[COL_GENRE].split(",")
        .map((g) => g.trim())
        .includes(filterGenre);
    if (!hasGenre) return false;
  }
  if (searchValue) {
    const matchesSearch = Object.values(row).some(
      (v) => v && v.toString().toLowerCase().includes(searchValue)
    );
    if (!matchesSearch) return false;
  }
  const ratingValue = parseFloat(row[COL_RATING]);
  const ratingMin = parseFloat(filterRatingMin);
  if (!Number.isNaN(ratingMin)) {
    if (Number.isNaN(ratingValue) || ratingValue < ratingMin) return false;
  }
  const releaseYear = getReleaseYear(row);
  const startYear = parseYear(filterYearStart);
  const endYear = parseYear(filterYearEnd);
  if (startYear !== null && (releaseYear === null || releaseYear < startYear))
    return false;
  if (endYear !== null && (releaseYear === null || releaseYear > endYear)) return false;
  const key = buildRowKey(row);
  if (importedCollection && (!key || !importedCollection[key])) return false;
  const rowStatus = key ? getStatusForKey(key, statusSource) : STATUS_NONE;
  if (filterStatus && rowStatus !== filterStatus) return false;
  if (filterRegion && !rowMatchesRegion(row, filterRegion)) return false;
  return true;
}

/**
 * Apply search/filter logic to current data set.
 * @param {GameRow[]} data
 * @returns {GameRow[]}
 */
function applyFilters(data) {
  const statusSource = getActiveStatusMap();
  return data.filter((row) => doesRowMatchFilters(row, statusSource));
}

/**
 * Render the ROM grid from (filtered) data.
 * @param {GameRow[]} data
 * @param {{skipSort?: boolean}} [options]
 */
function renderTable(data, options = {}) {
  const grid = document.getElementById("gameGrid");
  if (!grid) return;
  const virtualization = options.virtualization;
  const useVirtualization = Boolean(virtualization && virtualization.enabled);
  let working = data;
  if (!options.skipSort && sortColumn) {
    working = [...data].sort((a, b) => compareRows(a, b, sortColumn, sortDirection));
  }
  if (!working.length) {
    grid.innerHTML =
      '<div class="grid-empty">No results match your filters. Try adjusting search or filters.</div>';
    showError("No results match your filters.");
    return;
  }
  hideStatus();
  let html = "";
  if (useVirtualization) {
    const topSize = Math.max(0, Math.floor(virtualization.topPadding || 0));
    html += `<div class="virtual-spacer" style="height:${topSize}px"></div>`;
  }
  html += working
    .map((row, idx) => renderGameCard(row, idx, getActiveStatusMap()))
    .join("");
  if (useVirtualization) {
    const bottomSize = Math.max(0, Math.floor(virtualization.bottomPadding || 0));
    html += `<div class="virtual-spacer" style="height:${bottomSize}px"></div>`;
  }
  grid.innerHTML = html;

  if (!importedCollection) {
    grid.querySelectorAll(".status-select").forEach((select) => {
      select.addEventListener("change", function onChange() {
        const k = this.getAttribute("data-key");
        setStatusForKey(k, this.value);
        saveStatuses();
        refreshFilteredView("status-select");
      });
    });
  }

  grid.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (
        event.target.closest(".status-select") ||
        event.target.closest("button") ||
        event.target.tagName === "SELECT"
      ) {
        return;
      }
      const idx = Number(card.getAttribute("data-row"));
      showGameModal(working[idx]);
    });
  });
  grid.querySelectorAll(".card-actions button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const idx = Number(button.getAttribute("data-row"));
      showGameModal(working[idx]);
    });
  });
}

function shouldResetBrowse(reason) {
  if (!reason) return true;
  if (BROWSE_PRESERVE_PREFIXES.some((prefix) => reason.startsWith(prefix))) return false;
  if (BROWSE_PRESERVE_REASONS.has(reason)) return false;
  return true;
}

function shouldVirtualize(length) {
  if (!virtualizationState.enabled) return false;
  if (typeof window === "undefined") return false;
  return length >= VIRTUALIZE_MIN_ITEMS;
}

function renderWindowedGrid(dataset, options = {}) {
  const grid = document.getElementById("gameGrid");
  if (!grid) return;
  const datasetOffset = Number.isFinite(options.offset) ? Number(options.offset) : 0;
  virtualizationState.datasetOffset = datasetOffset;
  virtualizationState.container = grid;
  virtualizationState.sourceData = Array.isArray(dataset) ? dataset : [];
  virtualizationState.lastRenderLength = virtualizationState.sourceData.length;
  if (!shouldVirtualize(virtualizationState.sourceData.length)) {
    const fallbackData = virtualizationState.sourceData;
    teardownVirtualization();
    renderTable(fallbackData, { skipSort: true });
    maybePrefetchStream(datasetOffset + fallbackData.length);
    return;
  }
  virtualizationState.active = true;
  grid.dataset.virtualized = "true";
  bindVirtualizationEvents();
  updateVirtualRange({ force: true });
}

function bindVirtualizationEvents() {
  if (virtualizationState.scrollHandler || typeof window === "undefined") return;
  virtualizationState.scrollHandler = () => scheduleVirtualizationUpdate();
  virtualizationState.resizeHandler = () => {
    virtualizationState.rowHeight = 0;
    virtualizationState.columns = 1;
    scheduleVirtualizationUpdate(true);
  };
  window.addEventListener("scroll", virtualizationState.scrollHandler, { passive: true });
  window.addEventListener("resize", virtualizationState.resizeHandler);
}

function teardownVirtualization() {
  if (virtualizationState.scrollHandler && typeof window !== "undefined") {
    window.removeEventListener("scroll", virtualizationState.scrollHandler);
    window.removeEventListener("resize", virtualizationState.resizeHandler);
  }
  virtualizationState.scrollHandler = null;
  virtualizationState.resizeHandler = null;
  cancelVirtualFrame("pendingAnimationFrame");
  cancelVirtualFrame("pendingMeasureFrame");
  virtualizationState.pendingAnimationFrame = null;
  virtualizationState.pendingMeasureFrame = null;
  virtualizationState.active = false;
  virtualizationState.sourceData = [];
  virtualizationState.visibleStart = 0;
  virtualizationState.visibleEnd = 0;
  virtualizationState.topPadding = 0;
  virtualizationState.bottomPadding = 0;
  virtualizationState.lastRenderLength = 0;
  virtualizationState.datasetOffset = 0;
  if (virtualizationState.container) {
    delete virtualizationState.container.dataset.virtualized;
  }
}

function scheduleVirtualizationUpdate(force) {
  if (!virtualizationState.active) return;
  if (virtualizationState.pendingAnimationFrame) return;
  const run = () => {
    virtualizationState.pendingAnimationFrame = null;
    updateVirtualRange({ force: Boolean(force) });
  };
  virtualizationState.pendingAnimationFrame = requestVirtualFrame(run);
}

function updateVirtualRange(options = {}) {
  if (!virtualizationState.active || !virtualizationState.container) return;
  const total = virtualizationState.sourceData.length;
  if (!total) {
    virtualizationState.topPadding = 0;
    virtualizationState.bottomPadding = 0;
    renderTable([], { skipSort: true });
    return;
  }
  const metrics = getVirtualMetrics();
  const range = computeVirtualRange(metrics);
  if (
    !options.force &&
    range.start === virtualizationState.visibleStart &&
    range.end === virtualizationState.visibleEnd
  ) {
    return;
  }
  virtualizationState.visibleStart = range.start;
  virtualizationState.visibleEnd = range.end;
  virtualizationState.topPadding = range.topPadding;
  virtualizationState.bottomPadding = range.bottomPadding;
  const slice = virtualizationState.sourceData.slice(range.start, range.end);
  renderTable(slice, {
    skipSort: true,
    virtualization: {
      enabled: true,
      topPadding: virtualizationState.topPadding,
      bottomPadding: virtualizationState.bottomPadding,
    },
  });
  if (virtualizationState.rowHeight === 0 || options.force) {
    queueVirtualMeasurement();
  }
  const absoluteEndIndex = virtualizationState.datasetOffset + range.end;
  maybePrefetchStream(absoluteEndIndex);
}

function getVirtualMetrics() {
  const container = virtualizationState.container;
  if (!container) {
    return {
      rowHeight: VIRTUAL_DEFAULT_CARD_HEIGHT,
      columns: 1,
      gap: 0,
    };
  }
  const rowHeight = virtualizationState.rowHeight || VIRTUAL_DEFAULT_CARD_HEIGHT;
  const columns = Math.max(
    1,
    virtualizationState.columns || estimateColumnCount(container)
  );
  const gap = virtualizationState.gridGap || 0;
  return { rowHeight, columns, gap };
}

function estimateColumnCount(container) {
  try {
    const firstCard = container.querySelector(".game-card");
    const gapValue =
      window.getComputedStyle(container).columnGap ||
      window.getComputedStyle(container).gap;
    const gap = parseFloat(gapValue) || 0;
    virtualizationState.gridGap = gap;
    if (!firstCard) {
      const fallbackWidth = 260;
      return Math.max(
        1,
        Math.floor((container.clientWidth + gap) / (fallbackWidth + gap))
      );
    }
    const cardWidth = firstCard.offsetWidth || 260;
    return Math.max(1, Math.floor((container.clientWidth + gap) / (cardWidth + gap)));
  } catch {
    return 1;
  }
}

function computeVirtualRange(metrics) {
  const container = virtualizationState.container;
  const dataLength = virtualizationState.sourceData.length;
  if (!container || !dataLength) {
    return { start: 0, end: 0, topPadding: 0, bottomPadding: 0 };
  }
  const { rowHeight, columns } = metrics;
  const viewportHeight =
    typeof window !== "undefined" && typeof window.innerHeight === "number"
      ? window.innerHeight
      : rowHeight * 6;
  const containerTop =
    container.getBoundingClientRect().top +
    (typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0);
  const viewportTop =
    typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;
  const startOffset = Math.max(
    0,
    viewportTop - containerTop - rowHeight * VIRTUAL_OVERSCAN_ROWS
  );
  const startRow = Math.max(0, Math.floor(startOffset / rowHeight));
  const rowsInView = Math.ceil(viewportHeight / rowHeight) + VIRTUAL_OVERSCAN_ROWS * 2;
  const startIndex = Math.min(dataLength, startRow * columns);
  const endIndex = Math.min(
    dataLength,
    Math.max(startIndex + rowsInView * columns, startIndex + columns)
  );
  const totalRows = Math.ceil(dataLength / columns);
  const endRow = Math.ceil(endIndex / columns);
  const topPadding = startRow * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRow) * rowHeight);
  return { start: startIndex, end: endIndex, topPadding, bottomPadding };
}

function queueVirtualMeasurement() {
  if (virtualizationState.pendingMeasureFrame || typeof window === "undefined") return;
  virtualizationState.pendingMeasureFrame = requestVirtualFrame(() => {
    virtualizationState.pendingMeasureFrame = null;
    measureVirtualMetrics();
  });
}

function requestVirtualFrame(callback) {
  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, VIRTUAL_SCROLL_THROTTLE_MS);
}

function cancelVirtualFrame(key) {
  const handle = virtualizationState[key];
  if (!handle) return;
  if (
    typeof window !== "undefined" &&
    typeof window.cancelAnimationFrame === "function"
  ) {
    window.cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
  virtualizationState[key] = null;
}

function measureVirtualMetrics() {
  if (!virtualizationState.container) return;
  const card = virtualizationState.container.querySelector(".game-card");
  if (!card || typeof window === "undefined") return;
  const styles = window.getComputedStyle(virtualizationState.container);
  const rowGap = parseFloat(styles.rowGap || styles.gap || "0") || 0;
  virtualizationState.gridGap = rowGap;
  const cardHeight = card.offsetHeight || VIRTUAL_DEFAULT_CARD_HEIGHT;
  const cardWidth = card.offsetWidth || 260;
  const containerWidth = virtualizationState.container.clientWidth || cardWidth;
  virtualizationState.rowHeight = cardHeight + rowGap;
  virtualizationState.columns = Math.max(
    1,
    Math.floor((containerWidth + rowGap) / (cardWidth + rowGap))
  );
  scheduleVirtualizationUpdate(true);
}

function maybePrefetchStream(anchorIndex) {
  if (!streamState.active || !streamState.hasMore) return;
  if (streamState.loading) return;
  const anchorValue = Number(anchorIndex);
  if (!Number.isFinite(anchorValue)) return;
  const fetched = rawData.length;
  if (!fetched) return;
  const thresholdIndex = Math.max(0, Math.floor(fetched * STREAM_PREFETCH_THRESHOLD));
  if (anchorValue >= thresholdIndex) {
    fetchNextSupabaseChunk("stream:prefetch").catch(() => {
      /* errors handled in fetchNextSupabaseChunk */
    });
  }
}

async function fetchNextSupabaseChunk(reason = "stream:auto") {
  if (!streamState.active || !streamState.hasMore) return;
  if (streamState.loading && streamState.pendingPromise) {
    return streamState.pendingPromise;
  }
  streamState.loading = true;
  updateBrowseSummaryLoading(true);
  const from = streamState.nextFrom;
  const to = from + streamState.pageSize - 1;
  const promise = (async () => {
    try {
      const page = await fetchGamesPage(from, to, streamState.filterPayload);
      const rows = Array.isArray(page.data) ? page.data : [];
      normalizeIncomingRows(rows);
      let coverHydrationPromise = Promise.resolve(false);
      if (rows.length) {
        rawData = rawData.concat(rows);
        cacheStatusRows(rows);
        coverHydrationPromise = hydrateFallbackCovers(rows);
      }
      if (page.tableName) {
        streamState.tableName = page.tableName;
      }
      streamState.nextFrom = from + rows.length;
      if (typeof page.count === "number") {
        streamState.totalCount = page.count;
      }
      if (
        !rows.length ||
        rows.length < streamState.pageSize ||
        (typeof streamState.totalCount === "number" &&
          streamState.nextFrom >= streamState.totalCount)
      ) {
        streamState.hasMore = false;
      }
      if (rows.length) {
        refreshFilteredView(reason.startsWith("stream:") ? reason : `stream:${reason}`);
        updateTrendingCarousel(rawData);
        updateStructuredData(rawData);
        coverHydrationPromise
          .then((mutated) => {
            if (mutated) {
              updateTrendingCarousel(rawData);
              updateStructuredData(rawData);
              refreshFilteredView("stream:covers");
            }
          })
          .catch((error) => {
            if (typeof console !== "undefined" && typeof console.debug === "function") {
              console.debug("Stream cover hydration skipped", error);
            }
          });
      }
    } catch (err) {
      streamState.error = err;
      showStatus("Unable to load additional games from Supabase.", "error");
      throw err;
    } finally {
      streamState.loading = false;
      streamState.pendingPromise = null;
      if (!streamState.hasMore) {
        updateBrowseSummaryLoading(false);
      }
    }
  })();
  streamState.pendingPromise = promise;
  return promise.finally(() => {
    updateBrowseSummaryLoading(false);
  });
}

async function ensureDataCapacity(targetCount, reason = "stream:auto") {
  if (!streamState.active || !streamState.hasMore) return;
  if (rawData.length >= targetCount) return;
  const safetyLimit = 8;
  let attempts = 0;
  while (rawData.length < targetCount && streamState.hasMore && attempts < safetyLimit) {
    attempts += 1;
    try {
      await fetchNextSupabaseChunk(reason);
    } catch {
      return;
    }
  }
}

function getKnownTotalCount() {
  if (streamState.active && typeof streamState.totalCount === "number") {
    return streamState.totalCount;
  }
  if (streamState.active && streamState.hasMore) {
    return rawData.length + streamState.pageSize;
  }
  return rawData.length;
}

function updateBrowseSummaryLoading(isLoading) {
  const summaryEl = document.getElementById("browseSummary");
  if (!summaryEl) return;
  if (isLoading) {
    summaryEl.dataset.loading = "true";
  } else {
    delete summaryEl.dataset.loading;
  }
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    if (isLoading) {
      loadMoreBtn.textContent = "Loading more games…";
      loadMoreBtn.disabled = true;
    } else if (!streamState.loading) {
      loadMoreBtn.disabled = false;
    }
  }
}

function renderPagedWindow(sortedData) {
  paginationState.totalItems = sortedData.length;
  paginationState.totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / Math.max(paginationState.pageSize, 1))
  );
  if (paginationState.currentPage > paginationState.totalPages) {
    paginationState.currentPage = paginationState.totalPages;
  }
  const startIndex =
    (Math.max(1, paginationState.currentPage) - 1) * paginationState.pageSize;
  const endIndex = Math.min(startIndex + paginationState.pageSize, sortedData.length);
  const working = sortedData.slice(startIndex, endIndex);
  renderWindowedGrid(working, { offset: startIndex });
  updatePaginationControls(sortedData.length, { start: startIndex, end: endIndex });
  teardownInfiniteObserver();
  syncBrowseParams();
}

function renderInfiniteWindow(sortedData, options = {}) {
  paginationState.totalItems = sortedData.length;
  const desiredCount =
    paginationState.renderedCount ||
    Math.min(paginationState.pageSize, sortedData.length);
  paginationState.renderedCount = Math.min(desiredCount, sortedData.length);
  const working = sortedData.slice(0, paginationState.renderedCount);
  renderWindowedGrid(working, { offset: 0 });
  updatePaginationControls(sortedData.length, {
    start: 0,
    end: working.length,
  });
  if (!options.skipObserver) {
    setupInfiniteObserver(sortedData.length);
  }
  syncBrowseParams();
}

function updatePaginationControls(totalItems, range = { start: 0, end: 0 }) {
  const summaryEl = document.getElementById("browseSummary");
  const knownTotal = getKnownTotalCount();
  if (summaryEl) {
    const effectiveTotal = Math.max(totalItems, knownTotal);
    if (!totalItems) {
      summaryEl.textContent = "No games match the current filters.";
    } else {
      const startValue = Math.min(range.start + 1, effectiveTotal);
      const endValue = Math.min(Math.max(range.end, startValue), effectiveTotal);
      const parts = [
        `Showing ${startValue.toLocaleString()}–${endValue.toLocaleString()} of ${effectiveTotal.toLocaleString()} games`,
      ];
      if (streamState.loading) parts.push("Fetching more…");
      summaryEl.textContent = parts.join(" • ");
    }
  }
  const paginationEl = document.getElementById("paginationControls");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (browseMode === BROWSE_MODE_PAGED) {
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (!paginationEl) return;
    if (paginationState.totalPages <= 1) {
      paginationEl.innerHTML = "";
      paginationEl.classList.add("is-hidden");
      return;
    }
    paginationEl.classList.remove("is-hidden");
    paginationEl.innerHTML = buildPaginationMarkup();
    paginationEl.querySelectorAll("button[data-page]").forEach((button) => {
      button.disabled = !!streamState.loading;
      button.addEventListener("click", (event) => {
        const target = event.currentTarget.getAttribute("data-page");
        handlePaginationClick(target);
      });
    });
    return;
  }
  if (paginationEl) {
    paginationEl.innerHTML = "";
    paginationEl.classList.add("is-hidden");
  }
  if (!loadMoreBtn) return;
  const moreAvailable =
    paginationState.renderedCount < totalItems ||
    (streamState.active && streamState.hasMore);
  if (!moreAvailable) {
    loadMoreBtn.style.display = "none";
  } else {
    loadMoreBtn.style.display = "";
    const remaining = Math.max(totalItems - paginationState.renderedCount, 0);
    const batchSize = streamState.hasMore
      ? paginationState.pageSize
      : Math.min(paginationState.pageSize, remaining || paginationState.pageSize);
    loadMoreBtn.textContent = streamState.loading
      ? "Loading more games…"
      : `Load ${batchSize} more games`;
    loadMoreBtn.disabled = !!streamState.loading;
  }
}

function buildPaginationMarkup() {
  const parts = [];
  const current = paginationState.currentPage;
  const total = paginationState.totalPages;
  const prevDisabled = current <= 1 ? " disabled" : "";
  parts.push(`<button type="button" data-page="prev"${prevDisabled}>Previous</button>`);
  const windowSize = 5;
  let startPage = Math.max(1, current - Math.floor(windowSize / 2));
  let endPage = Math.min(total, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);
  for (let page = startPage; page <= endPage; page += 1) {
    const activeClass = page === current ? ' class="is-active"' : "";
    parts.push(
      `<button type="button" data-page="${page}"${activeClass}>${page}</button>`
    );
  }
  const nextDisabled = current >= total ? " disabled" : "";
  parts.push(`<button type="button" data-page="next"${nextDisabled}>Next</button>`);
  return parts.join("");
}

async function fetchStatusRows(keys) {
  if (!keys.length || !supabase) return [];
  const tableName = streamState.tableName || SUPABASE_TABLE_CANDIDATES[0];
  const names = [...new Set(keys.map((key) => key.split("___")[0]))];
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .in(COL_GAME, names)
    .limit(Math.max(names.length * 4, 50));
  if (error) throw error;
  return (Array.isArray(data) ? data : []).filter((row) => {
    const key = buildRowKey(row);
    return key && keys.includes(key);
  });
}

function scheduleAggregateHydration() {
  if (!shouldUseServerFiltering() || !supabase) return;
  const signature =
    streamState.filterSignature ||
    buildRemoteFilterSignature(streamState.filterPayload || buildRemoteFilterPayload());
  if (!signature) return;
  if (
    aggregateState.signature === signature &&
    aggregateState.genres &&
    aggregateState.timeline
  ) {
    return;
  }
  if (aggregateState.promise && aggregateState.signature === signature) return;
  aggregateState.signature = signature;
  aggregateState.loading = true;
  const payload = streamState.filterPayload || buildRemoteFilterPayload();
  aggregateState.promise = fetchAggregateBundle(payload)
    .then((result) => {
      if (aggregateState.signature !== signature) return;
      aggregateState.genres = result.genres;
      aggregateState.timeline = result.timeline;
      aggregateState.loading = false;
      renderAggregateWidgets();
    })
    .catch((err) => {
      console.warn("Unable to fetch aggregate data from Supabase:", err);
      aggregateState.loading = false;
    })
    .finally(() => {
      aggregateState.promise = null;
    });
}

async function fetchAggregateBundle(payload) {
  const [genres, timeline] = await Promise.all([
    fetchGenreAggregates(payload).catch(() => null),
    fetchTimelineAggregates(payload).catch(() => null),
  ]);
  return {
    genres: genres || [],
    timeline: timeline || [],
  };
}

async function fetchGenreAggregates(payload) {
  if (!supabase) return [];
  const rpcName = AGGREGATE_RPC_GENRES;
  const normalizedPayload = normalizeAggregatePayload(payload);
  if (rpcName) {
    try {
      const rpcData = await invokeAggregateRpc(rpcName, normalizedPayload);
      const mapped = (Array.isArray(rpcData) ? rpcData : []).map((entry) => ({
        name:
          entry.genre ||
          entry.name ||
          entry[COL_GENRE] ||
          (Array.isArray(entry.genres) ? entry.genres.join(", ") : null),
        count: Number(entry.count) || 0,
      }));
      const filtered = mapped
        .filter((entry) => entry.name && entry.count > 0)
        .sort((a, b) => b.count - a.count);
      if (filtered.length) return filtered;
    } catch (rpcError) {
      console.warn(`RPC ${rpcName} failed, falling back to SQL aggregates.`, rpcError);
    }
  }
  const tableName = streamState.tableName || SUPABASE_TABLE_CANDIDATES[0];
  let query = supabase
    .from(tableName)
    .select(`${COL_GENRE}, count:${COL_GENRE}`, { head: false });
  query = applySupabaseFilters(query, payload);
  query = query
    .not(COL_GENRE, "is", null)
    .group(COL_GENRE)
    .order("count", { ascending: false })
    .limit(100);
  const { data, error } = await query;
  if (error) throw error;
  const aggregates = {};
  (Array.isArray(data) ? data : []).forEach((row) => {
    const rawValue = row[COL_GENRE];
    const count = Number(row.count) || 0;
    if (!rawValue || !count) return;
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((genre) => {
        aggregates[genre] = (aggregates[genre] || 0) + count;
      });
  });
  return Object.entries(aggregates)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

async function fetchTimelineAggregates(payload) {
  if (!supabase) return [];
  const rpcName = AGGREGATE_RPC_TIMELINE;
  const normalizedPayload = normalizeAggregatePayload(payload);
  if (rpcName) {
    try {
      const rpcData = await invokeAggregateRpc(rpcName, normalizedPayload);
      const mapped = (Array.isArray(rpcData) ? rpcData : []).map((entry) => ({
        year: Number(
          entry.year ?? entry[COL_RELEASE_YEAR] ?? entry.release_year ?? entry.y
        ),
        count: Number(entry.count) || 0,
      }));
      const filtered = mapped
        .filter((entry) => Number.isFinite(entry.year) && entry.count > 0)
        .sort((a, b) => a.year - b.year);
      if (filtered.length) return filtered;
    } catch (rpcError) {
      console.warn(`RPC ${rpcName} failed, falling back to SQL aggregates.`, rpcError);
    }
  }
  const tableName = streamState.tableName || SUPABASE_TABLE_CANDIDATES[0];
  let query = supabase
    .from(tableName)
    .select(`${COL_RELEASE_YEAR}, count:${COL_RELEASE_YEAR}`, { head: false });
  query = applySupabaseFilters(query, payload);
  query = query
    .not(COL_RELEASE_YEAR, "is", null)
    .group(COL_RELEASE_YEAR)
    .order(COL_RELEASE_YEAR, { ascending: true })
    .limit(200);
  const { data, error } = await query;
  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      year: Number(row[COL_RELEASE_YEAR]),
      count: Number(row.count) || 0,
    }))
    .filter((entry) => Number.isFinite(entry.year) && entry.count > 0);
}

function renderAggregateWidgets() {
  if (!latestFilteredData.length) return;
  const { counts } = computeStatusCounts();
  updateDashboard(counts, latestFilteredData);
}

function renderGenreWidget(localRows) {
  const topGenresEl = document.getElementById("dash-genres");
  if (!topGenresEl) return;
  const topGenres = getGenreAggregateData(localRows).slice(0, 8);
  const totalGenreCount = topGenres.reduce((sum, entry) => sum + entry.count, 0);
  if (topGenres.length) {
    topGenresEl.innerHTML = topGenres
      .map(({ name, count }) => {
        const percentValue = totalGenreCount ? (count / totalGenreCount) * 100 : 0;
        const percentText = formatPercent(percentValue, count);
        return `<span class="genre-chip" role="listitem" tabindex="0"><span class="genre-name">${escapeHtml(
          name
        )}</span><span class="genre-metric"><strong>${count}</strong><span class="genre-percent">${percentText}</span></span></span>`;
      })
      .join("");
  } else {
    topGenresEl.innerHTML =
      '<span class="genre-empty" role="listitem">No genres yet</span>';
  }
  const genreWindow = document.getElementById("dash-genres-window");
  if (genreWindow) {
    registerCarouselWindow(genreWindow);
    updateCarouselButtons(genreWindow);
  }
}

function renderTimelineWidget(localRows) {
  const timelineEl = document.getElementById("dash-timeline");
  if (!timelineEl) return;
  const timelineData = getTimelineAggregateData(localRows).slice(-6);
  if (!timelineData.length) {
    timelineEl.textContent = "No release data";
  } else {
    const max = Math.max(...timelineData.map((entry) => entry.count));
    timelineEl.innerHTML = timelineData
      .map(({ year, count }) => {
        const percent = max ? Math.max((count / max) * 100, 5) : 5;
        return `<div class="timeline-bar"><span>${year}</span><div class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></div><strong>${count}</strong></div>`;
      })
      .join("");
  }
}

function getGenreAggregateData(localRows) {
  if (
    shouldUseServerFiltering() &&
    aggregateState.genres &&
    aggregateState.signature === streamState.filterSignature &&
    aggregateState.genres.length
  ) {
    return aggregateState.genres;
  }
  return computeLocalGenreAggregates(localRows);
}

function computeLocalGenreAggregates(localRows) {
  const counts = {};
  (localRows || []).forEach((row) => {
    const values = row[COL_GENRE]
      ? row[COL_GENRE].split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    values.forEach((genre) => {
      counts[genre] = (counts[genre] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function getTimelineAggregateData(localRows) {
  if (
    shouldUseServerFiltering() &&
    aggregateState.timeline &&
    aggregateState.signature === streamState.filterSignature &&
    aggregateState.timeline.length
  ) {
    return aggregateState.timeline;
  }
  return computeLocalTimelineSeries(localRows);
}

function computeLocalTimelineSeries(localRows) {
  const counts = {};
  (localRows || []).forEach((row) => {
    const year = getReleaseYear(row);
    if (year) counts[year] = (counts[year] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);
}

async function invokeAggregateRpc(fnName, payload) {
  if (!supabase || !fnName) {
    throw new Error("Supabase RPC endpoint unavailable.");
  }
  const normalizedPayload = normalizeAggregatePayload(payload);
  const { data, error } = await supabase.rpc(fnName, normalizedPayload);
  if (error) throw error;
  return data;
}

function scheduleStatusHydration() {
  if (!shouldUseServerFiltering() || !supabase) return;
  const statusSource = getActiveStatusMap();
  const missingKeys = Object.keys(statusSource).filter((key) => {
    const status = statusSource[key];
    if (!status || status === STATUS_NONE) return false;
    return !statusRowCache.has(key);
  });
  if (!missingKeys.length) return;
  if (pendingStatusHydration) return;
  pendingStatusHydration = fetchStatusRows(missingKeys)
    .then((rows) => {
      cacheStatusRows(rows);
    })
    .catch((err) => {
      console.warn("Unable to hydrate status rows from Supabase:", err);
    })
    .finally(() => {
      pendingStatusHydration = null;
      if (latestFilteredData.length) updateStats(latestFilteredData);
    });
}

function handlePaginationClick(target) {
  if (!target) return;
  if (target === "prev") {
    if (paginationState.currentPage <= 1) return;
    paginationState.currentPage -= 1;
  } else if (target === "next") {
    if (paginationState.currentPage >= paginationState.totalPages) return;
    paginationState.currentPage += 1;
  } else {
    const pageNumber = parseInt(target, 10);
    if (
      Number.isNaN(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > paginationState.totalPages ||
      pageNumber === paginationState.currentPage
    ) {
      return;
    }
    paginationState.currentPage = pageNumber;
  }
  const targetEndIndex = paginationState.currentPage * paginationState.pageSize;
  ensureDataCapacity(targetEndIndex, "stream:paged-turn")
    .catch(() => {
      /* errors surfaced via showStatus */
    })
    .finally(() => {
      scrollGridIntoView();
      refreshFilteredView("pager:page-change");
    });
}

function scrollGridIntoView() {
  if (typeof window === "undefined") return;
  const grid = document.getElementById("gameGrid");
  if (!grid) return;
  const currentScroll =
    typeof window.scrollY === "number"
      ? window.scrollY
      : typeof window.pageYOffset === "number"
        ? window.pageYOffset
        : 0;
  const top =
    grid.getBoundingClientRect().top + currentScroll - (prefersReducedMotion() ? 0 : 60);
  if (typeof window.scrollTo === "function") {
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  } else if (typeof window.scroll === "function") {
    window.scroll(0, Math.max(top, 0));
  }
}

function setupBrowseControls() {
  const modeSelect = document.getElementById("browseModeSelect");
  if (modeSelect && !modeSelect.dataset.bound) {
    modeSelect.addEventListener("change", (event) => {
      setBrowseMode(event.target.value);
    });
    modeSelect.dataset.bound = "true";
  }
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  if (pageSizeSelect && !pageSizeSelect.dataset.bound) {
    pageSizeSelect.addEventListener("change", (event) => {
      const next = normalizePageSize(Number(event.target.value));
      if (next === paginationState.pageSize) return;
      paginationState.pageSize = next;
      paginationState.currentPage = 1;
      paginationState.renderedCount = Math.min(next, paginationState.totalItems || next);
      saveBrowsePreferences();
      syncBrowseParams();
      refreshFilteredView("pager:page-size");
    });
    pageSizeSelect.dataset.bound = "true";
  }
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn && !loadMoreBtn.dataset.bound) {
    loadMoreBtn.addEventListener("click", () => extendInfiniteWindow("button"));
    loadMoreBtn.dataset.bound = "true";
  }
  updateBrowseControlsUI();
}

function updateBrowseControlsUI() {
  const modeSelect = document.getElementById("browseModeSelect");
  if (modeSelect) modeSelect.value = browseMode;
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  if (pageSizeSelect) pageSizeSelect.value = paginationState.pageSize.toString();
}

function setBrowseMode(nextMode) {
  const normalized =
    nextMode === BROWSE_MODE_PAGED ? BROWSE_MODE_PAGED : BROWSE_MODE_INFINITE;
  if (browseMode === normalized) return;
  browseMode = normalized;
  if (browseMode === BROWSE_MODE_PAGED) {
    paginationState.currentPage = 1;
  } else {
    paginationState.renderedCount = Math.min(
      paginationState.pageSize,
      paginationState.totalItems || paginationState.pageSize
    );
  }
  saveBrowsePreferences();
  syncBrowseParams();
  refreshFilteredView("pager:mode");
  updateBrowseControlsUI();
}

function teardownInfiniteObserver() {
  if (infiniteObserver) {
    infiniteObserver.disconnect();
    infiniteObserver = null;
  }
}

function setupInfiniteObserver(totalItems) {
  const sentinel = document.getElementById("gridSentinel");
  if (!sentinel) return;
  if (
    browseMode !== BROWSE_MODE_INFINITE ||
    paginationState.renderedCount >= totalItems ||
    !totalItems
  ) {
    sentinel.removeAttribute("data-active");
    teardownInfiniteObserver();
    return;
  }
  if (typeof IntersectionObserver !== "function") {
    sentinel.removeAttribute("data-active");
    return;
  }
  teardownInfiniteObserver();
  infiniteObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        extendInfiniteWindow("sentinel");
      }
    },
    { rootMargin: INFINITE_ROOT_MARGIN }
  );
  infiniteObserver.observe(sentinel);
  sentinel.dataset.active = "true";
}

function extendInfiniteWindow(trigger = "sentinel") {
  if (browseMode !== BROWSE_MODE_INFINITE) return;
  const available = Math.max(paginationState.totalItems, getKnownTotalCount());
  if (
    paginationState.renderedCount >= available &&
    !(streamState.active && streamState.hasMore)
  )
    return;
  if (infiniteTickScheduled) return;
  infiniteTickScheduled = true;
  const desiredCount = paginationState.renderedCount + paginationState.pageSize;
  ensureDataCapacity(desiredCount, `stream:infinite-${trigger}`)
    .catch(() => {
      /* errors handled elsewhere */
    })
    .finally(() => {
      const next = Math.min(desiredCount, rawData.length);
      paginationState.renderedCount = next;
      infiniteTickScheduled = false;
      const start = getNow();
      if (latestSortedData.length) {
        renderInfiniteWindow(latestSortedData, { skipObserver: false });
        recordPerfMetric(`render:infinite-${trigger}`, getNow() - start, {
          rows: next,
          sort: `${sortColumn}:${sortDirection}`,
        });
      } else {
        refreshFilteredView(`infinite:${trigger}`);
      }
    });
}

function compareRows(rowA, rowB, column, direction) {
  const multiplier = direction === "asc" ? 1 : -1;
  if (column === COL_RELEASE_YEAR) {
    const yearA = getReleaseYear(rowA);
    const yearB = getReleaseYear(rowB);
    const safeA =
      typeof yearA === "number" ? yearA : direction === "asc" ? Infinity : -Infinity;
    const safeB =
      typeof yearB === "number" ? yearB : direction === "asc" ? Infinity : -Infinity;
    if (safeA === safeB) return 0;
    return safeA < safeB ? -1 * multiplier : 1 * multiplier;
  }
  if (column === COL_RATING) {
    const ratingA = parseFloat(rowA[COL_RATING]);
    const ratingB = parseFloat(rowB[COL_RATING]);
    const safeA = Number.isFinite(ratingA)
      ? ratingA
      : direction === "asc"
        ? Infinity
        : -Infinity;
    const safeB = Number.isFinite(ratingB)
      ? ratingB
      : direction === "asc"
        ? Infinity
        : -Infinity;
    if (safeA === safeB) return 0;
    return safeA < safeB ? -1 * multiplier : 1 * multiplier;
  }
  const valueA = (rowA[column] || "").toString().toLowerCase();
  const valueB = (rowB[column] || "").toString().toLowerCase();
  if (valueA === valueB) return 0;
  return valueA < valueB ? -1 * multiplier : 1 * multiplier;
}

function renderGameCard(row, index, statusSource) {
  const key = row[COL_GAME] + "___" + row[COL_PLATFORM];
  const statusValue = getStatusForKey(key, statusSource);
  const statusLabel = STATUS_LABELS[statusValue] || STATUS_LABELS[STATUS_NONE];
  const overlayStatus =
    statusValue && statusValue !== STATUS_NONE
      ? `<span class="status-pill status-${statusValue}">${statusLabel}</span>`
      : "";
  const noteValue = getNoteForKey(key, importedNotes || gameNotes);
  const noteBadge = noteValue
    ? '<span class="note-dot" title="Has personal note">✎</span>'
    : "";
  const cover = row[COL_COVER];
  const coverMarkup = cover
    ? `<img src="${cover}" alt="${escapeHtml(row[COL_GAME] || "Cover art")}" loading="lazy">`
    : `<div class="card-placeholder">${escapeHtml(
        (row[COL_GAME] || "?").toString().slice(0, 2)
      )}</div>`;
  const platformText = row[COL_PLATFORM]
    ? escapeHtml(row[COL_PLATFORM])
    : "Unknown platform";
  const releaseYear = getReleaseYear(row);
  const platformMeta = releaseYear ? `${platformText} • ${releaseYear}` : platformText;
  const ratingValue = parseFloat(row[COL_RATING]);
  const ratingMarkup = Number.isFinite(ratingValue)
    ? `<span class="card-rating">${ratingValue.toFixed(1).replace(/\.0$/, "")}</span>`
    : "";
  const regionMarkup = row.region ? `<span>${escapeHtml(row.region)}</span>` : "";
  const modeMarkup = row.player_mode ? `<span>${escapeHtml(row.player_mode)}</span>` : "";
  const metaParts = [ratingMarkup, regionMarkup, modeMarkup].filter(Boolean).join("");
  const metaMarkup = metaParts ? `<div class="card-meta">${metaParts}</div>` : "";
  const genres = row[COL_GENRE]
    ? row[COL_GENRE].split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const tagsMarkup = genres.length
    ? `<div class="card-tags">${genres.map((g) => `<span>${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const statusControl = importedCollection
    ? `<div class="card-status-control"><span>Collection</span><span class="status-pill status-${statusValue}">${statusLabel}</span>${noteBadge}</div>`
    : `<div class="card-status-control"><span>Collection</span>${renderStatusSelect(key, statusValue)}${noteBadge}</div>`;

  return `<article class="game-card" data-row="${index}">
    <div class="card-media">
      ${coverMarkup}
      ${overlayStatus}
    </div>
    <div class="card-body">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(row[COL_GAME] || "Untitled")}</h3>
        <p class="card-subtitle">${platformMeta}</p>
      </div>
      ${metaMarkup}
      ${tagsMarkup}
      ${statusControl}
      <div class="card-actions">
        <button type="button" class="primary-action" data-row="${index}">Details</button>
      </div>
    </div>
  </article>`;
}

function renderStatusSelect(key, current) {
  return `<select class="status-select" data-key="${key}">
    ${STATUS_OPTIONS.map(
      (option) =>
        `<option value="${option.value}" ${current === option.value ? "selected" : ""}>${
          option.label
        }</option>`
    ).join("")}
  </select>`;
}

function syncSortControl() {
  const sortSelect = document.getElementById("sortControl");
  if (!sortSelect) return;
  sortSelect.value = getSortControlValue();
}

function getSortControlValue() {
  if (sortColumn === COL_GAME && sortDirection === "desc") return "name-desc";
  if (sortColumn === COL_RATING && sortDirection === "desc") return "rating-desc";
  if (sortColumn === COL_RATING && sortDirection === "asc") return "rating-asc";
  if (sortColumn === COL_RELEASE_YEAR && sortDirection === "desc") return "year-desc";
  if (sortColumn === COL_RELEASE_YEAR && sortDirection === "asc") return "year-asc";
  return "name-asc";
}

function applySortSelection(value) {
  switch (value) {
    case "name-desc":
      sortColumn = COL_GAME;
      sortDirection = "desc";
      break;
    case "rating-desc":
      sortColumn = COL_RATING;
      sortDirection = "desc";
      break;
    case "rating-asc":
      sortColumn = COL_RATING;
      sortDirection = "asc";
      break;
    case "year-desc":
      sortColumn = COL_RELEASE_YEAR;
      sortDirection = "desc";
      break;
    case "year-asc":
      sortColumn = COL_RELEASE_YEAR;
      sortDirection = "asc";
      break;
    case "name-asc":
    default:
      sortColumn = COL_GAME;
      sortDirection = "asc";
  }
}

/**
 * Update game count and average rating stats in the stats area.
 */
function updateStats(data) {
  latestFilteredData = data;
  const totalMatches = getKnownTotalCount();
  const loadedRatings = data
    .map((row) => parseFloat(row[COL_RATING]))
    .filter((n) => !Number.isNaN(n));
  const avg =
    loadedRatings.length && data.length
      ? (loadedRatings.reduce((a, b) => a + b, 0) / loadedRatings.length).toFixed(2)
      : "-";
  const platforms = new Set(
    data.map((row) => row[COL_PLATFORM]).filter((value) => !!value)
  );
  const { counts: statusCounts, missing } = computeStatusCounts();
  const statusSummary = [
    `Owned: ${statusCounts[STATUS_OWNED]}`,
    `Wishlist: ${statusCounts[STATUS_WISHLIST]}`,
    `Backlog: ${statusCounts[STATUS_BACKLOG]}`,
    `Trade: ${statusCounts[STATUS_TRADE]}`,
  ].join(" | ");
  const statsMessageParts = [
    `Matches: ${totalMatches.toLocaleString()}`,
    statusSummary,
    `Avg Rating (loaded): ${avg}`,
    `Platforms (loaded): ${platforms.size}`,
  ];
  if (missing && shouldUseServerFiltering()) {
    statsMessageParts.push(`Syncing ${missing} status row${missing === 1 ? "" : "s"}…`);
  }
  document.getElementById("stats").textContent = statsMessageParts.join(" | ");

  updateDashboard(statusCounts, data);
  scheduleAggregateHydration();
  if (missing) scheduleStatusHydration();
}

function computeStatusCounts() {
  const statusSource = getActiveStatusMap();
  const counts = {
    [STATUS_OWNED]: 0,
    [STATUS_WISHLIST]: 0,
    [STATUS_BACKLOG]: 0,
    [STATUS_TRADE]: 0,
  };
  let missing = 0;
  Object.entries(statusSource).forEach(([key, status]) => {
    if (!status || status === STATUS_NONE) return;
    const cachedRow = statusRowCache.get(key);
    if (cachedRow) {
      if (doesRowMatchFilters(cachedRow, statusSource) && counts[status] !== undefined) {
        counts[status] += 1;
      }
      return;
    }
    const localRow =
      latestFilteredData.find((row) => buildRowKey(row) === key) ||
      rawData.find((row) => buildRowKey(row) === key);
    if (localRow) {
      cacheStatusRows([localRow]);
      if (doesRowMatchFilters(localRow, statusSource) && counts[status] !== undefined) {
        counts[status] += 1;
      }
      return;
    }
    missing += 1;
  });
  return { counts, missing };
}

function collectStatusRows() {
  const statusSource = getActiveStatusMap();
  const result = [];
  if (!statusSource) return result;
  let fallbackRows = null;
  Object.entries(statusSource).forEach(([key, status]) => {
    if (!status || status === STATUS_NONE) return;
    let row = statusRowCache.get(key);
    if (!row) {
      if (!fallbackRows) {
        fallbackRows = new Map();
        rawData.forEach((entry) => {
          const entryKey = buildRowKey(entry);
          if (entryKey && !fallbackRows.has(entryKey)) fallbackRows.set(entryKey, entry);
        });
      }
      row = fallbackRows.get(key);
    }
    if (row) {
      result.push({ key, status, row });
    }
  });
  return result;
}

function updateDashboard(statusCounts, data) {
  initCarouselControls();
  const statusConfig = [
    { key: STATUS_OWNED, prefix: "dash-owned", label: "Owned" },
    { key: STATUS_WISHLIST, prefix: "dash-wishlist", label: "Wishlist" },
    { key: STATUS_BACKLOG, prefix: "dash-backlog", label: "Backlog" },
    { key: STATUS_TRADE, prefix: "dash-trade", label: "Trade" },
  ];
  const totalStatuses = statusConfig.reduce(
    (sum, entry) => sum + (statusCounts[entry.key] || 0),
    0
  );
  statusConfig.forEach((entry) => {
    const count = statusCounts[entry.key] || 0;
    const percentValue = totalStatuses ? (count / totalStatuses) * 100 : 0;
    const percentText = formatPercent(percentValue, count);
    const countEl = document.getElementById(`${entry.prefix}-count`);
    const percentEl = document.getElementById(`${entry.prefix}-percent`);
    const barFill = document.getElementById(`${entry.prefix}-bar`);
    const bar = barFill ? barFill.parentElement : null;
    if (countEl) countEl.textContent = count.toLocaleString();
    if (percentEl) percentEl.textContent = percentText;
    if (bar) {
      const ariaValue = count > 0 && percentValue < 1 ? 1 : Math.round(percentValue);
      bar.setAttribute("aria-valuenow", ariaValue.toString());
    }
    if (barFill) {
      const widthValue =
        count > 0 && percentValue < 1 ? "1%" : `${Math.min(percentValue, 100)}%`;
      if (!prefersReducedMotion()) {
        barFill.classList.remove("is-animating");
        void barFill.offsetWidth;
        barFill.style.setProperty("--fill-width", widthValue);
        barFill.classList.add("is-animating");
      } else {
        barFill.classList.remove("is-animating");
        barFill.style.setProperty("--fill-width", widthValue);
      }
    }
  });

  renderGenreWidget(data);
  renderTimelineWidget(data);
  renderValuationSummary();
}

function renderValuationSummary(options = {}) {
  const card = document.getElementById("dashboard-valuation");
  const statusEl = document.getElementById("valuationStatus");
  if (!card || !statusEl) return;
  if (!priceInsights || !priceInsights.isEnabled()) {
    card.dataset.disabled = "true";
    delete card.dataset.loading;
    statusEl.textContent = "Connect a PriceCharting token to see live valuations.";
    ["owned", "wishlist", "backlog", "trade", "total"].forEach((key) =>
      setValuationMetric(key, null)
    );
    drawSparkline([]);
    return;
  }
  delete card.dataset.disabled;
  const trackedRows = collectStatusRows();
  priceInsights.queueRows(trackedRows, { force: !!options.force });
  const summary = priceInsights.summarize(trackedRows);
  ["owned", "wishlist", "backlog", "trade"].forEach((key) => {
    const statusKey =
      key === "owned"
        ? STATUS_OWNED
        : key === "wishlist"
          ? STATUS_WISHLIST
          : key === "backlog"
            ? STATUS_BACKLOG
            : STATUS_TRADE;
    setValuationMetric(key, summary.totals[statusKey]);
  });
  setValuationMetric("total", summary.totals.total);
  if (!trackedRows.length) {
    statusEl.textContent = "Tag games with statuses to estimate their value.";
    delete card.dataset.loading;
  } else if (summary.missing > 0) {
    statusEl.textContent = `Fetching ${summary.missing} price point${
      summary.missing === 1 ? "" : "s"
    }…`;
    card.dataset.loading = "true";
  } else if (summary.lastUpdated) {
    const ago = timeAgo(summary.lastUpdated);
    statusEl.textContent =
      ago === "just now" ? "Updated just now." : `Updated ${ago} ago.`;
    delete card.dataset.loading;
  } else {
    statusEl.textContent = "Live prices ready.";
    delete card.dataset.loading;
  }
  drawSparkline(summary.history);
}

function setValuationMetric(id, value) {
  const el = document.getElementById(`valuation-${id}`);
  if (!el) return;
  if (!priceInsights || !priceInsights.isEnabled() || !Number.isFinite(value)) {
    el.textContent = "—";
    return;
  }
  el.textContent = priceInsights.formatCurrency(value);
}

function drawSparkline(history, canvasOverride, strokeColor = "#5db1ff") {
  const canvas = canvasOverride || document.getElementById("valuationSparkline");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth || canvas.width || 320;
  const height = canvas.clientHeight || canvas.height || 100;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  if (typeof ctx.resetTransform === "function") {
    ctx.resetTransform();
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const points =
    Array.isArray(history) && history.length
      ? history
          .map((point) => Number(point.total))
          .filter((value) => Number.isFinite(value))
      : [];
  if (!points.length) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();
    return;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length === 1 ? width : width / (points.length - 1);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(93, 177, 255, 0.3)");
  gradient.addColorStop(1, "rgba(93, 177, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fill();
}

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < 86400000) return `${Math.max(1, Math.round(diff / 3600000))}h`;
  return `${Math.max(1, Math.round(diff / 86400000))}d`;
}

function formatAbsoluteDate(value) {
  if (!value) return "";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Produce a relative time label from a date-like input.
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
function formatRelativeDate(value) {
  if (!value) return "";
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return timeAgo(timestamp);
}

if (priceInsights && priceInsights.isEnabled()) {
  priceInsights.subscribe(() => renderValuationSummary());
}

function markCollectionValueDirty() {
  priceState.summaryDirty = true;
  updateCollectionValueSummary();
}

function updateCollectionValueSummary() {
  if (typeof document === "undefined") return;
  if (!priceState.latest || !priceState.latest.size) return;
  if (!priceState.summaryDirty && priceState.ready) return;
  const container = document.getElementById("dashboard-price");
  if (!container) return;
  const totals = computeCollectionValueTotals(getActiveStatusMap());
  PRICE_STATUS_KEYS.forEach((status) => {
    const metrics = totals[status];
    if (!metrics) return;
    const looseEl = document.getElementById(`price-${status}-loose`);
    const cibEl = document.getElementById(`price-${status}-cib`);
    const newEl = document.getElementById(`price-${status}-new`);
    const countEl = document.getElementById(`price-${status}-count`);
    const pricedEl = document.getElementById(`price-${status}-priced`);
    const looseText =
      metrics.priced > 0 ? formatCurrencyFromCents(metrics.loose || 0) : "—";
    const cibText = metrics.priced > 0 ? formatCurrencyFromCents(metrics.cib || 0) : "—";
    const newText = metrics.priced > 0 ? formatCurrencyFromCents(metrics.new || 0) : "—";
    if (looseEl) looseEl.textContent = looseText;
    if (cibEl) cibEl.textContent = cibText;
    if (newEl) newEl.textContent = newText;
    if (countEl) countEl.textContent = metrics.count.toString();
    if (pricedEl) pricedEl.textContent = metrics.priced.toString();
  });
  const updatedEl = container.querySelector("[data-price-summary-updated]");
  if (updatedEl) {
    const absoluteLabel = formatAbsoluteDate(priceState.lastUpdated);
    const relativeLabel = formatRelativeDate(priceState.lastUpdated);
    if (absoluteLabel && relativeLabel) {
      updatedEl.textContent = `Updated ${absoluteLabel} (${relativeLabel})`;
    } else if (absoluteLabel) {
      updatedEl.textContent = `Updated ${absoluteLabel}`;
    } else if (relativeLabel) {
      updatedEl.textContent = `Updated ${relativeLabel}`;
    } else {
      updatedEl.textContent = "";
    }
  }
  container.dataset.loaded = "true";
  priceState.summaryDirty = false;
  priceState.ready = true;
}

function computeCollectionValueTotals(statusMap) {
  const totals = {};
  PRICE_STATUS_KEYS.forEach((status) => {
    totals[status] = {
      count: 0,
      priced: 0,
      loose: 0,
      cib: 0,
      new: 0,
    };
  });
  if (!statusMap || typeof statusMap !== "object") return totals;
  Object.entries(statusMap).forEach(([key, status]) => {
    if (!status || !totals[status]) return;
    const latest = priceState.latest.get(key);
    totals[status].count += 1;
    if (!latest) return;
    const looseValue = normalizeCents(latest.loose_price_cents) || 0;
    const cibValue = normalizeCents(latest.cib_price_cents) || 0;
    const newValue = normalizeCents(latest.new_price_cents) || 0;
    if (looseValue || cibValue || newValue) {
      totals[status].priced += 1;
    }
    totals[status].loose += looseValue;
    totals[status].cib += cibValue;
    totals[status].new += newValue;
  });
  return totals;
}

/**
 * Re-render filtered data and capture render duration metrics.
 * @param {string} reason
 * @returns {GameRow[]}
 */
function refreshFilteredView(reason = "unknown") {
  if (shouldUseServerFiltering()) {
    const payload = buildRemoteFilterPayload();
    const signature = buildRemoteFilterSignature(payload);
    if (
      streamState.filterSignature &&
      signature !== streamState.filterSignature &&
      !reason.startsWith("stream:")
    ) {
      requestRemoteFilterRefresh(payload, signature);
      return [];
    }
    if (!streamState.filterSignature) {
      streamState.filterPayload = { ...payload };
      streamState.filterSignature = signature;
    }
  }
  return finalizeFilteredRender(reason);
}

function finalizeFilteredRender(reason = "unknown") {
  const start = getNow();
  const filtered = applyFilters(rawData);
  const sorted = [...filtered].sort((a, b) =>
    compareRows(a, b, sortColumn, sortDirection)
  );
  latestFilteredData = filtered;
  latestSortedData = sorted;
  if (shouldResetBrowse(reason)) {
    paginationState.currentPage = 1;
    paginationState.renderedCount = Math.min(
      paginationState.pageSize,
      sorted.length || paginationState.pageSize
    );
  } else {
    paginationState.renderedCount = Math.min(
      paginationState.renderedCount || paginationState.pageSize,
      sorted.length
    );
  }
  if (browseMode === BROWSE_MODE_PAGED) {
    renderPagedWindow(sorted);
  } else {
    renderInfiniteWindow(sorted);
  }
  updateStats(filtered);
  scheduleStatusHydration();
  recordPerfMetric(`render:${reason}`, getNow() - start, {
    rows: sorted.length,
    sort: `${sortColumn}:${sortDirection}`,
  });
  return filtered;
}

function requestRemoteFilterRefresh(payload, signature) {
  if (!shouldUseServerFiltering()) return;
  streamState.filterPayload = { ...payload };
  streamState.filterSignature = signature;
  resetAggregateState(signature);
  streamState.nextFrom = 0;
  streamState.totalCount = null;
  streamState.hasMore = true;
  streamState.error = null;
  rawData = [];
  latestSortedData = [];
  latestFilteredData = [];
  statusRowCache.clear();
  teardownVirtualization();
  streamState.loading = true;
  updateBrowseSummaryLoading(true);
  const activeSignature = signature;
  fetchGamesPage(0, streamState.pageSize - 1, payload)
    .then((page) => {
      if (streamState.filterSignature !== activeSignature) return;
      const rows = Array.isArray(page.data) ? page.data : [];
      rawData = rows;
      cacheStatusRows(rows);
      initStreamStateFromPage(page, rows.length, payload);
      finalizeFilteredRender("filter:remote");
    })
    .catch((err) => {
      console.error("Supabase filter fetch failed:", err);
      showError("Unable to load filtered Supabase results.");
    })
    .finally(() => {
      if (streamState.filterSignature === activeSignature) {
        streamState.loading = false;
        updateBrowseSummaryLoading(false);
      }
    });
}

function updateTrendingCarousel(data) {
  initCarouselControls();
  const listEl = document.getElementById("trendingList");
  const windowEl = document.getElementById("trendingWindow");
  if (!listEl || !windowEl) return;

  if (!Array.isArray(data) || !data.length) {
    listEl.innerHTML =
      '<span class="trending-empty" role="listitem">Trending picks will appear once games are added.</span>';
    registerCarouselWindow(windowEl);
    updateCarouselButtons(windowEl);
    return;
  }

  const ratingEntries = data
    .map((row, index) => {
      const rating = parseFloat(row[COL_RATING]);
      return {
        row,
        rating: Number.isFinite(rating) ? rating : null,
        index,
      };
    })
    .filter((item) => item.rating !== null)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      const nameA = (a.row[COL_GAME] || "").toString().toLowerCase();
      const nameB = (b.row[COL_GAME] || "").toString().toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const recentEntries = data
    .map((row, index) => {
      const year = getReleaseYear(row);
      return { row, year: typeof year === "number" ? year : null, index };
    })
    .sort((a, b) => {
      const yearA = a.year === null ? -Infinity : a.year;
      const yearB = b.year === null ? -Infinity : b.year;
      if (yearA !== yearB) return yearB - yearA;
      return b.index - a.index;
    });

  const picks = [];
  const seen = new Set();
  const pushPick = (row) => {
    if (!row) return;
    const key = `${row[COL_GAME] || ""}___${row[COL_PLATFORM] || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    picks.push(row);
  };

  ratingEntries.slice(0, 5).forEach((entry) => pushPick(entry.row));
  recentEntries.slice(0, 5).forEach((entry) => pushPick(entry.row));

  if (picks.length < 8) {
    data.forEach((row) => {
      if (picks.length < 8) pushPick(row);
    });
  }

  if (!picks.length) {
    listEl.innerHTML =
      '<span class="trending-empty" role="listitem">Trending picks will appear once games are added.</span>';
    registerCarouselWindow(windowEl);
    updateCarouselButtons(windowEl);
    return;
  }

  listEl.innerHTML = picks
    .map((row) => {
      const name = escapeHtml(row[COL_GAME] || "Untitled");
      const platform = escapeHtml(row[COL_PLATFORM] || "Unknown platform");
      const yearValue = getReleaseYear(row);
      const yearText = yearValue ? yearValue.toString() : "TBD";
      const ratingValue = parseFloat(row[COL_RATING]);
      const ratingText = Number.isFinite(ratingValue)
        ? ratingValue.toFixed(1).replace(/\.0$/, "")
        : "NR";
      const genres = row[COL_GENRE]
        ? row[COL_GENRE].split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      const primaryGenre = genres.length ? escapeHtml(genres[0]) : "";
      const ratingLabel = ratingText === "NR" ? "Not rated" : `Rating ${ratingText}`;
      return `<article class="trending-card" role="listitem" tabindex="0"><div class="trending-rating" aria-label="${ratingLabel}"><span aria-hidden="true">★</span><span>${ratingText}</span></div><h3>${name}</h3><div class="trending-meta"><span>${platform}</span><span>${escapeHtml(
        yearText
      )}</span>${primaryGenre ? `<span>${primaryGenre}</span>` : ""}</div></article>`;
    })
    .join("");

  registerCarouselWindow(windowEl);
  updateCarouselButtons(windowEl);
}

/**
 * Initialize interactions for the search typeahead panel.
 */
function initTypeahead() {
  const input = document.getElementById("search");
  const panel = document.getElementById("searchSuggestions");
  if (!input || !panel) return;

  panel.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  panel.addEventListener("click", (event) => {
    const target = event.target.closest("[data-suggestion]");
    if (!target) return;
    const encoded = target.getAttribute("data-suggestion") || "";
    try {
      const suggestion = decodeURIComponent(encoded);
      applyTypeaheadSuggestion(suggestion);
    } catch {
      /* ignore malformed suggestion */
    }
  });

  input.addEventListener("focus", () => {
    if (hideSuggestionsTimer) {
      clearTimeout(hideSuggestionsTimer);
      hideSuggestionsTimer = null;
    }
    if (input.value.trim().length >= TYPEAHEAD_MIN_CHARS) {
      queueTypeaheadSuggestions(input.value);
    }
  });

  input.addEventListener("blur", () => {
    hideSuggestionsTimer = setTimeout(() => {
      clearTypeaheadSuggestions();
    }, 120);
  });
}

/**
 * Debounce and schedule fetching of typeahead suggestions.
 * @param {string} rawQuery
 */
function queueTypeaheadSuggestions(rawQuery) {
  const input = document.getElementById("search");
  const panel = document.getElementById("searchSuggestions");
  if (!input || !panel) return;
  if (typeaheadTimer) {
    clearTimeout(typeaheadTimer);
    typeaheadTimer = null;
  }
  if (!rawQuery || rawQuery.trim().length < TYPEAHEAD_MIN_CHARS) {
    clearTypeaheadSuggestions();
    return;
  }
  typeaheadTimer = setTimeout(() => {
    fetchTypeaheadSuggestions(rawQuery.trim());
  }, TYPEAHEAD_DEBOUNCE_MS);
}

/**
 * Fetch typeahead suggestions from Supabase when available, otherwise fall back to local data.
 * @param {string} query
 */
async function fetchTypeaheadSuggestions(query) {
  const panel = document.getElementById("searchSuggestions");
  const input = document.getElementById("search");
  if (!panel || !input) return;
  const requestId = ++activeSuggestionRequest;
  let suggestions = [];
  if (supabase && !FORCE_SAMPLE) {
    const typeaheadTable = streamState.tableName || SUPABASE_TABLE_CANDIDATES[0];
    try {
      const { data, error } = await supabase
        .from(typeaheadTable)
        .select(TYPEAHEAD_SELECT_COLUMNS)
        .ilike(COL_GAME, `${query}%`)
        .order(COL_GAME, { ascending: true })
        .limit(TYPEAHEAD_LIMIT);
      if (error) throw error;
      suggestions = Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("Typeahead Supabase query failed, using local fallback.", err);
      suggestions = buildLocalTypeaheadSuggestions(query);
    }
  } else {
    suggestions = buildLocalTypeaheadSuggestions(query);
  }

  if (requestId !== activeSuggestionRequest) return;
  renderTypeaheadSuggestions(suggestions);
}

/**
 * Local fallback for typeahead suggestions.
 * @param {string} query
 * @returns {GameRow[]}
 */
function buildLocalTypeaheadSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return rawData
    .filter((row) => {
      const name = (row[COL_GAME] || "").toString().toLowerCase();
      return name.startsWith(normalized);
    })
    .slice(0, TYPEAHEAD_LIMIT);
}

/**
 * Render typeahead suggestions panel.
 * @param {GameRow[]} suggestions
 */
function renderTypeaheadSuggestions(suggestions) {
  const panel = document.getElementById("searchSuggestions");
  const input = document.getElementById("search");
  if (!panel || !input) return;
  if (!suggestions || !suggestions.length) {
    panel.innerHTML = '<span class="typeahead-empty">No matches yet. Keep typing.</span>';
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    return;
  }
  panel.innerHTML = suggestions
    .map((row) => {
      const name = escapeHtml(row[COL_GAME] || "Untitled");
      const encodedValue = encodeURIComponent(row[COL_GAME] || "");
      const parts = [];
      if (row[COL_PLATFORM]) parts.push(escapeHtml(row[COL_PLATFORM]));
      const year = getReleaseYear(row);
      if (year) parts.push(escapeHtml(year.toString()));
      const genre =
        row[COL_GENRE] &&
        row[COL_GENRE].split(",")
          .map((g) => g.trim())
          .filter(Boolean)[0];
      if (genre) parts.push(escapeHtml(genre));
      const subtitle = parts.join(" • ");
      return `<button type="button" class="typeahead-item" role="option" data-suggestion="${encodedValue}"><span class="typeahead-primary">${name}</span>${
        subtitle ? `<span class="typeahead-meta">${subtitle}</span>` : ""
      }</button>`;
    })
    .join("");
  panel.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function clearTypeaheadSuggestions() {
  const panel = document.getElementById("searchSuggestions");
  const input = document.getElementById("search");
  if (!panel || !input) return;
  panel.hidden = true;
  panel.innerHTML = "";
  input.setAttribute("aria-expanded", "false");
}

/**
 * Apply a suggestion to the search field and trigger filtering.
 * @param {string} value
 */
function applyTypeaheadSuggestion(value) {
  const input = document.getElementById("search");
  if (!input) return;
  input.value = value;
  searchValue = value.trim().toLowerCase();
  clearTypeaheadSuggestions();
  refreshFilteredView("typeahead-select");
  input.focus();
}

/**
 * Generate and inject JSON-LD structured data spotlighting top-rated games.
 * @param {GameRow[]} data
 */
function updateStructuredData(data) {
  if (
    !Array.isArray(data) ||
    !data.length ||
    typeof document === "undefined" ||
    typeof JSON === "undefined"
  ) {
    return;
  }

  const origin =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin.replace(/\/$/, "")
      : "";
  const featured = getStructuredDataCandidates(data, 6);
  if (!featured.length) return;

  const listItems = featured.map((entry, index) => {
    const videoGame = mapRowToVideoGameSchema(entry, origin);
    return {
      "@type": "ListItem",
      position: index + 1,
      url: videoGame.url,
      item: videoGame,
    };
  });

  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sandgraal's Game List – Collector Spotlight",
    description:
      "Curated retro highlights with platform, genre, and community rating data.",
    itemListElement: listItems,
  };

  let script = document.getElementById("site-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "site-structured-data";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload, null, 2);
}

/**
 * Select the top-rated unique games to describe in structured data.
 * @param {GameRow[]} rows
 * @param {number} limit
 */
function getStructuredDataCandidates(rows, limit = 6) {
  const unique = [];
  const seen = new Set();
  rows
    .map((row) => {
      const rating = parseFloat(row[COL_RATING]);
      const normalizedRating = Number.isFinite(rating) ? rating : null;
      const year = getReleaseYear(row);
      const identifier = `${(row[COL_GAME] || "").toString().trim().toLowerCase()}|${(
        row[COL_PLATFORM] || ""
      )
        .toString()
        .trim()
        .toLowerCase()}`;
      return {
        row,
        rating: normalizedRating,
        year: typeof year === "number" ? year : null,
        identifier,
      };
    })
    .filter((entry) => entry.rating !== null && entry.identifier.trim().length)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (a.year !== b.year) {
        const safeA = a.year === null ? -Infinity : a.year;
        const safeB = b.year === null ? -Infinity : b.year;
        return safeB - safeA;
      }
      const nameA = (a.row[COL_GAME] || "").toString().toLowerCase();
      const nameB = (b.row[COL_GAME] || "").toString().toLowerCase();
      return nameA.localeCompare(nameB);
    })
    .forEach((entry) => {
      if (!seen.has(entry.identifier) && unique.length < limit) {
        unique.push(entry);
        seen.add(entry.identifier);
      }
    });
  return unique;
}

/**
 * Convert a raw row into a schema.org VideoGame representation.
 * @param {{row: GameRow, rating: number|null}} entry
 * @param {string} origin
 */
function mapRowToVideoGameSchema(entry, origin) {
  const { row, rating } = entry;
  const name = (row[COL_GAME] || "").toString();
  const platform = (row[COL_PLATFORM] || "").toString();
  const slug = slugifyStructuredDataId(name, platform);
  const url =
    origin && slug ? `${origin}/#game-${slug}` : slug ? `#game-${slug}` : origin || "";
  const genreList = row[COL_GENRE]
    ? row[COL_GENRE].split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;
  const releaseYear = getReleaseYear(row);
  const imageUrl = normalizeImageUrl(row[COL_COVER], origin);
  /** @type {Record<string, any>} */
  const videoGame = {
    "@type": "VideoGame",
    name: name || "Untitled Retro Game",
    url: url || origin || "",
    gamePlatform: platform || undefined,
    genre: genreList && genreList.length ? genreList : undefined,
    description: `${name} on ${platform} tracked in Sandgraal's retro collection.`,
  };
  if (releaseYear) {
    videoGame.datePublished = `${releaseYear}-01-01`;
  }
  if (imageUrl) {
    videoGame.image = imageUrl;
  }
  if (typeof rating === "number") {
    videoGame.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      bestRating: "10",
      worstRating: "0",
      ratingCount: 1,
    };
    videoGame.review = {
      "@type": "Review",
      name: `${name} community rating`,
      author: {
        "@type": "Organization",
        name: "Sandgraal's Game List",
      },
      datePublished: new Date().toISOString().split("T")[0],
      reviewBody: `${name} on ${platform} earns a ${rating}/10 score from collectors.`,
      reviewRating: {
        "@type": "Rating",
        ratingValue: rating,
        bestRating: "10",
        worstRating: "0",
      },
    };
  }
  return videoGame;
}

/**
 * Normalize a cover path into an absolute URL when possible.
 * @param {string|undefined} value
 * @param {string} origin
 * @returns {string|undefined}
 */
function normalizeImageUrl(value, origin) {
  if (!value) return undefined;
  const stringValue = value.toString();
  if (/^https?:\/\//i.test(stringValue)) return stringValue;
  if (stringValue.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location
        ? window.location.protocol
        : "https:";
    return `${protocol}${stringValue}`;
  }
  if (!origin) return undefined;
  if (stringValue.startsWith("/")) return `${origin}${stringValue}`;
  return `${origin}/${stringValue}`;
}

function encodeStoragePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildStoragePublicUrl(bucket, path) {
  if (!bucket || !path || !STORAGE_PUBLIC_BASE) return null;
  if (bucket !== STORAGE_PUBLIC_BUCKET) return null;
  const trimmed = path.toString().replace(/^\/+/, "");
  return `${STORAGE_PUBLIC_BASE}/${encodeStoragePath(trimmed)}`;
}

function resolveStorageCover(row) {
  if (!row || typeof row !== "object") return null;
  const bucket =
    row.storage_bucket || row.cover_bucket || row.coverBucket || row.cover_storage_bucket;
  const path =
    row.storage_path || row.cover_path || row.cover_storage_path || row.coverPath;
  if (bucket && path) {
    const url = buildStoragePublicUrl(bucket, path);
    if (url) return url;
  }
  if (row.cover_public_url) return row.cover_public_url;
  return null;
}

function detectRegionCodesFromString(value) {
  if (!value) return [];
  const input = value.toString();
  const normalized = input
    .split(/[,/]/)
    .map((token) => token.trim())
    .filter(Boolean);
  const codes = new Set();
  normalized.forEach((token) => {
    REGION_CODES.forEach((code) => {
      if (REGION_MATCHERS[code].some((pattern) => pattern.test(token))) {
        codes.add(code);
      }
    });
  });
  return Array.from(codes);
}

function computeRegionCodes(row) {
  if (!row || typeof row !== "object") return [];
  const codes = new Set();
  const explicit = row.region_code || row.regionCode;
  if (explicit) codes.add(explicit.toString().toUpperCase());
  const list = row.region_codes || row.regionCodes;
  if (Array.isArray(list)) {
    list.forEach((code) => {
      if (code) codes.add(code.toString().toUpperCase());
    });
  }
  const regionField = resolveGameField(row, "region");
  detectRegionCodesFromString(regionField).forEach((code) => codes.add(code));
  return Array.from(codes);
}

function applyRowEnhancements(row) {
  if (!row || typeof row !== "object") return;
  const storageCover = resolveStorageCover(row);
  if (storageCover) {
    row[COL_COVER] = storageCover;
  }
  const regions = computeRegionCodes(row);
  row.__regionCodes = regions;
  if (!row.region && regions.length) {
    row.region = regions.join(", ");
  }
}

function normalizeIncomingRows(rows) {
  if (!Array.isArray(rows)) return rows;
  rows.forEach(applyRowEnhancements);
  return rows;
}

/**
 * Attempt to backfill missing cover art using external sources.
 * @param {GameRow[]} rows
 * @returns {Promise<boolean>}
 */
async function hydrateFallbackCovers(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const now = Date.now();
  let mutated = false;
  /** @type {{ row: GameRow; key: string }[]} */
  const missing = [];
  rows.forEach((row) => {
    if (!row) return;
    const key = buildRowKey(row);
    if (!key) return;
    const cached = fallbackCoverCache.get(key);
    if (cached && cached.url) {
      if (!row[COL_COVER]) {
        row[COL_COVER] = cached.url;
        mutated = true;
      }
      return;
    }
    if (row[COL_COVER]) return;
    if (cached && !shouldRetryFallbackCover(cached, now)) {
      return;
    }
    if (missing.length < FALLBACK_COVER_ATTEMPT_LIMIT) {
      missing.push({ row, key });
    }
  });
  if (!missing.length) {
    if (mutated) persistFallbackCoverCache();
    return mutated;
  }
  if (typeof fetch !== "function") {
    if (mutated) persistFallbackCoverCache();
    return mutated;
  }
  let hadUpdates = mutated;
  for (const item of missing) {
    try {
      const coverUrl = await fetchFallbackCoverFromWikipedia(item.row);
      if (coverUrl) {
        item.row[COL_COVER] = coverUrl;
        fallbackCoverCache.set(item.key, { url: coverUrl, timestamp: Date.now() });
        hadUpdates = true;
      } else {
        fallbackCoverCache.set(item.key, { url: "", failedAt: Date.now() });
      }
    } catch (error) {
      fallbackCoverCache.set(item.key, { url: "", failedAt: Date.now() });
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("Cover fallback failed", item.key, error);
      }
    }
  }
  if (hadUpdates || missing.length) {
    persistFallbackCoverCache();
  }
  return hadUpdates;
}

/**
 * Look up fallback cover art from Wikipedia's REST API.
 * @param {GameRow} row
 * @returns {Promise<string|undefined>}
 */
async function fetchFallbackCoverFromWikipedia(row) {
  const title = (row && row[COL_GAME] ? row[COL_GAME] : "").toString().trim();
  if (!title) return undefined;
  const platform = (row && row[COL_PLATFORM] ? row[COL_PLATFORM] : "").toString().trim();
  const queries = buildFallbackCoverQueries(title, platform);
  if (!queries.length) return undefined;
  for (const query of queries) {
    const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
        },
      });
      if (response.status === 404) {
        continue;
      }
      if (response.status === 429 || response.status === 403) {
        break;
      }
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (payload.type === "disambiguation") {
        continue;
      }
      const image = extractWikipediaImageUrl(payload);
      if (image) {
        return image;
      }
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("Wikipedia cover fetch error", query, error);
      }
    }
  }
  return undefined;
}

/**
 * Build candidate article titles for Wikipedia lookup.
 * @param {string} title
 * @param {string} platform
 * @returns {string[]}
 */
function buildFallbackCoverQueries(title, platform) {
  const cleanedTitle = title.replace(/\s+/g, " ").trim();
  if (!cleanedTitle) return [];
  const queries = new Set();
  const normalizedPlatform = platform.replace(/\s+/g, " ").trim();
  if (normalizedPlatform) {
    resolvePlatformSearchTerms(normalizedPlatform).forEach((term) => {
      queries.add(`${cleanedTitle} (${term})`);
    });
  }
  queries.add(cleanedTitle);
  if (!/video game/i.test(cleanedTitle)) {
    queries.add(`${cleanedTitle} (video game)`);
  }
  return Array.from(queries);
}

/**
 * Derive platform search aliases for Wikipedia queries.
 * @param {string} platform
 * @returns {string[]}
 */
function resolvePlatformSearchTerms(platform) {
  const terms = new Set();
  if (platform) {
    terms.add(platform);
    const normalized = platform.toUpperCase();
    const aliases = PLATFORM_NAME_ALIASES[normalized];
    if (Array.isArray(aliases)) {
      aliases.forEach((alias) => {
        if (alias) terms.add(alias);
      });
    }
  }
  return Array.from(terms).filter(Boolean);
}

/**
 * Extract an image URL from a Wikipedia summary response.
 * @param {any} payload
 * @returns {string|undefined}
 */
function extractWikipediaImageUrl(payload) {
  if (!payload || typeof payload !== "object") return undefined;
  const original =
    payload.originalimage && typeof payload.originalimage.source === "string"
      ? payload.originalimage.source
      : null;
  if (original && /^https?:\/\//i.test(original)) {
    return original;
  }
  const thumb =
    payload.thumbnail && typeof payload.thumbnail.source === "string"
      ? payload.thumbnail.source
      : null;
  if (thumb && /^https?:\/\//i.test(thumb)) {
    return thumb;
  }
  return undefined;
}

/**
 * Determine whether a cached fallback entry should be retried.
 * @param {{ url?: string; failedAt?: number }} entry
 * @param {number} now
 */
function shouldRetryFallbackCover(entry, now) {
  if (!entry) return true;
  if (entry.url) return false;
  if (!entry.failedAt) return true;
  return now - entry.failedAt >= FALLBACK_COVER_RETRY_MS;
}

/**
 * Load persisted fallback covers from storage.
 * @returns {Map<string, {url?: string; timestamp?: number; failedAt?: number}>}
 */
function loadFallbackCoverCache() {
  const storage = getCoverCacheStorage();
  if (!storage) return new Map();
  try {
    const raw = storage.getItem(FALLBACK_COVER_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    const map = new Map();
    Object.keys(parsed).forEach((key) => {
      const value = parsed[key];
      if (value && typeof value === "object") {
        map.set(key, value);
      }
    });
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Persist fallback covers back to storage (with pruning).
 */
function persistFallbackCoverCache() {
  const storage = getCoverCacheStorage();
  if (!storage) return;
  try {
    const sorted = Array.from(fallbackCoverCache.entries()).sort((a, b) => {
      return getFallbackCacheTimestamp(b[1]) - getFallbackCacheTimestamp(a[1]);
    });
    if (sorted.length > FALLBACK_COVER_CACHE_LIMIT) {
      sorted.length = FALLBACK_COVER_CACHE_LIMIT;
    }
    fallbackCoverCache.clear();
    const plain = {};
    sorted.forEach(([key, value]) => {
      fallbackCoverCache.set(key, value);
      plain[key] = value;
    });
    storage.setItem(FALLBACK_COVER_CACHE_KEY, JSON.stringify(plain));
  } catch {
    /* ignore storage failures */
  }
}

/**
 * Resolve a usable timestamp for cache pruning.
 * @param {{ timestamp?: number; failedAt?: number }} entry
 * @returns {number}
 */
function getFallbackCacheTimestamp(entry) {
  if (!entry || typeof entry !== "object") return 0;
  if (typeof entry.timestamp === "number") return entry.timestamp;
  if (typeof entry.failedAt === "number") return entry.failedAt;
  return 0;
}

/**
 * Locate a localStorage-like implementation.
 * @returns {Storage|null}
 */
function getCoverCacheStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* noop */
  }
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Generate a stable slug for schema identifiers.
 * @param {string} name
 * @param {string} platform
 */
function slugifyStructuredDataId(name, platform) {
  const combined = `${name || ""}-${platform || ""}`.toLowerCase();
  return combined.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Export user's owned games as a CSV.
 */
function exportOwnedGames() {
  const rows = rawData.filter(
    (row) => getStatusForKey(row[COL_GAME] + "___" + row[COL_PLATFORM]) === STATUS_OWNED
  );
  if (!rows.length) {
    showError("No owned games to export!");
    return;
  }
  let out =
    Object.keys(rawData[0]).join(",") +
    "\n" +
    rows
      .map((row) =>
        Object.values(row)
          .map((cell) => `"${(cell || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  let blob = new Blob([out], { type: "text/csv" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "sandgraal-collection.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Display the share/import section with a code to copy or a field to import.
 */
function showShareSection() {
  const payload = {
    statuses: {},
    notes: {},
  };
  Object.entries(gameStatuses).forEach(([key, status]) => {
    if (status && status !== STATUS_NONE) {
      payload.statuses[key] = status;
    }
  });
  Object.entries(gameNotes).forEach(([key, note]) => {
    if (note && note.trim()) {
      payload.notes[key] = note;
    }
  });
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  document.getElementById("shareSection").style.display = "";
  document.getElementById("shareCode").value = code;
  document.getElementById("importCode").value = "";
  document.getElementById("importResult").textContent = "";
}
function showImportSection() {
  document.getElementById("shareSection").style.display = "";
  document.getElementById("shareCode").value = "";
  document.getElementById("importCode").value = "";
  document.getElementById("importResult").textContent = "";
}

/**
 * Import a shared code (status assignments) and display the imported collection.
 */
function importCollection() {
  let code = document.getElementById("importCode").value.trim();
  if (!code) {
    showError("Paste a code first.");
    return;
  }
  let coll = {};
  let noteMap = {};
  try {
    let decoded = decodeURIComponent(escape(atob(code)));
    if (decoded.trim().startsWith("{")) {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        coll = parsed.statuses || {};
        noteMap = parsed.notes || {};
      }
    } else {
      decoded.split("|").forEach((entry) => {
        if (!entry) return;
        const [key, status] = entry.split("::");
        if (!key) return;
        const normalized = status && STATUS_LABELS[status] ? status : STATUS_OWNED;
        coll[key] = normalized;
      });
    }
    Object.keys(noteMap).forEach((key) => {
      if (!coll[key]) coll[key] = STATUS_NONE;
    });
    importedCollection = coll;
    importedNotes = noteMap;
    refreshFilteredView("share-import");
    markCollectionValueDirty();
    document.getElementById("importResult").textContent =
      "Imported! Viewing shared collection.";
  } catch (e) {
    console.error("Failed to import collection code:", e);
    showError("Invalid code.");
  }
}

/**
 * Close the share/import section and return to normal view.
 */
function closeShareSection() {
  importedCollection = null;
  importedNotes = null;
  document.getElementById("shareSection").style.display = "none";
  refreshFilteredView("share-close");
  markCollectionValueDirty();
}

function exportCollectionBackup() {
  const payload = getBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = BACKUP_FILENAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus("Backup downloaded.", "info");
}

/**
 * Build the portable backup payload.
 * @returns {{statuses: StatusMap, notes: NoteMap, filters: FilterState}}
 */
function getBackupPayload() {
  return {
    statuses: gameStatuses,
    notes: gameNotes,
    filters: persistedFilters,
  };
}

/**
 * Restore a backup from an uploaded file.
 * @param {File} file
 */
function restoreCollectionBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
      if (parsed.statuses && typeof parsed.statuses === "object") {
        gameStatuses = parsed.statuses;
        saveStatuses();
      }
      if (parsed.notes && typeof parsed.notes === "object") {
        gameNotes = parsed.notes;
        saveNotes();
      }
      if (parsed.filters && typeof parsed.filters === "object") {
        persistedFilters = parsed.filters;
        filterStatus = persistedFilters.filterStatus || "";
        filterRatingMin = persistedFilters.filterRatingMin || "";
        filterYearStart = persistedFilters.filterYearStart || "";
        filterYearEnd = persistedFilters.filterYearEnd || "";
        filterRegion = persistedFilters.filterRegion || "";
        savePersistedFilters();
      }
      applyFiltersToInputs();
      refreshFilteredView("restore-backup");
      showStatus("Backup restored successfully.", "info");
    } catch (err) {
      console.error("Restore failed:", err);
      showError("Failed to restore backup.");
    }
  };
  reader.readAsText(file);
}
function setupContributionWorkflow() {
  const openBtn = document.getElementById("contributeBtn");
  const modal = document.getElementById("contributeModal");
  const form = document.getElementById("contributeForm");
  if (!openBtn || !modal || !form) return;
  const closeButtons = modal.querySelectorAll("[data-contribute-close]");
  openBtn.addEventListener("click", openContributionModal);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeContributionModal);
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeContributionModal();
    }
  });
  form.addEventListener("submit", handleContributionSubmit);
}

function openContributionModal() {
  const modal = document.getElementById("contributeModal");
  if (!modal) return;
  contributionModalOpen = true;
  modal.setAttribute("aria-hidden", "false");
  const form = document.getElementById("contributeForm");
  setContributionStatus("");
  if (form) {
    const firstInput = form.querySelector("input, select, textarea");
    if (firstInput && typeof firstInput.focus === "function") {
      firstInput.focus();
    }
  }
  document.addEventListener("keydown", handleContributionEscape, true);
}

function closeContributionModal() {
  const modal = document.getElementById("contributeModal");
  if (!modal) return;
  contributionModalOpen = false;
  modal.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", handleContributionEscape, true);
  const form = document.getElementById("contributeForm");
  if (form) {
    form.reset();
  }
  setContributionStatus("");
}

function handleContributionEscape(event) {
  if (!contributionModalOpen) return;
  if (event.key === "Escape") {
    event.stopPropagation();
    closeContributionModal();
  }
}

function setContributionStatus(message, variant = "info") {
  const statusEl = document.querySelector(".contribute-status");
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.dataset.variant = variant;
}

function buildContributionPayload(formData) {
  const title = (formData.get("title") || "").toString().trim();
  const platform = (formData.get("platform") || "").toString().trim();
  const region = (formData.get("region") || "NTSC").toString().trim();
  const assetType = (formData.get("assetType") || "image").toString().trim();
  const sourceUrl = (formData.get("sourceUrl") || "").toString().trim();
  const contact = (formData.get("contact") || "").toString().trim();
  const notes = (formData.get("notes") || "").toString().trim();
  const row = { [COL_GAME]: title, [COL_PLATFORM]: platform };
  const key = buildRowKey(row) || `${title}___${platform}`;
  return {
    title,
    platform,
    regionCode: region || "NTSC",
    assetType: assetType || "image",
    sourceUrl,
    contact,
    notes,
    gameKey: key,
  };
}

async function handleContributionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  if (!supabase) {
    setContributionStatus("Supabase credentials missing. Unable to submit.", "error");
    return;
  }
  const formData = new FormData(form);
  const file = formData.get("file");
  if (!(file instanceof File)) {
    setContributionStatus("Select a file to upload.", "error");
    return;
  }
  const payload = buildContributionPayload(formData);
  if (!payload.title || !payload.platform || !payload.sourceUrl) {
    setContributionStatus("Title, platform, and source URL are required.", "error");
    return;
  }
  const allowed =
    CONTRIBUTION_ALLOWED_TYPES[payload.assetType] || CONTRIBUTION_ALLOWED_TYPES.image;
  if (!allowed.includes(file.type)) {
    setContributionStatus("Unsupported file type. Check the guidelines.", "error");
    return;
  }
  if (file.size > CONTRIBUTION_MAX_BYTES) {
    setContributionStatus("File exceeds the 25MB limit.", "error");
    return;
  }

  try {
    setContributionStatus("Requesting upload slot…");
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
      "request-media-upload",
      {
        body: {
          filename: file.name,
          contentType: file.type,
          byteSize: file.size,
          assetType: payload.assetType,
          regionCode: payload.regionCode,
        },
      }
    );
    if (uploadError || !uploadData) {
      throw new Error(uploadError?.message || "Unable to request upload URL");
    }
    const bucket = uploadData.bucket || STORAGE_PENDING_BUCKET;
    const storagePath = uploadData.path;
    const token = uploadData.token;
    if (!bucket || !storagePath || !token) {
      throw new Error("Invalid upload response from server.");
    }
    setContributionStatus("Uploading file…");
    const storage = supabase.storage.from(bucket);
    const uploadResult = await storage.uploadToSignedUrl(storagePath, token, file, {
      contentType: file.type,
    });
    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || "Upload failed");
    }
    setContributionStatus("Recording submission…");
    const { error: insertError } = await supabase.from("pending_media").insert({
      game_key: payload.gameKey,
      title: payload.title,
      platform: payload.platform,
      region_code: payload.regionCode,
      asset_type: payload.assetType,
      original_filename: file.name,
      content_type: file.type,
      byte_size: file.size,
      storage_bucket: bucket,
      storage_path: storagePath,
      source_url: payload.sourceUrl,
      submitted_by: payload.contact || null,
      notes: payload.notes || null,
    });
    if (insertError) {
      throw new Error(insertError.message || "Unable to save submission");
    }
    setContributionStatus(
      "Thanks! Moderators will review your submission within five business days.",
      "success"
    );
    form.reset();
  } catch (error) {
    setContributionStatus(error.message || "Unable to submit right now.", "error");
  }
}

/**
 * Display status messaging under the filters.
 */
function showStatus(msg, variant = "info") {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "";
  el.dataset.variant = variant === "error" ? "error" : "info";
  el.textContent = msg;
}

function hideStatus() {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "none";
  delete el.dataset.variant;
}

/**
 * Show error in a styled message area (not a blocking alert).
 */
function showError(msg) {
  showStatus(msg, "error");
}

function buildPricePanelMarkup() {
  return `<section class="price-panel" data-price-panel>
    <h3>Price &amp; Value</h3>
    <div class="price-panel-grid">
      <div class="price-panel-metric">
        <span>Loose</span>
        <strong data-price-loose>—</strong>
      </div>
      <div class="price-panel-metric">
        <span>CIB</span>
        <strong data-price-cib>—</strong>
      </div>
      <div class="price-panel-metric">
        <span>New</span>
        <strong data-price-new>—</strong>
      </div>
      <div class="price-panel-metric">
        <span>Tracked Status</span>
        <strong data-price-status>—</strong>
      </div>
    </div>
    <div class="price-panel-history">
      <canvas data-price-sparkline width="260" height="80"></canvas>
    </div>
    <p class="price-panel-note" data-price-note>Fetching live prices…</p>
    <div class="price-panel-variants" data-price-variants hidden>
      <h4>Regional Variants</h4>
      <ul class="price-variant-list" data-price-variant-list></ul>
    </div>
  </section>`;
}

function ingestVariantPrices(rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (!row || !row.game_key || !row.region_code) return;
    const key = row.game_key;
    const region = row.region_code;
    if (!variantPriceMap.has(key)) {
      variantPriceMap.set(key, new Map());
    }
    const entry = {
      region: region,
      currency: row.currency || "USD",
      loose: row.loose_price_cents ?? null,
      cib: row.cib_price_cents ?? null,
      brandNew: row.new_price_cents ?? null,
      looseDelta: row.loose_delta_percent ?? null,
      cibDelta: row.cib_delta_percent ?? null,
      newDelta: row.new_delta_percent ?? null,
      snapshotDate: row.snapshot_date || null,
    };
    variantPriceMap.get(key).set(region, entry);
  });
}

async function loadVariantPriceDeltas() {
  if (variantPriceMap.size) return;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("game_variant_price_deltas")
        .select("*");
      if (!error && Array.isArray(data)) {
        ingestVariantPrices(data);
        return;
      }
    } catch (error) {
      if (typeof console !== "undefined") {
        console.debug("Variant price fetch failed", error);
      }
    }
  }
  try {
    const response = await fetch(VARIANT_PRICE_SAMPLE_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      ingestVariantPrices(Array.isArray(payload) ? payload : []);
    }
  } catch (error) {
    if (typeof console !== "undefined") {
      console.debug("Variant price fallback load failed", error);
    }
  }
}

function getVariantPricesForKey(key) {
  if (!key) return [];
  const entry = variantPriceMap.get(key);
  if (!entry) return [];
  return Array.from(entry.values());
}

function formatVariantDelta(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(1)}%`;
}

function renderVariantPrices(panel, key) {
  if (!panel) return;
  const container = panel.querySelector("[data-price-variants]");
  const listEl = panel.querySelector("[data-price-variant-list]");
  if (!container || !listEl) return;
  const variants = getVariantPricesForKey(key).filter((entry) => entry.region !== "NTSC");
  if (!variants.length) {
    container.hidden = true;
    listEl.innerHTML = "";
    return;
  }
  const items = variants
    .map((entry) => {
      const delta = entry.cibDelta ?? entry.looseDelta ?? entry.newDelta;
      const deltaLabel = formatVariantDelta(delta);
      const lines = [];
      if (entry.cib !== null) {
        lines.push(`CIB: ${formatCurrencyFromCents(entry.cib, { precise: true })}`);
      }
      if (entry.loose !== null) {
        lines.push(`Loose: ${formatCurrencyFromCents(entry.loose, { precise: true })}`);
      }
      if (entry.brandNew !== null) {
        lines.push(`New: ${formatCurrencyFromCents(entry.brandNew, { precise: true })}`);
      }
      const subtitle = lines.join(" · ");
      const deltaText = deltaLabel
        ? `<span class="price-variant-delta">${deltaLabel}</span>`
        : "";
      const label = REGION_LABELS[entry.region] || entry.region;
      return `<li><strong>${label}</strong> ${deltaText}<div class="price-variant-meta">${subtitle}</div></li>`;
    })
    .join("");
  listEl.innerHTML = items;
  container.hidden = false;
}

function hydrateModalPricePanel(modal, key) {
  if (!modal) return;
  const panel = modal.querySelector("[data-price-panel]");
  if (!panel) return;
  const emptyEl = panel.querySelector("[data-price-empty]");
  const bodyEl = panel.querySelector("[data-price-body]");
  const historyWrap = panel.querySelector("[data-price-role='history']");
  const updatedEl = panel.querySelector("[data-price-role='updated']");
  const latest = priceState.latest.get(key);
  if (!latest) {
    if (emptyEl) emptyEl.hidden = false;
    if (bodyEl) bodyEl.hidden = true;
    if (historyWrap) historyWrap.hidden = true;
    if (updatedEl) updatedEl.textContent = "";
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  if (bodyEl) bodyEl.hidden = false;
  if (historyWrap) historyWrap.hidden = false;
  const looseEl = panel.querySelector("[data-price-role='loose']");
  const cibEl = panel.querySelector("[data-price-role='cib']");
  const newEl = panel.querySelector("[data-price-role='new']");
  if (looseEl) {
    looseEl.textContent = formatCurrencyFromCents(latest.loose_price_cents, {
      precise: true,
    });
  }
  if (cibEl) {
    cibEl.textContent = formatCurrencyFromCents(latest.cib_price_cents, {
      precise: true,
    });
  }
  if (newEl) {
    newEl.textContent = formatCurrencyFromCents(latest.new_price_cents, {
      precise: true,
    });
  }
  if (updatedEl) {
    const sourceLabel = latest.source || PRICE_SOURCE;
    const when = latest.snapshot_date || latest.fetched_at;
    updatedEl.textContent = when
      ? `${sourceLabel} • ${formatRelativeDate(when)}`
      : sourceLabel;
  }
  const chartEl = panel.querySelector("[data-price-role='chart']");
  const trendEl = panel.querySelector("[data-price-role='trend']");
  if (chartEl) {
    chartEl.innerHTML = '<div class="price-chart-loading">Loading history…</div>';
    loadPriceHistory(key)
      .then((history) => {
        renderPriceHistoryChart(chartEl, history);
        if (trendEl) {
          trendEl.textContent = formatPriceTrend(history);
        }
      })
      .catch(() => {
        chartEl.innerHTML = '<p class="price-chart-empty">Unable to load history.</p>';
        if (trendEl) trendEl.textContent = "";
      });
  }
  renderVariantPrices(panel, key);
}

function buildMetadataCard(title, items, { layout = "grid", footerHtml = "" } = {}) {
  const safeTitle = title ? escapeHtml(title) : "";
  const hasItems = Array.isArray(items) && items.length > 0;
  const containerClass = layout === "stacked" ? "metadata-list" : "metadata-grid";
  const itemClass = layout === "stacked" ? "metadata-item stacked" : "metadata-item";
  const body = hasItems
    ? items
        .map((item) => {
          const label = escapeHtml(item.label || "");
          const value = escapeHtml(String(item.value ?? ""));
          return `<div class="${itemClass}">
            <p class="metadata-label">${label}</p>
            <p class="metadata-value">${value}</p>
          </div>`;
        })
        .join("")
    : "";
  if (!hasItems && !footerHtml) return "";
  return `<article class="modal-section">
    ${safeTitle ? `<h3>${safeTitle}</h3>` : ""}
    ${hasItems ? `<div class="${containerClass}">${body}</div>` : ""}
    ${footerHtml || ""}
  </article>`;
}

function buildFallbackMetadata(game, consumed) {
  if (!game) return "";
  const items = Object.keys(game)
    .filter((key) => {
      if (consumed.has(key)) return false;
      const value = game[key];
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    })
    .map((key) => ({
      label: formatFieldLabel(key),
      value: game[key],
    }));
  if (!items.length) return "";
  return buildMetadataCard("Additional Details", items, { layout: "stacked" });
}

function buildModalMetadataSections(game) {
  if (!game) return "";
  const consumed = new Set();
  markFieldConsumed(consumed, COL_GAME);
  markFieldConsumed(consumed, COL_COVER);
  markFieldConsumed(consumed, "cover_url");
  markFieldConsumed(consumed, "coverUrl");
  markFieldConsumed(consumed, "screenshots");
  const sections = [];

  const releaseItems = [];
  const platformValue = resolveGameField(game, COL_PLATFORM);
  if (platformValue) {
    releaseItems.push({ label: "Platform", value: platformValue });
    markFieldConsumed(consumed, COL_PLATFORM);
  }
  const releaseYear = getReleaseYear(game);
  if (releaseYear) {
    releaseItems.push({ label: "Release Year", value: releaseYear });
    markFieldConsumed(consumed, COL_RELEASE_YEAR);
  }
  const ratingValue = parseFloat(game[COL_RATING]);
  const ratingCategory = resolveGameField(game, "ratingCategory");
  if (Number.isFinite(ratingValue)) {
    let text = ratingValue.toFixed(1).replace(/\.0$/, "");
    if (ratingCategory) text += ` (${ratingCategory})`;
    releaseItems.push({ label: "Rating", value: text });
    markFieldConsumed(consumed, COL_RATING);
    if (ratingCategory) markFieldConsumed(consumed, "ratingCategory");
  } else if (ratingCategory) {
    releaseItems.push({ label: "Rating Tier", value: ratingCategory });
    markFieldConsumed(consumed, "ratingCategory");
  }
  if (releaseItems.length) {
    sections.push(buildMetadataCard("Release & Rating", releaseItems));
  }

  const gameplayItems = [];
  const genreValue = resolveGameField(game, COL_GENRE);
  if (genreValue) {
    const genres = genreValue
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .join(", ");
    gameplayItems.push({ label: "Genre", value: genres || genreValue });
    markFieldConsumed(consumed, COL_GENRE);
  }
  const modeValue = resolveGameField(game, "playerMode");
  if (modeValue) {
    gameplayItems.push({ label: "Player Mode", value: modeValue });
    markFieldConsumed(consumed, "playerMode");
  }
  const playerCount = resolveGameField(game, "playerCount");
  if (playerCount) {
    gameplayItems.push({ label: "Players", value: playerCount });
    markFieldConsumed(consumed, "playerCount");
  }
  if (gameplayItems.length) {
    sections.push(buildMetadataCard("Gameplay", gameplayItems));
  }

  const regionItems = [];
  const regionValue = resolveGameField(game, "region");
  if (regionValue) {
    regionItems.push({ label: "Regions", value: regionValue });
    markFieldConsumed(consumed, "region");
  }
  const notesValue = resolveGameField(game, "notes");
  if (notesValue) {
    regionItems.push({ label: "Notes", value: notesValue });
    markFieldConsumed(consumed, "notes");
  }
  const detailsUrl = resolveGameField(game, "detailsUrl");
  if (detailsUrl) {
    markFieldConsumed(consumed, "detailsUrl");
  }
  if (regionItems.length || detailsUrl) {
    const footerHtml = detailsUrl
      ? `<div class="metadata-footer"><a class="metadata-link" href="${escapeHtml(
          detailsUrl
        )}" target="_blank" rel="noopener">View reference</a></div>`
      : "";
    sections.push(
      buildMetadataCard("Regions & Versions", regionItems, {
        layout: "stacked",
        footerHtml,
      })
    );
  }

  const fallback = buildFallbackMetadata(game, consumed);
  if (fallback) sections.push(fallback);

  if (!sections.length) return "";
  return `<div class="modal-sections">${sections.join("")}</div>`;
}

function renderPriceHistoryChart(container, history) {
  if (!container) return;
  const series = Array.isArray(history)
    ? history
        .map((entry) => ({
          value: resolvePriceValue(entry),
        }))
        .filter((point) => Number.isFinite(point.value))
    : [];
  if (!series.length) {
    container.innerHTML = '<p class="price-chart-empty">No history yet.</p>';
    return;
  }
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pointsAttr = series
    .map((point, index) => {
      const x = (index / (series.length - 1 || 1)) * 100;
      const normalized = (point.value - min) / range;
      const y = 100 - normalized * (100 - PRICE_HISTORY_PAD * 2) - PRICE_HISTORY_PAD;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  container.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Recent price trend">
    <polyline class="price-history-line" points="${pointsAttr}" fill="none" vector-effect="non-scaling-stroke" />
  </svg>`;
}

function formatPriceTrend(history) {
  const delta = computePriceDelta(history);
  if (delta === null) return "Trend data coming soon.";
  const direction = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  return `${direction} ${Math.abs(delta).toFixed(1)}% across ${history.length} points`;
}

/**
 * Show a modal popout with game details.
 * @param {GameRow} game
 */
function showGameModal(game) {
  const modal = document.getElementById("gameModal");
  const modalBg = document.getElementById("modalBg");
  const key = (game[COL_GAME] || "") + "___" + (game[COL_PLATFORM] || "");
  let galleryImages = [];
  if (Array.isArray(game.screenshots) && game.screenshots.length) {
    galleryImages = game.screenshots;
  } else if (game[COL_COVER]) {
    galleryImages = [game[COL_COVER]];
  }
  galleryImages = Array.from(new Set(galleryImages.filter(Boolean)));
  // Build modal HTML (no user HTML injected)
  let html = `<button class="modal-close" title="Close" aria-label="Close">&times;</button>`;
  html += `<div class="modal-title">${game[COL_GAME] || "(No Name)"}</div>`;
  if (game[COL_COVER]) html += `<img src="${game[COL_COVER]}" alt="cover art">`;
  if (galleryImages.length) {
    const firstImage = galleryImages[0];
    html += `<div class="modal-gallery" data-current-index="0">
      <button class="gallery-nav prev" aria-label="Previous screenshot">&#10094;</button>
      <img src="${firstImage}" alt="${game[COL_GAME] || ""} media" class="gallery-image">
      <button class="gallery-nav next" aria-label="Next screenshot">&#10095;</button>
      <div class="gallery-counter">1 / ${galleryImages.length}</div>
    </div>`;
  }
  const metadataSections = buildModalMetadataSections(game);
  if (metadataSections) {
    html += metadataSections;
  } else {
    html += `<dl>`;
    for (let k in game) {
      if ([COL_GAME, COL_COVER].includes(k)) continue;
      if (!game[k]) continue;
      html += `<dt>${k}:</dt><dd>${game[k]}</dd>`;
    }
    html += `</dl>`;
  }
  if (priceInsights && priceInsights.isEnabled()) {
    html += buildPricePanelMarkup();
  }
  // Resource links (Google, YouTube, GameFAQs)
  const query = encodeURIComponent(
    (game[COL_GAME] || "") + " " + (game[COL_PLATFORM] || "")
  );
  html += `<div class="external-links">`;
  html += `<a href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener">Google</a>`;
  html += `<a href="https://www.youtube.com/results?search_query=${query} gameplay" target="_blank" rel="noopener">YouTube</a>`;
  html += `<a href="https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(
    game[COL_GAME] || ""
  )}" target="_blank" rel="noopener">GameFAQs</a>`;
  html += `</div>`;
  const noteValue = getNoteForKey(key, importedNotes || gameNotes);
  if (importedCollection) {
    html += `<div class="note-editor read-only"><label>Notes</label><div class="note-view">${
      noteValue
        ? escapeHtml(noteValue).replace(/\n/g, "<br>")
        : "<em>No notes shared.</em>"
    }</div></div>`;
  } else {
    html += `<div class="note-editor"><label for="noteField">Your Notes</label><textarea id="noteField" rows="4" placeholder="Add collection notes...">${escapeHtml(
      noteValue
    )}</textarea><button id="saveNoteBtn">Save Note</button></div>`;
  }

  modal.innerHTML = html;
  modal.style.display = modalBg.style.display = "";
  setTimeout(() => {
    modalBg.style.display = "block";
    modal.style.display = "block";
    modal.focus();
  }, 1);

  if (priceInsights && priceInsights.isEnabled()) {
    renderModalPricePanel(modal, game);
  }

  // Trap focus for accessibility
  modal.setAttribute("tabindex", "-1");
  modal.focus();

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }
  document.addEventListener("keydown", escHandler);
  modal.querySelector(".modal-close").onclick = closeModal;
  modalBg.onclick = closeModal;
  if (galleryImages.length) {
    initializeGallery(modal, galleryImages);
  }
  hydrateModalPricePanel(modal, key);
  if (!importedCollection) {
    const saveBtn = modal.querySelector("#saveNoteBtn");
    const noteField = modal.querySelector("#noteField");
    if (saveBtn && noteField) {
      saveBtn.onclick = () => {
        setNoteForKey(key, noteField.value);
        saveNotes();
        closeModal();
        refreshFilteredView("note-save");
      };
    }
  }

  function closeModal() {
    modal.style.display = modalBg.style.display = "none";
    modal.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  }
}

function renderModalPricePanel(modal, game) {
  if (!priceInsights || !priceInsights.isEnabled() || !modal || !game) return;
  const panel = modal.querySelector("[data-price-panel]");
  if (!panel) return;
  const key = buildRowKey(game);
  if (!key) return;
  const statusSource = getActiveStatusMap();
  const status = statusSource[key] || STATUS_NONE;
  const noteEl = panel.querySelector("[data-price-note]");
  if (noteEl) noteEl.textContent = "Fetching live prices…";
  const entry = [{ key, status, row: game }];
  const cached = priceInsights.getQuote(key);
  if (cached) updateModalPricePanel(panel, cached, status);
  priceInsights.queueRows(entry).then(() => {
    const updated = priceInsights.getQuote(key);
    updateModalPricePanel(panel, updated, status);
  });
}

function updateModalPricePanel(panel, quote, status) {
  if (!panel || !priceInsights || !priceInsights.isEnabled()) return;
  const looseEl = panel.querySelector("[data-price-loose]");
  const cibEl = panel.querySelector("[data-price-cib]");
  const newEl = panel.querySelector("[data-price-new]");
  const statusEl = panel.querySelector("[data-price-status]");
  const noteEl = panel.querySelector("[data-price-note]");
  const sparkline = panel.querySelector("[data-price-sparkline]");
  const prices = (quote && quote.prices) || {};
  if (looseEl) looseEl.textContent = priceInsights.formatCurrency(prices.loose);
  if (cibEl) cibEl.textContent = priceInsights.formatCurrency(prices.cib);
  if (newEl) newEl.textContent = priceInsights.formatCurrency(prices.new);
  const statusValue = selectStatusPrice(status, prices);
  if (statusEl) statusEl.textContent = priceInsights.formatCurrency(statusValue);
  if (!quote) {
    if (noteEl) noteEl.textContent = "Still looking for a PriceCharting match.";
    drawSparkline([], sparkline, "#ff8cf9");
    return;
  }
  if (noteEl) {
    if (Number.isFinite(statusValue)) {
      const label = STATUS_LABELS[status] || "Tracked";
      noteEl.textContent = `${label} estimate: ${priceInsights.formatCurrency(statusValue)}`;
    } else {
      noteEl.textContent = "Price data saved, but no value for this status.";
    }
  }
  drawSparkline(quote.history || [], sparkline, "#ff8cf9");
}

function toggleSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortColumn = column;
    sortDirection = "asc";
  }
  syncSortControl();
  refreshFilteredView(`sort:${column}`);
}

// === On load: Fetch games from Supabase, bootstrap UI, set up listeners ===

const disableBootstrapFlag =
  (typeof window !== "undefined" && window.__SANDGRAAL_DISABLE_BOOTSTRAP__) ||
  (typeof globalThis !== "undefined" && globalThis.__SANDGRAAL_DISABLE_BOOTSTRAP__);
const canBootstrap =
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof document.getElementById === "function";

if (!disableBootstrapFlag && canBootstrap) {
  initThemeToggle();
  loadGameData()
    .then(({ data, source, reason }) => {
      rawData = data;
      cacheStatusRows(rawData);
      hydratePriceData(rawData);
      const coverHydrationPromise = hydrateFallbackCovers(rawData);
      if (!rawData.length) throw new Error("No games available to display!");
      loadStatuses();
      loadNotes();
      loadPersistedFilters();
      filterStatus = persistedFilters.filterStatus || "";
      filterRatingMin = persistedFilters.filterRatingMin || "";
      filterYearStart = persistedFilters.filterYearStart || "";
      filterYearEnd = persistedFilters.filterYearEnd || "";
      filterRegion = persistedFilters.filterRegion || "";
      setupFilters(rawData);
      setupRegionToggle();
      setupBrowseControls();
      setupContributionWorkflow();
      refreshFilteredView("initial-load");
      updateTrendingCarousel(rawData);
      updateStructuredData(rawData);
      loadVariantPriceDeltas().catch(() => {
        /* ignore variant price load errors */
      });
      coverHydrationPromise
        .then((mutated) => {
          if (mutated) {
            updateTrendingCarousel(rawData);
            updateStructuredData(rawData);
            refreshFilteredView("covers:fallback");
          }
        })
        .catch((error) => {
          if (typeof console !== "undefined" && typeof console.debug === "function") {
            console.debug("Cover hydration skipped", error);
          }
        });
      if (source === "sample") {
        const fallReason =
          typeof reason === "string"
            ? reason
            : reason && reason.message
              ? reason.message
              : "Supabase is unavailable.";
        const statusMessage =
          fallReason === "Supabase returned zero rows."
            ? "Supabase responded without data. Showing a curated sample dataset until the project is seeded."
            : "Supabase is unavailable. Showing a curated sample dataset for now.";
        showStatus(statusMessage, "info");
      } else {
        hideStatus();
      }

      document.getElementById("platformFilter").addEventListener("change", (e) => {
        filterPlatform = e.target.value;
        refreshFilteredView("filter:platform");
      });
      document.getElementById("genreFilter").addEventListener("change", (e) => {
        filterGenre = e.target.value;
        refreshFilteredView("filter:genre");
      });
      const searchInput = document.getElementById("search");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const value = e.target.value;
          searchValue = value.trim().toLowerCase();
          refreshFilteredView("filter:search");
          queueTypeaheadSuggestions(value);
        });
      }
      document.getElementById("statusFilter").addEventListener("change", (e) => {
        filterStatus = e.target.value;
        savePersistedFilters();
        refreshFilteredView("filter:status");
      });
      document.getElementById("ratingFilter").addEventListener("input", (e) => {
        filterRatingMin = e.target.value.trim();
        savePersistedFilters();
        refreshFilteredView("filter:rating");
      });
      document.getElementById("yearStartFilter").addEventListener("input", (e) => {
        filterYearStart = e.target.value.trim();
        savePersistedFilters();
        refreshFilteredView("filter:year-start");
      });
      document.getElementById("yearEndFilter").addEventListener("input", (e) => {
        filterYearEnd = e.target.value.trim();
        savePersistedFilters();
        refreshFilteredView("filter:year-end");
      });
      const sortControlEl = document.getElementById("sortControl");
      if (sortControlEl) {
        sortControlEl.addEventListener("change", (e) => {
          applySortSelection(e.target.value);
          refreshFilteredView("filter:sort");
        });
      }
      document.getElementById("clearFilters").addEventListener("click", () => {
        filterPlatform = "";
        filterGenre = "";
        searchValue = "";
        filterStatus = "";
        filterRatingMin = "";
        filterYearStart = "";
        filterYearEnd = "";
        persistedFilters = {};
        localStorage.removeItem(FILTER_STORAGE_KEY);
        document.getElementById("platformFilter").value = "";
        document.getElementById("genreFilter").value = "";
        document.getElementById("search").value = "";
        document.getElementById("statusFilter").value = "";
        document.getElementById("ratingFilter").value = "";
        document.getElementById("yearStartFilter").value = "";
        document.getElementById("yearEndFilter").value = "";
        clearTypeaheadSuggestions();
        refreshFilteredView("filter:clear");
      });

      applyFiltersToInputs();
      initTypeahead();
      document.getElementById("exportBtn").onclick = exportOwnedGames;
      document.getElementById("shareBtn").onclick = showShareSection;
      document.getElementById("showImport").onclick = showImportSection;
      document.getElementById("copyShare").onclick = function () {
        let code = document.getElementById("shareCode").value;
        navigator.clipboard.writeText(code);
        this.textContent = "Copied!";
        setTimeout(() => {
          this.textContent = "Copy";
        }, 1200);
      };
      document.getElementById("importBtn").onclick = importCollection;
      document.getElementById("closeShare").onclick = closeShareSection;
      document.getElementById("importCode").addEventListener("keydown", function (e) {
        if (e.key === "Enter") importCollection();
      });
      document.getElementById("backupBtn").onclick = exportCollectionBackup;
      const restoreInput = document.getElementById("restoreInput");
      document.getElementById("restoreBtn").onclick = () => restoreInput.click();
      restoreInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          restoreCollectionBackup(file);
          restoreInput.value = "";
        }
      });
      const valuationRefreshBtn = document.getElementById("valuationRefresh");
      if (valuationRefreshBtn) {
        valuationRefreshBtn.addEventListener("click", () => {
          renderValuationSummary({ force: true });
        });
      }
    })
    .catch((err) => {
      const message = err && err.message ? err.message : err;
      showError("Unable to load games: " + message);
    });
}

const testApi = {
  applyFilters,
  renderTable,
  setupFilters,
  updateStats,
  updateDashboard,
  updateCollectionValueSummary,
  updateTrendingCarousel,
  showError,
  toggleSort,
  refreshFilteredView,
  __setBrowseMode: setBrowseMode,
  __teardownVirtualization: teardownVirtualization,
  __buildRemoteFilterPayload: buildRemoteFilterPayload,
  __setState(overrides = {}) {
    if (Object.prototype.hasOwnProperty.call(overrides, "statuses")) {
      gameStatuses = overrides.statuses;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "notes")) {
      gameNotes = overrides.notes;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "owned")) {
      const incoming = overrides.owned || {};
      gameStatuses = {};
      Object.keys(incoming).forEach((key) => {
        if (incoming[key]) gameStatuses[key] = STATUS_OWNED;
      });
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "importedCollection")) {
      importedCollection = overrides.importedCollection;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterPlatform")) {
      filterPlatform = overrides.filterPlatform;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterGenre")) {
      filterGenre = overrides.filterGenre;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "searchValue")) {
      searchValue = overrides.searchValue;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterStatus")) {
      filterStatus = overrides.filterStatus;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterRatingMin")) {
      filterRatingMin = overrides.filterRatingMin;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterYearStart")) {
      filterYearStart = overrides.filterYearStart;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterYearEnd")) {
      filterYearEnd = overrides.filterYearEnd;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterRegion")) {
      filterRegion = overrides.filterRegion;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filters")) {
      persistedFilters = overrides.filters;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "sortColumn")) {
      sortColumn = overrides.sortColumn;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "sortDirection")) {
      sortDirection = overrides.sortDirection;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "rawData")) {
      rawData = overrides.rawData;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "browseMode")) {
      browseMode = overrides.browseMode;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "paginationState")) {
      paginationState = { ...paginationState, ...overrides.paginationState };
    }
  },
  __getBackupPayload: getBackupPayload,
  __pricing: {
    isEnabled: () => !!(priceInsights && priceInsights.isEnabled()),
    buildQuery: buildPriceQuery,
    summarize(rows) {
      if (!priceInsights) return null;
      return priceInsights.summarize(Array.isArray(rows) ? rows : []);
    },
    format(value) {
      if (!priceInsights) return value;
      return priceInsights.formatCurrency(value);
    },
    __injectQuote(key, quote) {
      if (priceInsights && priceInsights.__setQuoteForTest) {
        priceInsights.__setQuoteForTest(key, quote);
      }
    },
    __forceEnable(state = true) {
      if (priceInsights) {
        priceInsights.isEnabled = () => !!state;
      }
    },
  },
  __getState() {
    return {
      statuses: gameStatuses,
      notes: gameNotes,
      importedCollection,
      filterPlatform,
      filterGenre,
      searchValue,
      filterStatus,
      filterRatingMin,
      filterYearStart,
      filterYearEnd,
      filterRegion,
      sortColumn,
      sortDirection,
      rawData,
      browseMode,
      paginationState,
      streamState: {
        active: streamState.active,
        hasMore: streamState.hasMore,
        loading: streamState.loading,
        nextFrom: streamState.nextFrom,
        totalCount: streamState.totalCount,
      },
    };
  },
  __getVirtualizationState() {
    return {
      active: virtualizationState.active,
      visibleStart: virtualizationState.visibleStart,
      visibleEnd: virtualizationState.visibleEnd,
      topPadding: virtualizationState.topPadding,
      bottomPadding: virtualizationState.bottomPadding,
      sourceLength: virtualizationState.sourceData.length,
    };
  },
  __setPriceState(overrides = {}) {
    if (overrides.latest) {
      const next = new Map();
      Object.entries(overrides.latest).forEach(([key, value]) => {
        next.set(key, value);
      });
      priceState.latest = next;
    }
    if (overrides.histories) {
      const history = new Map();
      Object.entries(overrides.histories).forEach(([key, value]) => {
        history.set(key, value);
      });
      priceState.histories = history;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "lastUpdated")) {
      priceState.lastUpdated = overrides.lastUpdated;
    }
    priceState.summaryDirty = true;
  },
};

/* eslint-disable no-undef */
if (typeof module !== "undefined" && module.exports) {
  module.exports = testApi;
}
/* eslint-enable no-undef */
const AGGREGATE_RPC_GENRES =
  SUPABASE_CONFIG.rpcGenres ||
  (SUPABASE_CONFIG.rpc && SUPABASE_CONFIG.rpc.genres) ||
  SUPABASE_CONFIG.rpc_genres ||
  DEFAULT_GENRE_RPC;
const AGGREGATE_RPC_TIMELINE =
  SUPABASE_CONFIG.rpcTimeline ||
  (SUPABASE_CONFIG.rpc && SUPABASE_CONFIG.rpc.timeline) ||
  SUPABASE_CONFIG.rpc_timeline ||
  DEFAULT_TIMELINE_RPC;
