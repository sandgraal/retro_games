/**
 * Pricing and price-history helpers extracted from archive/app-legacy.js.
 * Pure functions for working with price data and formatting.
 * @module data/pricing
 */

// Status constants (duplicated to avoid circular deps)
const STATUS_OWNED = "owned";
const STATUS_WISHLIST = "wishlist";
const STATUS_BACKLOG = "backlog";
const STATUS_TRADE = "trade";

/**
 * Platform name aliases for PriceCharting console lookups.
 * Maps uppercase platform names to possible search variations.
 */
export const PLATFORM_NAME_ALIASES = {
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

/**
 * Normalize a cents value to a two-decimal dollar amount.
 * @param {number|string|null|undefined} value - Value in cents
 * @returns {number|null} Dollar amount or null
 */
export function normalizePriceValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number((numeric / 100).toFixed(2));
}

/**
 * Normalize a cents value ensuring integer output.
 * @param {number|string|null|undefined} value - Raw cents value
 * @returns {number|null} Integer cents or null
 */
export function normalizeCents(value) {
  if (Number.isFinite(value)) return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Select the appropriate price based on collection status.
 * - Wishlist: prefer new > cib > loose (buying best condition)
 * - Trade: prefer loose > cib > new (selling worst condition)
 * - Owned/Backlog: prefer cib > loose > new (typical collector)
 * @param {string} status - Collection status
 * @param {{loose?: number, cib?: number, new?: number}} prices - Price variants
 * @returns {number|null} Selected price or null
 */
export function selectStatusPrice(status, prices) {
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

/**
 * Resolve the best price value from a price entry record.
 * Prefers CIB > loose > new pricing.
 * @param {Object} entry - Price record with _cents fields
 * @returns {number|null} Price in cents or null
 */
export function resolvePriceValue(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (Number.isFinite(entry.cib_price_cents)) return entry.cib_price_cents;
  if (Number.isFinite(entry.loose_price_cents)) return entry.loose_price_cents;
  if (Number.isFinite(entry.new_price_cents)) return entry.new_price_cents;
  return null;
}

/**
 * Compute percentage price change between first and last entries.
 * @param {Array<Object>} history - Price history array
 * @returns {number|null} Percentage change or null if insufficient data
 */
export function computePriceDelta(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const first = resolvePriceValue(history[0]);
  const last = resolvePriceValue(history[history.length - 1]);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / first) * 100;
}

/**
 * Normalize history entries to a consistent format.
 * Sorts by snapshot_date ascending.
 * @param {Array<Object>} entries - Raw history entries
 * @returns {Array<Object>} Normalized and sorted entries
 */
export function normalizeHistoryEntries(entries) {
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

/**
 * Resolve console hint for PriceCharting search.
 * Uses config hints first, then platform aliases.
 * @param {string} platformName - Platform name to resolve
 * @param {Object} [configHints={}] - Optional config-provided console hints
 * @returns {string} Resolved console name for search
 */
export function resolveConsoleHint(platformName, configHints = {}) {
  if (!platformName) return "";
  const upper = platformName.toUpperCase();
  if (configHints && configHints[upper]) {
    return configHints[upper];
  }
  if (PLATFORM_NAME_ALIASES[upper] && PLATFORM_NAME_ALIASES[upper].length) {
    return PLATFORM_NAME_ALIASES[upper][0];
  }
  return platformName;
}

/**
 * Build a search query string for PriceCharting.
 * Combines game title with platform console hint.
 * @param {Object} row - Game row data
 * @param {Object} [configHints={}] - Optional console hints from config
 * @returns {string} Search query string
 */
export function buildPriceQuery(row, configHints = {}) {
  if (!row) return "";
  const title = (row.game_name || row.game || "").trim();
  const platform = (row.platform || "").trim();
  if (!title) return "";
  const consoleHint = resolveConsoleHint(platform, configHints);
  return [title, consoleHint].filter(Boolean).join(" ").trim();
}

/**
 * Index price records by game_key for quick lookup.
 * Tracks the newest snapshot date.
 * @param {Array<Object>} records - Price records with game_key
 * @returns {{map: Map, lastUpdated: Date|null}} Indexed map and newest date
 */
export function indexLatestPrices(records) {
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
  return { map: nextMap, lastUpdated: newestSnapshot };
}

/**
 * Format an integer (in cents) as a localized currency string.
 * Falls back to basic USD representation when Intl is unavailable.
 * @param {number|string|null|undefined} value - Value in cents
 * @param {{ precise?: boolean, formatter?: Intl.NumberFormat, formatterPrecise?: Intl.NumberFormat }} [options]
 * @returns {string} Formatted currency string or em-dash for null/invalid
 */
export function formatCurrencyFromCents(value, options = {}) {
  const { precise = false, formatter = null, formatterPrecise = null } = options;
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const dollars = precise ? numeric / 100 : Math.round(numeric / 100);
  const activeFormatter = precise ? formatterPrecise : formatter;
  if (activeFormatter) {
    return activeFormatter.format(dollars);
  }
  const amount = precise ? (numeric / 100).toFixed(2) : dollars.toString();
  return `$${amount}`;
}

/**
 * Create a currency formatter for a given currency code.
 * @param {string} [currency="USD"] - ISO 4217 currency code
 * @returns {Intl.NumberFormat|null} Formatter or null if Intl unavailable
 */
export function createCurrencyFormatter(currency = "USD") {
  if (typeof Intl === "undefined" || !Intl.NumberFormat) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    return null;
  }
}

/**
 * Create a precise currency formatter (with cents).
 * @param {string} [currency="USD"] - ISO 4217 currency code
 * @returns {Intl.NumberFormat|null} Formatter or null if Intl unavailable
 */
export function createPreciseCurrencyFormatter(currency = "USD") {
  if (typeof Intl === "undefined" || !Intl.NumberFormat) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return null;
  }
}
