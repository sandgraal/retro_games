/**
 * Typeahead search helpers extracted from archive/app-legacy.js.
 * Pure functions for search query handling and suggestion building.
 * @module features/search
 */

import { PLATFORM_NAME_ALIASES } from "../data/pricing.js";

// === Constants ===
export const TYPEAHEAD_MIN_CHARS = 2;
export const TYPEAHEAD_DEBOUNCE_MS = 180;
export const TYPEAHEAD_LIMIT = 8;
export const TYPEAHEAD_SELECT_COLUMNS = [
  "game_name",
  "platform",
  "genre",
  "release_year",
];

// === Query Helpers ===

/**
 * Normalize a search query for comparison.
 * @param {string|null|undefined} query
 * @returns {string} Trimmed lowercase query or empty string
 */
export function normalizeSearchQuery(query) {
  if (!query || typeof query !== "string") return "";
  return query.trim().toLowerCase();
}

/**
 * Check if a query meets minimum length for typeahead.
 * @param {string|null|undefined} query
 * @param {number} [minChars=TYPEAHEAD_MIN_CHARS]
 * @returns {boolean}
 */
export function isQueryLongEnough(query, minChars = TYPEAHEAD_MIN_CHARS) {
  const normalized = normalizeSearchQuery(query);
  return normalized.length >= minChars;
}

/**
 * Escape special regex characters in a search query.
 * @param {string} query
 * @returns {string} Escaped query safe for regex
 */
