/**
 * Filter application logic extracted from archive/app-legacy.js.
 * Pure functions for testing row matches and applying filters.
 * @module features/filtering
 */

// Column name constants
export const COL_GAME = "game_name";
export const COL_PLATFORM = "platform";
export const COL_GENRE = "genre";
export const COL_RATING = "rating";
export const COL_RELEASE_YEAR = "release_year";

// Status constants
const STATUS_NONE = "none";

/**
 * Region codes and matching patterns.
 */
export const REGION_CODES = ["NTSC", "PAL", "JPN"];

export const REGION_PATTERNS = {
  NTSC: ["ntsc", "usa", "north america", "canada"],
  PAL: ["pal", "europe", "eu", "uk", "australia"],
  JPN: ["jpn", "japan"],
};

export const REGION_MATCHERS = {
  NTSC: [/(^|\b)(ntsc|usa|north america|canada)(\b|$)/i],
  PAL: [/(^|\b)(pal|europe|eu|uk|australia)(\b|$)/i],
  JPN: [/(^|\b)(jpn|japan)(\b|$)/i],
};

/**
 * Extract release year from a game row.
 * @param {Object} row - Game data row
 * @returns {number|null} Parsed year or null
 */
function getReleaseYear(row) {
  if (!row) return null;
  const value = row[COL_RELEASE_YEAR] ?? row.year ?? row.release_year;
  if (value === null || value === undefined) return null;
  const year = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(year) && year > 1900 && year < 2100 ? year : null;
}

/**
 * Parse a year value for filter comparison.
 * @param {string|number} value - Year value
 * @returns {number|null} Parsed year or null
 */
function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const year = parseInt(String(value), 10);
  return Number.isFinite(year) && year > 1900 && year < 2100 ? year : null;
}

/**
 * Detect region codes from a string value.
 * @param {string} value - String to parse for region codes
 * @returns {Array<string>} Detected region codes
 */
