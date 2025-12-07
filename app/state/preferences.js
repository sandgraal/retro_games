/**
 * User preferences state management extracted from archive/app-legacy.js.
 * Handles browse mode, pagination, theme, and other user preferences.
 */

// === Constants ===
export const THEME_STORAGE_KEY = "rom_theme";
export const BROWSE_PREFS_KEY = "rom_browse_prefs";
export const THEME_LIGHT = "light";
export const THEME_DARK = "dark";
export const BROWSE_MODE_INFINITE = "stream";
export const BROWSE_MODE_PAGED = "paged";
export const PAGE_SIZE_CHOICES = [30, 60, 120];
export const DEFAULT_PAGE_SIZE = 60;

// === State ===
/** @type {'stream'|'paged'} */
let browseMode = BROWSE_MODE_INFINITE;

/** @type {number} */
let pageSize = DEFAULT_PAGE_SIZE;

/** @type {number} */
let currentPage = 1;

// === Page Size Helpers ===

/**
 * Normalize a page size to one of the valid choices.
 * @param {number|null|undefined} value
 * @returns {number}
 */
export function normalizePageSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_PAGE_SIZE;
  const closest = PAGE_SIZE_CHOICES.reduce((prev, curr) =>
    Math.abs(curr - numeric) < Math.abs(prev - numeric) ? curr : prev
  );
  return closest;
}

// === Theme Functions ===

/**
 * Check if a theme value is valid.
 * @param {string|null|undefined} theme
 * @returns {boolean}
 */
export function isValidTheme(theme) {
  return theme === THEME_LIGHT || theme === THEME_DARK;
}

/**
 * Get stored theme choice from localStorage.
 * @returns {string|null}
 */
export function getStoredThemeChoice() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Get preferred theme from system preferences.
 * @returns {'light'|'dark'}
 */
export function getPreferredTheme() {
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

/**
 * Save theme choice to localStorage.
 * @param {string} theme
 */
export function saveThemeChoice(theme) {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!isValidTheme(theme)) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

// === Browse Mode Functions ===

/** @returns {'stream'|'paged'} */
export function getBrowseMode() {
  return browseMode;
}

/** @param {'stream'|'paged'} mode */
export function setBrowseMode(mode) {
  if (mode === BROWSE_MODE_PAGED || mode === BROWSE_MODE_INFINITE) {
    browseMode = mode;
  }
}

/** @returns {number} */
export function getPageSize() {
  return pageSize;
}

/** @param {number} size */
export function setPageSize(size) {
  pageSize = normalizePageSize(size);
}

/** @returns {number} */
export function getCurrentPage() {
  return currentPage;
}

/** @param {number} page */
export function setCurrentPage(page) {
  currentPage = Math.max(1, Math.floor(page) || 1);
}

// === Persistence ===

/**
 * Load browse preferences from localStorage and URL params.
 * @returns {{ mode: string, pageSize: number, page: number }}
 */
export function loadBrowsePreferences() {
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

  // Apply to state
  browseMode = defaults.mode;
  pageSize = defaults.pageSize;
  currentPage = defaults.page;

  return defaults;
}

/**
 * Save browse preferences to localStorage.
 */
export function saveBrowsePreferences() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      BROWSE_PREFS_KEY,
      JSON.stringify({
        mode: browseMode,
        pageSize: pageSize,
      })
    );
  } catch {
    /* noop */
  }
}

/**
 * Reset all preferences state (for testing).
 */
export function resetPreferencesState() {
  browseMode = BROWSE_MODE_INFINITE;
  pageSize = DEFAULT_PAGE_SIZE;
  currentPage = 1;
}