export function escapeRegexChars(query) {
  if (!query || typeof query !== "string") return "";
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive prefix regex from query.
 * @param {string} query
 * @returns {RegExp|null} Regex matching prefix or null if invalid
 */
export function buildPrefixRegex(query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return null;
  const escaped = escapeRegexChars(normalized);
  return new RegExp(`^${escaped}`, "i");
}

/**
 * Build a case-insensitive contains regex from query.
 * @param {string} query
 * @returns {RegExp|null} Regex matching substring or null if invalid
 */
export function buildContainsRegex(query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return null;
  const escaped = escapeRegexChars(normalized);
  return new RegExp(escaped, "i");
}

// === Suggestion Building ===

/**
 * Build typeahead suggestions from local data.
 * Matches game names starting with the query.
 * @param {Array<Object>} data - Array of game rows
 * @param {string} query - Search query
 * @param {Object} [options]
 * @param {string} [options.nameField='game_name'] - Field containing game name
 * @param {number} [options.limit=TYPEAHEAD_LIMIT] - Max suggestions
 * @returns {Array<Object>} Matching game rows
 */
export function buildLocalSuggestions(data, query, options = {}) {
  const { nameField = "game_name", limit = TYPEAHEAD_LIMIT } = options;

  const normalized = normalizeSearchQuery(query);
  if (!normalized || !Array.isArray(data)) return [];

  return data
    .filter((row) => {
      if (!row || typeof row !== "object") return false;
      const name = (row[nameField] || "").toString().toLowerCase();
      return name.startsWith(normalized);
    })
    .slice(0, limit);
}

/**
 * Score a suggestion based on match quality.
 * @param {Object} row - Game row
 * @param {string} query - Search query
 * @param {Object} [options]
 * @param {string} [options.nameField='game_name'] - Field containing game name
 * @returns {number} Score (higher is better match)
 */
export function scoreSuggestion(row, query, options = {}) {
  const { nameField = "game_name" } = options;

  if (!row || typeof row !== "object") return 0;
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return 0;

  const name = (row[nameField] || "").toString().toLowerCase();
  if (!name) return 0;

  // Exact match scores highest
  if (name === normalized) return 100;
  // Prefix match scores well
  if (name.startsWith(normalized)) return 80 + (normalized.length / name.length) * 10;
  // Contains match scores lower
  if (name.includes(normalized)) return 50 + (normalized.length / name.length) * 10;

  return 0;
}

/**
 * Sort suggestions by match quality.
 * @param {Array<Object>} suggestions
 * @param {string} query
 * @param {Object} [options]
 * @returns {Array<Object>} Sorted suggestions (best first)
 */
export function sortSuggestionsByRelevance(suggestions, query, options = {}) {
  if (!Array.isArray(suggestions)) return [];
  if (!query) return [...suggestions];

  return [...suggestions].sort((a, b) => {
    const scoreA = scoreSuggestion(a, query, options);
    const scoreB = scoreSuggestion(b, query, options);
    return scoreB - scoreA;
  });
}

// === Platform Search ===

/**
 * Derive platform search aliases for external queries (Wikipedia, PriceCharting).
 * @param {string|null|undefined} platform
 * @returns {string[]} Array of platform name variants
 */
export function resolvePlatformSearchTerms(platform) {
  const terms = new Set();
  if (!platform || typeof platform !== "string") return [];

  const trimmed = platform.trim();
  if (!trimmed) return [];

  terms.add(trimmed);

  const normalized = trimmed.toUpperCase();
  const aliases = PLATFORM_NAME_ALIASES[normalized];
  if (Array.isArray(aliases)) {
    aliases.forEach((alias) => {
      if (alias) terms.add(alias);
    });
  }

  return Array.from(terms).filter(Boolean);
}

// === Highlight Helpers ===

/**
 * Wrap matching portions of text with highlight markup.
 * @param {string} text - Text to highlight
 * @param {string} query - Search query to highlight
 * @param {Object} [options]
 * @param {string} [options.tag='mark'] - HTML tag for highlight
 * @param {string} [options.className=''] - Optional class for tag
 * @returns {string} Text with highlights (NOT safe for innerHTML without escaping first)
 */
export function highlightMatch(text, query, options = {}) {
  const { tag = "mark", className = "" } = options;

  if (!text || typeof text !== "string") return "";
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return text;

  const regex = buildContainsRegex(query);
  if (!regex) return text;

  const classAttr = className ? ` class="${className}"` : "";
  return text.replace(regex, (match) => `<${tag}${classAttr}>${match}</${tag}>`);
}

/**
 * Split text into parts for safe rendering with highlights.
 * Returns array of {text, isMatch} objects.
 * @param {string} text - Text to split
 * @param {string} query - Search query
 * @returns {Array<{text: string, isMatch: boolean}>}
 */
export function splitByMatch(text, query) {
  if (!text || typeof text !== "string") return [];
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [{ text, isMatch: false }];

  const regex = buildContainsRegex(query);
  if (!regex) return [{ text, isMatch: false }];

  const parts = [];
  let lastIndex = 0;
  let match;

  // Create a new regex with global flag for exec loop
  const globalRegex = new RegExp(regex.source, "gi");

  while ((match = globalRegex.exec(text)) !== null) {
    // Add non-matching part before this match
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMatch: false });
    }
    // Add matching part
    parts.push({ text: match[0], isMatch: true });
    lastIndex = globalRegex.lastIndex;
  }

  // Add remaining non-matching part
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
}

// === Debounce Helper ===

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} [delay=TYPEAHEAD_DEBOUNCE_MS] - Delay in milliseconds
 * @returns {{call: Function, cancel: Function}} Debounced function with cancel
 */
export function createDebouncer(fn, delay = TYPEAHEAD_DEBOUNCE_MS) {
  let timeoutId = null;

  const call = (...args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  };

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { call, cancel };
}

// === Supabase Query Helpers ===

/**
 * Build Supabase select columns string for typeahead.
 * @param {string[]} [columns=TYPEAHEAD_SELECT_COLUMNS]
 * @returns {string} Comma-separated column list
 */
export function buildTypeaheadSelectColumns(columns = TYPEAHEAD_SELECT_COLUMNS) {
  return columns.filter(Boolean).join(",");
}
