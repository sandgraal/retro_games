/**
 * Filter state management extracted from archive/app-legacy.js.
 * Handles filter values and persistence (platform, genre, search, status, etc.).
 */

// === Constants ===
export const FILTER_STORAGE_KEY = "rom_filters";
export const COL_GAME = "game_name";
export const COL_PLATFORM = "platform";
export const COL_GENRE = "genre";
export const COL_COVER = "cover";
export const COL_RATING = "rating";
export const COL_RELEASE_YEAR = "release_year";

// === State ===
/** @type {string} */
let filterPlatform = "";

/** @type {string} */
let filterGenre = "";

/** @type {string} */
let searchValue = "";

/** @type {string} */
let filterStatus = "";

/** @type {string} */
let filterRatingMin = "";

/** @type {string} */
let filterYearStart = "";

/** @type {string} */
let filterYearEnd = "";

/** @type {string} */
let filterRegion = "";

/** @type {string} */
let sortColumn = COL_GAME;

/** @type {'asc'|'desc'} */
let sortDirection = "asc";

/** @type {Record<string, string>} */
let persistedFilters = {};

// === Getters ===

/** @returns {string} */
export function getFilterPlatform() {
  return filterPlatform;
}

/** @returns {string} */
export function getFilterGenre() {
  return filterGenre;
}

/** @returns {string} */
export function getSearchValue() {
  return searchValue;
}

/** @returns {string} */
export function getFilterStatus() {
  return filterStatus;
}

/** @returns {string} */
export function getFilterRatingMin() {
  return filterRatingMin;
}

/** @returns {string} */
export function getFilterYearStart() {
  return filterYearStart;
}

/** @returns {string} */
export function getFilterYearEnd() {
  return filterYearEnd;
}

/** @returns {string} */
export function getFilterRegion() {
  return filterRegion;
}

/** @returns {string} */
export function getSortColumn() {
  return sortColumn;
}

/** @returns {'asc'|'desc'} */
export function getSortDirection() {
  return sortDirection;
}

// === Setters ===

/** @param {string} value */
export function setFilterPlatform(value) {
  filterPlatform = value || "";
}

/** @param {string} value */
export function setFilterGenre(value) {
  filterGenre = value || "";
}

/** @param {string} value */
export function setSearchValue(value) {
  searchValue = value || "";
}

/** @param {string} value */
export function setFilterStatus(value) {
  filterStatus = value || "";
}

/** @param {string} value */
export function setFilterRatingMin(value) {
  filterRatingMin = value || "";
}

/** @param {string} value */
export function setFilterYearStart(value) {
  filterYearStart = value || "";
}

/** @param {string} value */
export function setFilterYearEnd(value) {
  filterYearEnd = value || "";
}

/** @param {string} value */
export function setFilterRegion(value) {
  filterRegion = value || "";
}

/** @param {string} column */
export function setSortColumn(column) {
  sortColumn = column || COL_GAME;
}

/** @param {'asc'|'desc'} direction */
export function setSortDirection(direction) {
  sortDirection = direction === "desc" ? "desc" : "asc";
}

// === Bulk Operations ===

/**
 * Get all current filter values as an object.
 * @returns {Object}
 */
export function getAllFilters() {
  return {
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
  };
}

/**
 * Clear all filters to their default values.
 */
export function clearAllFilters() {
  filterPlatform = "";
  filterGenre = "";
  searchValue = "";
  filterStatus = "";
  filterRatingMin = "";
  filterYearStart = "";
  filterYearEnd = "";
  filterRegion = "";
  sortColumn = COL_GAME;
  sortDirection = "asc";
}

// === Persistence ===

/**
 * Load persisted filters from localStorage.
 */
export function loadPersistedFilters() {
  try {
    persistedFilters = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}");
    if (persistedFilters && typeof persistedFilters === "object") {
      filterStatus = persistedFilters.filterStatus || "";
      filterRatingMin = persistedFilters.filterRatingMin || "";
      filterYearStart = persistedFilters.filterYearStart || "";
      filterYearEnd = persistedFilters.filterYearEnd || "";
      filterRegion = persistedFilters.filterRegion || "";
    }
  } catch {
    persistedFilters = {};
  }
}

/**
 * Save current filters to localStorage.
 */
export function savePersistedFilters() {
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

/**
 * Clear persisted filters from localStorage.
 */
export function clearPersistedFilters() {
  persistedFilters = {};
  localStorage.removeItem(FILTER_STORAGE_KEY);
}

/**
 * Reset all state (for testing).
 */
export function resetFilterState() {
  clearAllFilters();
  persistedFilters = {};
}
