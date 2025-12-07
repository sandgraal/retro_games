/**
 * Validation and parsing helpers extracted from archive/app-legacy.js.
 * Pure functions for input validation and normalization.
 */

/**
 * Parse a year string/number into an integer or null when invalid.
 * @param {string|number|null|undefined} value
 * @returns {number|null}
 */
export function parseYear(value) {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Parse a rating string/number into a float or null when invalid.
 * @param {string|number|null|undefined} value
 * @returns {number|null}
 */
export function parseRating(value) {
  const rating = parseFloat(value);
  return Number.isFinite(rating) ? rating : null;
}

/**
 * Sanitize a string for safe use as an HTML id attribute.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function sanitizeForId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Check if a theme value is valid.
 * @param {string|null|undefined} theme
 * @returns {boolean}
 */
export function isValidTheme(theme) {
  return theme === "light" || theme === "dark";
}