export function detectRegionCodesFromString(value) {
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

/**
 * Compute region codes for a game row.
 * Checks explicit fields and infers from region text.
 * @param {Object} row - Game data row
 * @returns {Array<string>} Region codes
 */
export function computeRegionCodes(row) {
  if (!row || typeof row !== "object") return [];
  const codes = new Set();

  // Check explicit region code fields
  const explicit = row.region_code || row.regionCode;
  if (explicit) codes.add(explicit.toString().toUpperCase());

  // Check region codes array
  const list = row.region_codes || row.regionCodes;
  if (Array.isArray(list)) {
    list.forEach((code) => {
      if (code) codes.add(code.toString().toUpperCase());
    });
  }

  // Detect from region text field
  const regionField = row.region || "";
  detectRegionCodesFromString(regionField).forEach((code) => codes.add(code));

  return Array.from(codes);
}

/**
 * Get cached or compute region codes for a row.
 * @param {Object} row - Game data row
 * @returns {Array<string>} Region codes
 */
export function getRegionCodesForRow(row) {
  if (!row) return [];
  if (Array.isArray(row.__regionCodes)) return row.__regionCodes;
  const computed = computeRegionCodes(row);
  row.__regionCodes = computed;
  return computed;
}

/**
 * Test if a row matches a region filter.
 * @param {Object} row - Game data row
 * @param {string} regionCode - Region code to match
 * @returns {boolean} True if matches
 */
export function rowMatchesRegion(row, regionCode) {
  if (!regionCode) return true;
  const codes = getRegionCodesForRow(row);
  // Default to NTSC if no region info
  if (!codes.length) {
    return regionCode === "NTSC";
  }
  return codes.includes(regionCode);
}

/**
 * Test if a row matches platform filter.
 * @param {Object} row - Game row
 * @param {string} platform - Platform to match
 * @returns {boolean} True if matches
 */
export function rowMatchesPlatform(row, platform) {
  if (!platform) return true;
  return row[COL_PLATFORM] === platform;
}

/**
 * Test if a row matches genre filter.
 * Genre field can contain comma-separated values.
 * @param {Object} row - Game row
 * @param {string} genre - Genre to match
 * @returns {boolean} True if matches
 */
export function rowMatchesGenre(row, genre) {
  if (!genre) return true;
  if (!row[COL_GENRE]) return false;
  return row[COL_GENRE].split(",")
    .map((g) => g.trim())
    .includes(genre);
}

/**
 * Test if a row matches search query.
 * Searches across all string fields.
 * @param {Object} row - Game row
 * @param {string} search - Search query (lowercase)
 * @returns {boolean} True if matches
 */
export function rowMatchesSearch(row, search) {
  if (!search) return true;
  const lowerSearch = search.toLowerCase();
  return Object.values(row).some(
    (v) => v && v.toString().toLowerCase().includes(lowerSearch)
  );
}

/**
 * Test if a row matches minimum rating filter.
 * @param {Object} row - Game row
 * @param {number|string} minRating - Minimum rating
 * @returns {boolean} True if matches
 */
export function rowMatchesRating(row, minRating) {
  const ratingMin = parseFloat(minRating);
  if (Number.isNaN(ratingMin)) return true;
  const ratingValue = parseFloat(row[COL_RATING]);
  return !Number.isNaN(ratingValue) && ratingValue >= ratingMin;
}

/**
 * Test if a row matches year range filter.
 * @param {Object} row - Game row
 * @param {number|string} yearStart - Start year
 * @param {number|string} yearEnd - End year
 * @returns {boolean} True if matches
 */
export function rowMatchesYearRange(row, yearStart, yearEnd) {
  const releaseYear = getReleaseYear(row);
  const start = parseYear(yearStart);
  const end = parseYear(yearEnd);
  if (start !== null && (releaseYear === null || releaseYear < start)) return false;
  if (end !== null && (releaseYear === null || releaseYear > end)) return false;
  return true;
}

/**
 * Test if a row matches status filter.
 * @param {string} rowStatus - Row's current status
 * @param {string} filterStatus - Status to filter by
 * @returns {boolean} True if matches
 */
export function rowMatchesStatus(rowStatus, filterStatus) {
  if (!filterStatus) return true;
  return rowStatus === filterStatus;
}

/**
 * Build a game key from row data.
 * @param {Object} row - Game row
 * @returns {string} Game key (gameName___platform)
 */
export function buildRowKey(row) {
  if (!row) return "";
  const gameName = row[COL_GAME] || row.game || "";
  const platform = row[COL_PLATFORM] || "";
  return `${gameName}___${platform}`;
}

/**
 * Test if a row matches all filter criteria.
 * @param {Object} row - Game row to test
 * @param {Object} filters - Filter configuration
 * @param {Object} [options] - Additional options
 * @returns {boolean} True if row matches all filters
 */
export function doesRowMatchFilters(row, filters, options = {}) {
  if (!row) return false;
  const {
    platform,
    genre,
    search,
    ratingMin,
    yearStart,
    yearEnd,
    status: filterStatus,
    region,
  } = filters;
  const { statusSource = {}, importedCollection = null } = options;

  // Platform filter
  if (!rowMatchesPlatform(row, platform)) return false;

  // Genre filter
  if (!rowMatchesGenre(row, genre)) return false;

  // Search filter
  if (!rowMatchesSearch(row, search)) return false;

  // Rating filter
  if (!rowMatchesRating(row, ratingMin)) return false;

  // Year range filter
  if (!rowMatchesYearRange(row, yearStart, yearEnd)) return false;

  // Imported collection filter
  const key = buildRowKey(row);
  if (importedCollection) {
    if (!key || !importedCollection[key]) return false;
  }

  // Status filter
  const rowStatus = key && statusSource[key] ? statusSource[key] : STATUS_NONE;
  if (!rowMatchesStatus(rowStatus, filterStatus)) return false;

  // Region filter
  if (!rowMatchesRegion(row, region)) return false;

  return true;
}

/**
 * Apply filters to an array of game rows.
 * @param {Array<Object>} rows - Game rows to filter
 * @param {Object} filters - Filter configuration
 * @param {Object} [options] - Additional options
 * @returns {Array<Object>} Filtered rows
 */
export function applyFilters(rows, filters, options = {}) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => doesRowMatchFilters(row, filters, options));
}

/**
 * Count rows matching each filter independently.
 * Useful for showing filter badge counts.
 * @param {Array<Object>} rows - Game rows to analyze
 * @param {Object} filters - Current filter configuration
 * @returns {Object} Counts by filter type
 */
export function countFilterMatches(rows, filters) {
  if (!Array.isArray(rows)) {
    return { platform: 0, genre: 0, search: 0, rating: 0, year: 0, region: 0 };
  }
  return {
    platform: rows.filter((r) => rowMatchesPlatform(r, filters.platform)).length,
    genre: rows.filter((r) => rowMatchesGenre(r, filters.genre)).length,
    search: rows.filter((r) => rowMatchesSearch(r, filters.search)).length,
    rating: rows.filter((r) => rowMatchesRating(r, filters.ratingMin)).length,
    year: rows.filter((r) => rowMatchesYearRange(r, filters.yearStart, filters.yearEnd))
      .length,
    region: rows.filter((r) => rowMatchesRegion(r, filters.region)).length,
  };
}

/**
 * Extract unique filter option values from rows.
 * @param {Array<Object>} rows - Game rows
 * @returns {{platforms: Array<string>, genres: Array<string>}} Unique values
 */
export function extractFilterOptions(rows) {
  if (!Array.isArray(rows)) {
    return { platforms: [], genres: [] };
  }
  const platforms = new Set();
  const genres = new Set();
  rows.forEach((row) => {
    if (row[COL_PLATFORM]) platforms.add(row[COL_PLATFORM]);
    if (row[COL_GENRE]) {
      row[COL_GENRE].split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => genres.add(g));
    }
  });
  return {
    platforms: Array.from(platforms).sort(),
    genres: Array.from(genres).sort(),
  };
}
