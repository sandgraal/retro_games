/**
 * Sorting selection and comparator logic extracted from archive/app-legacy.js.
 * Pure functions for comparing game rows and managing sort configuration.
 * @module features/sorting
 */

// Column name constants (same as legacy)
export const COL_GAME = "game_name";
export const COL_RATING = "rating";
export const COL_RELEASE_YEAR = "release_year";
export const COL_PLATFORM = "platform";
export const COL_GENRE = "genre";

/**
 * Sort option values for UI dropdowns.
 */
export const SORT_OPTIONS = {
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
  RATING_DESC: "rating-desc",
  RATING_ASC: "rating-asc",
  YEAR_DESC: "year-desc",
  YEAR_ASC: "year-asc",
};

/**
 * Extract release year from a game row.
 * Handles various field names and formats.
 * @param {Object} row - Game data row
 * @returns {number|null} Parsed year or null
 */
export function getReleaseYear(row) {
  if (!row) return null;
  const value = row[COL_RELEASE_YEAR] ?? row.year ?? row.release_year;
  if (value === null || value === undefined) return null;
  const year = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(year) && year > 1900 && year < 2100 ? year : null;
}

/**
 * Compare two game rows for sorting.
 * Handles string, numeric (year, rating), and null values.
 * @param {Object} rowA - First game row
 * @param {Object} rowB - Second game row
 * @param {string} column - Column to sort by
 * @param {string} direction - "asc" or "desc"
 * @returns {number} Comparison result (-1, 0, 1)
 */
export function compareRows(rowA, rowB, column, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  // Handle year column specially
  if (column === COL_RELEASE_YEAR) {
    const yearA = getReleaseYear(rowA);
    const yearB = getReleaseYear(rowB);
    // Push nulls to end regardless of direction
    const safeA =
      typeof yearA === "number" ? yearA : direction === "asc" ? Infinity : -Infinity;
    const safeB =
      typeof yearB === "number" ? yearB : direction === "asc" ? Infinity : -Infinity;
    if (safeA === safeB) return 0;
    return safeA < safeB ? -1 * multiplier : 1 * multiplier;
  }

  // Handle rating column specially
  if (column === COL_RATING) {
    const ratingA = parseFloat(rowA[COL_RATING]);
    const ratingB = parseFloat(rowB[COL_RATING]);
    // Push nulls to end regardless of direction
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

  // Default string comparison
  const valueA = (rowA[column] || "").toString().toLowerCase();
  const valueB = (rowB[column] || "").toString().toLowerCase();
  if (valueA === valueB) return 0;
  return valueA < valueB ? -1 * multiplier : 1 * multiplier;
}

/**
 * Create a sort comparator function for Array.sort().
 * @param {string} column - Column to sort by
 * @param {string} direction - "asc" or "desc"
 * @returns {Function} Comparator function (a, b) => number
 */
export function createSortComparator(column, direction) {
  return (rowA, rowB) => compareRows(rowA, rowB, column, direction);
}

/**
 * Sort an array of game rows.
 * Returns a new sorted array without mutating the original.
 * @param {Array<Object>} rows - Game rows to sort
 * @param {string} column - Column to sort by
 * @param {string} direction - "asc" or "desc"
 * @returns {Array<Object>} New sorted array
 */
export function sortRows(rows, column, direction) {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort(createSortComparator(column, direction));
}

/**
 * Get the sort control value from column and direction.
 * Maps internal state to UI dropdown value.
 * @param {string} column - Sort column
 * @param {string} direction - Sort direction
 * @returns {string} UI sort option value
 */
export function getSortControlValue(column, direction) {
  if (column === COL_GAME && direction === "desc") return SORT_OPTIONS.NAME_DESC;
  if (column === COL_RATING && direction === "desc") return SORT_OPTIONS.RATING_DESC;
  if (column === COL_RATING && direction === "asc") return SORT_OPTIONS.RATING_ASC;
  if (column === COL_RELEASE_YEAR && direction === "desc") return SORT_OPTIONS.YEAR_DESC;
  if (column === COL_RELEASE_YEAR && direction === "asc") return SORT_OPTIONS.YEAR_ASC;
  return SORT_OPTIONS.NAME_ASC;
}

/**
 * Parse a sort selection value into column and direction.
 * Maps UI dropdown value to internal state.
 * @param {string} value - UI sort option value
 * @returns {{column: string, direction: string}} Parsed sort config
 */
export function parseSortSelection(value) {
  switch (value) {
    case SORT_OPTIONS.NAME_DESC:
      return { column: COL_GAME, direction: "desc" };
    case SORT_OPTIONS.RATING_DESC:
      return { column: COL_RATING, direction: "desc" };
    case SORT_OPTIONS.RATING_ASC:
      return { column: COL_RATING, direction: "asc" };
    case SORT_OPTIONS.YEAR_DESC:
      return { column: COL_RELEASE_YEAR, direction: "desc" };
    case SORT_OPTIONS.YEAR_ASC:
      return { column: COL_RELEASE_YEAR, direction: "asc" };
    case SORT_OPTIONS.NAME_ASC:
    default:
      return { column: COL_GAME, direction: "asc" };
  }
}

/**
 * Check if a sort configuration is valid.
 * @param {string} column - Sort column
 * @param {string} direction - Sort direction
 * @returns {boolean} True if valid
 */
export function isValidSortConfig(column, direction) {
  const validColumns = [COL_GAME, COL_RATING, COL_RELEASE_YEAR, COL_PLATFORM, COL_GENRE];
  const validDirections = ["asc", "desc"];
  return validColumns.includes(column) && validDirections.includes(direction);
}

/**
 * Get the default sort configuration.
 * @returns {{column: string, direction: string}} Default sort config
 */
export function getDefaultSortConfig() {
  return { column: COL_GAME, direction: "asc" };
}
