/**
 * Aggregate metrics computation extracted from archive/app-legacy.js.
 * Pure functions for computing genre and timeline statistics from game data.
 * @module data/aggregates
 */

// Column name constant (same as legacy)
const COL_GENRE = "genre";
const COL_RELEASE_YEAR = "release_year";

/**
 * Normalize aggregate payload for RPC calls.
 * Ensures consistent structure with null defaults.
 * @param {Object} [payload={}] - Raw filter payload
 * @returns {Object} Normalized payload with null defaults
 */
export function normalizeAggregatePayload(payload = {}) {
  return {
    search: payload.search || null,
    platform: payload.platform || null,
    genre: payload.genre || null,
    ratingMin: payload.ratingMin ?? null,
    yearStart: payload.yearStart ?? null,
    yearEnd: payload.yearEnd ?? null,
    region: payload.region || null,
  };
}

/**
 * Compute local genre aggregates from game rows.
 * Splits comma-separated genres and counts occurrences.
 * @param {Array<Object>} rows - Game data rows
 * @returns {Array<{name: string, count: number}>} Sorted genre counts (descending)
 */
export function computeLocalGenreAggregates(rows) {
  const counts = {};
  (rows || []).forEach((row) => {
    const values = row[COL_GENRE]
      ? row[COL_GENRE].split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    values.forEach((genre) => {
      counts[genre] = (counts[genre] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

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
 * Compute local timeline series from game rows.
 * Groups games by release year.
 * @param {Array<Object>} rows - Game data rows
 * @returns {Array<{year: number, count: number}>} Sorted by year (ascending)
 */
export function computeLocalTimelineSeries(rows) {
  const counts = {};
  (rows || []).forEach((row) => {
    const year = getReleaseYear(row);
    if (year) counts[year] = (counts[year] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Parse aggregate RPC response for genre data.
 * Normalizes various field name conventions.
 * @param {Array} rpcData - Raw RPC response data
 * @returns {Array<{name: string, count: number}>} Normalized genre entries
 */
export function parseGenreRpcResponse(rpcData) {
  const mapped = (Array.isArray(rpcData) ? rpcData : []).map((entry) => ({
    name:
      entry.genre ||
      entry.name ||
      entry[COL_GENRE] ||
      (Array.isArray(entry.genres) ? entry.genres.join(", ") : null),
    count: Number(entry.count) || 0,
  }));
  return mapped
    .filter((entry) => entry.name && entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Parse aggregate RPC response for timeline data.
 * Normalizes various field name conventions.
 * @param {Array} rpcData - Raw RPC response data
 * @returns {Array<{year: number, count: number}>} Normalized timeline entries
 */
export function parseTimelineRpcResponse(rpcData) {
  const mapped = (Array.isArray(rpcData) ? rpcData : []).map((entry) => ({
    year: Number(entry.year ?? entry[COL_RELEASE_YEAR] ?? entry.release_year ?? entry.y),
    count: Number(entry.count) || 0,
  }));
  return mapped
    .filter((entry) => Number.isFinite(entry.year) && entry.count > 0)
    .sort((a, b) => a.year - b.year);
}

/**
 * Aggregate raw genre query results.
 * Handles comma-separated genres and aggregates counts.
 * @param {Array} queryData - Raw Supabase query results
 * @returns {Array<{name: string, count: number}>} Aggregated genre counts
 */
export function aggregateGenreQueryResults(queryData) {
  const aggregates = {};
  (Array.isArray(queryData) ? queryData : []).forEach((row) => {
    const rawValue = row[COL_GENRE];
    const count = Number(row.count) || 0;
    if (!rawValue || !count) return;
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((genre) => {
        aggregates[genre] = (aggregates[genre] || 0) + count;
      });
  });
  return Object.entries(aggregates)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Parse timeline query results into normalized entries.
 * @param {Array} queryData - Raw Supabase query results
 * @returns {Array<{year: number, count: number}>} Normalized timeline entries
 */
export function parseTimelineQueryResults(queryData) {
  return (Array.isArray(queryData) ? queryData : [])
    .map((row) => ({
      year: Number(row[COL_RELEASE_YEAR]),
      count: Number(row.count) || 0,
    }))
    .filter((entry) => Number.isFinite(entry.year) && entry.count > 0);
}
