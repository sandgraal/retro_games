/**
 * Client-side cache management extracted from archive/app-legacy.js.
 * Handles fallback cover caching and general cache utilities.
 */

// === Constants ===
export const FALLBACK_COVER_CACHE_KEY = "rom_cover_cache_v1";
export const FALLBACK_COVER_CACHE_LIMIT = 400;
export const FALLBACK_COVER_RETRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * @typedef {Object} CoverCacheEntry
 * @property {string} [url]
 * @property {number} [timestamp]
 * @property {number} [failedAt]
 */

// === State ===
/** @type {Map<string, CoverCacheEntry>} */
let fallbackCoverCache = new Map();

// === Storage Helpers ===

/**
 * Locate a localStorage-like implementation.
 * @returns {Storage|null}
 */
export function getCoverCacheStorage() {
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

// === Cache Entry Helpers ===

/**
 * Resolve a usable timestamp for cache pruning.
 * @param {CoverCacheEntry|null|undefined} entry
 * @returns {number}
 */
export function getCacheTimestamp(entry) {
  if (!entry || typeof entry !== "object") return 0;
  if (typeof entry.timestamp === "number") return entry.timestamp;
  if (typeof entry.failedAt === "number") return entry.failedAt;
  return 0;
}

/**
 * Check if a failed cover should be retried.
 * @param {CoverCacheEntry|null|undefined} entry
 * @param {number} [now]
 * @returns {boolean}
 */
export function shouldRetryFallbackCover(entry, now = Date.now()) {
  if (!entry) return true;
  if (entry.url) return false;
  if (!entry.failedAt) return true;
  return now - entry.failedAt >= FALLBACK_COVER_RETRY_MS;
}

// === Cache Operations ===

/**
 * Get a cached cover entry by key.
 * @param {string} key
 * @returns {CoverCacheEntry|undefined}
 */
export function getCachedCover(key) {
  return fallbackCoverCache.get(key);
}

/**
 * Set a cached cover entry.
 * @param {string} key
 * @param {CoverCacheEntry} entry
 */
export function setCachedCover(key, entry) {
  fallbackCoverCache.set(key, entry);
}

/**
 * Check if a cover is cached.
 * @param {string} key
 * @returns {boolean}
 */
export function hasCachedCover(key) {
  return fallbackCoverCache.has(key);
}

/**
 * Get number of cached covers.
 * @returns {number}
 */
export function getCacheSize() {
  return fallbackCoverCache.size;
}

// === Persistence ===

/**
 * Load persisted fallback covers from storage.
 */
export function loadFallbackCoverCache() {
  const storage = getCoverCacheStorage();
  if (!storage) {
    fallbackCoverCache = new Map();
    return;
  }
  try {
    const raw = storage.getItem(FALLBACK_COVER_CACHE_KEY);
    if (!raw) {
      fallbackCoverCache = new Map();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      fallbackCoverCache = new Map();
      return;
    }
    const map = new Map();
    Object.keys(parsed).forEach((key) => {
      const value = parsed[key];
      if (value && typeof value === "object") {
        map.set(key, value);
      }
    });
    fallbackCoverCache = map;
  } catch {
    fallbackCoverCache = new Map();
  }
}

/**
 * Persist fallback covers back to storage (with pruning).
 */
export function persistFallbackCoverCache() {
  const storage = getCoverCacheStorage();
  if (!storage) return;
  try {
    const sorted = Array.from(fallbackCoverCache.entries()).sort((a, b) => {
      return getCacheTimestamp(b[1]) - getCacheTimestamp(a[1]);
    });
    if (sorted.length > FALLBACK_COVER_CACHE_LIMIT) {
      sorted.length = FALLBACK_COVER_CACHE_LIMIT;
    }
    fallbackCoverCache.clear();
    const plain = /** @type {Record<string, CoverCacheEntry>} */ ({});
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
 * Clear the cache (for testing).
 */
export function clearCoverCache() {
  fallbackCoverCache.clear();
}

/**
 * Reset cache state (for testing).
 */
export function resetCacheState() {
  fallbackCoverCache = new Map();
}
