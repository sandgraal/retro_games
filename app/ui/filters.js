/**
 * Filter UI helpers extracted from archive/app-legacy.js.
 * Functions for building filter dropdowns and UI state.
 * @module ui/filters
 */

import { escapeHtml } from "../utils/dom.js";

// === Option Extraction ===

/**
 * Extract unique platform values from game data.
 * @param {Array<Object>} data - Game data array
 * @param {string} [field='platform'] - Field name for platform
 * @returns {string[]} Sorted unique platforms
 */
export function extractUniquePlatforms(data, field = "platform") {
  if (!Array.isArray(data)) return [];
  const platforms = new Set();
  data.forEach((row) => {
    const value = row?.[field];
    if (value && typeof value === "string") {
      platforms.add(value.trim());
    }
  });
  return Array.from(platforms).sort();
}

/**
 * Extract unique genre values from game data.
 * Handles comma-separated genre strings.
 * @param {Array<Object>} data - Game data array
 * @param {string} [field='genre'] - Field name for genre
 * @returns {string[]} Sorted unique genres
 */
export function extractUniqueGenres(data, field = "genre") {
  if (!Array.isArray(data)) return [];
  const genres = new Set();
  data.forEach((row) => {
    const value = row?.[field];
    if (value && typeof value === "string") {
      value
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => genres.add(g));
    }
  });
  return Array.from(genres).sort();
}

/**
 * Extract unique values for any field.
 * @param {Array<Object>} data - Data array
 * @param {string} field - Field name
 * @returns {string[]} Sorted unique values
 */
export function extractUniqueValues(data, field) {
  if (!Array.isArray(data) || !field) return [];
  const values = new Set();
  data.forEach((row) => {
    const value = row?.[field];
    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value).trim());
    }
  });
  return Array.from(values).sort();
}

// === Dropdown Building ===

/**
 * Build option elements HTML for a select dropdown.
 * @param {string[]} values - Option values
 * @param {Object} [options]
 * @param {string} [options.allLabel] - Label for "all" option (omit to skip)
 * @param {string} [options.selected] - Currently selected value
 * @returns {string} HTML string of option elements
 */
export function buildSelectOptions(values, options = {}) {
  const { allLabel, selected } = options;
  let html = "";

  if (allLabel) {
    const isSelected = !selected ? "selected" : "";
    html += `<option value="" ${isSelected}>${escapeHtml(allLabel)}</option>`;
  }

  if (Array.isArray(values)) {
    values.forEach((value) => {
      const escaped = escapeHtml(value);
      const isSelected = selected === value ? "selected" : "";
      html += `<option value="${escaped}" ${isSelected}>${escaped}</option>`;
    });
  }

  return html;
}

/**
 * Build a platform filter dropdown HTML.
 * @param {string[]} platforms - Platform values
 * @param {string} [selected] - Currently selected platform
 * @returns {string} HTML string
 */
export function buildPlatformDropdown(platforms, selected) {
  return buildSelectOptions(platforms, { allLabel: "All Platforms", selected });
}

/**
 * Build a genre filter dropdown HTML.
 * @param {string[]} genres - Genre values
 * @param {string} [selected] - Currently selected genre
 * @returns {string} HTML string
 */
export function buildGenreDropdown(genres, selected) {
  return buildSelectOptions(genres, { allLabel: "All Genres", selected });
}

// === Region Toggle ===

/**
 * Region code options for toggle UI.
 */
export const REGION_OPTIONS = [
  { value: "", label: "All Regions" },
  { value: "NTSC", label: "NTSC" },
  { value: "PAL", label: "PAL" },
  { value: "JPN", label: "JPN" },
];

/**
 * Build region toggle button HTML.
 * @param {string} value - Region value
 * @param {string} label - Button label
 * @param {boolean} isActive - Whether this is the active option
 * @returns {string} HTML string
 */
export function buildRegionButton(value, label, isActive = false) {
  const activeClass = isActive ? "is-active" : "";
  const ariaPressed = isActive ? "true" : "false";
  return `<button type="button" class="region-option ${activeClass}" data-region-option="${escapeHtml(value)}" aria-pressed="${ariaPressed}">${escapeHtml(label)}</button>`;
}

/**
 * Build region toggle group HTML.
 * @param {string} [activeRegion=''] - Currently active region
 * @returns {string} HTML string
 */
export function buildRegionToggle(activeRegion = "") {
  return REGION_OPTIONS.map(({ value, label }) =>
    buildRegionButton(value, label, value === activeRegion)
  ).join("");
}

// === Filter State Display ===

/**
 * Build filter summary text for display.
 * @param {Object} filters - Current filter state
 * @returns {string} Human-readable summary
 */
export function buildFilterSummary(filters) {
  const parts = [];
  if (filters?.platform) parts.push(`Platform: ${filters.platform}`);
  if (filters?.genre) parts.push(`Genre: ${filters.genre}`);
  if (filters?.search) parts.push(`Search: "${filters.search}"`);
  if (filters?.region) parts.push(`Region: ${filters.region}`);
  if (filters?.status) parts.push(`Status: ${filters.status}`);
  if (filters?.ratingMin) parts.push(`Rating ≥ ${filters.ratingMin}`);
  if (filters?.yearStart || filters?.yearEnd) {
    const yearPart = [filters.yearStart, filters.yearEnd].filter(Boolean).join("–");
    parts.push(`Year: ${yearPart}`);
  }
  return parts.length ? parts.join(" • ") : "No filters applied";
}

/**
 * Count active filters.
 * @param {Object} filters - Filter state object
 * @returns {number} Number of active filters
 */
export function countActiveFilters(filters) {
  if (!filters || typeof filters !== "object") return 0;
  let count = 0;
  if (filters.platform) count++;
  if (filters.genre) count++;
  if (filters.search) count++;
  if (filters.region) count++;
  if (filters.status) count++;
  if (filters.ratingMin) count++;
  if (filters.yearStart) count++;
  if (filters.yearEnd) count++;
  return count;
}

// === Sort Control ===

/**
 * Sort options for UI.
 */
export const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "rating-desc", label: "Rating (High–Low)" },
  { value: "rating-asc", label: "Rating (Low–High)" },
  { value: "year-desc", label: "Year (Newest)" },
  { value: "year-asc", label: "Year (Oldest)" },
];

/**
 * Build sort dropdown options HTML.
 * @param {string} [selected='name-asc'] - Currently selected sort
 * @returns {string} HTML string
 */
export function buildSortDropdown(selected = "name-asc") {
  return SORT_OPTIONS.map(({ value, label }) => {
    const isSelected = selected === value ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${isSelected}>${escapeHtml(label)}</option>`;
  }).join("");
}

// === Clear Filters ===

/**
 * Check if any filters are active (for showing clear button).
 * @param {Object} filters
 * @returns {boolean}
 */
export function hasActiveFilters(filters) {
  return countActiveFilters(filters) > 0;
}
