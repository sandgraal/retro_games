/**
 * Supabase client initialization and configuration extracted from archive/app-legacy.js.
 * Provides a centralized Supabase client and config access.
 */

// === Configuration ===

/**
 * @typedef {Object} SupabaseConfig
 * @property {string} [url]
 * @property {string} [anonKey]
 * @property {string[]} [tables]
 * @property {string} [tableName]
 * @property {number} [streamPageSize]
 * @property {number} [pageSize]
 * @property {number} [chunkSize]
 * @property {Object} [pricing]
 * @property {Object} [storage]
 */

/** @type {SupabaseConfig} */
const SUPABASE_CONFIG =
  (typeof window !== "undefined" && window.__SUPABASE_CONFIG__) || {};

export const SUPABASE_URL = SUPABASE_CONFIG.url || "";
export const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || "";
export const DEFAULT_SUPABASE_TABLES = ["games", "games_view", "games_new"];
export const DEFAULT_STREAM_PAGE_SIZE = 400;

// === Storage Config ===
const STORAGE_CONFIG = SUPABASE_CONFIG.storage || {};
export const DEFAULT_STORAGE_PUBLIC_BUCKET = "game-covers";
export const DEFAULT_STORAGE_PENDING_BUCKET = "media-pending";
export const STORAGE_PUBLIC_BUCKET =
  STORAGE_CONFIG.publicBucket || DEFAULT_STORAGE_PUBLIC_BUCKET;
export const STORAGE_PENDING_BUCKET =
  STORAGE_CONFIG.pendingBucket || DEFAULT_STORAGE_PENDING_BUCKET;
export const STORAGE_CDN_URL = (
  STORAGE_CONFIG.cdnUrl ||
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1` : "")
).replace(/\/$/, "");
export const STORAGE_PUBLIC_BASE = STORAGE_CDN_URL
  ? `${STORAGE_CDN_URL}/object/public`
  : "";

// === Page Size ===

/**
 * Resolve the stream page size from config.
 * @returns {number}
 */
export function resolveStreamPageSize() {
  const configSize = Number(
    SUPABASE_CONFIG.streamPageSize ||
      SUPABASE_CONFIG.pageSize ||
      SUPABASE_CONFIG.chunkSize
  );
  if (Number.isFinite(configSize) && configSize > 0) {
    return Math.min(Math.max(Math.floor(configSize), 50), 1000);
  }
  return DEFAULT_STREAM_PAGE_SIZE;
}

export const SUPABASE_STREAM_PAGE_SIZE = resolveStreamPageSize();

// === Force Sample Mode ===

/**
 * Check if sample data should be forced.
 * @returns {boolean}
 */
export function checkForceSampleMode() {
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
  return forceSampleFlag;
}

export const FORCE_SAMPLE = checkForceSampleMode();

// === Table Candidates ===

/**
 * Get list of table candidates to try.
 * @returns {string[]}
 */
export function getTableCandidates() {
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
}

export const SUPABASE_TABLE_CANDIDATES = getTableCandidates();

// === Supabase Client ===

/** @type {any} */
let supabaseClient = null;

/**
 * Get or create the Supabase client.
 * @returns {any|null}
 */
export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (FORCE_SAMPLE) {
    console.info("Sample dataset forced via __SANDGRAAL_FORCE_SAMPLE__.");
    return null;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "Supabase credentials missing. Provide window.__SUPABASE_CONFIG__ in config.js."
    );
    return null;
  }

  if (typeof window !== "undefined" && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  return null;
}

/**
 * Check if Supabase is available.
 * @returns {boolean}
 */
export function isSupabaseAvailable() {
  return !FORCE_SAMPLE && !!getSupabaseClient();
}

/**
 * Get the raw config object (for pricing, storage, etc.).
 * @returns {SupabaseConfig}
 */
export function getSupabaseConfig() {
  return SUPABASE_CONFIG;
}

/**
 * Reset client for testing.
 */
export function resetSupabaseClient() {
  supabaseClient = null;
}
