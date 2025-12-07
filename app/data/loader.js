/**
 * Core data loading/streaming logic extracted from archive/app-legacy.js.
 * Handles Supabase queries, filter application, and row normalization.
 */

import {
  COL_GAME,
  COL_PLATFORM,
  COL_GENRE,
  COL_RATING,
  COL_RELEASE_YEAR,
} from "../state/filters.js";
import { resolveStorageCover, normalizeCoverUrl, setRowCover } from "./storage.js";

// === Constants ===
export const SAMPLE_DATA_URL = "./data/sample-games.json";

// === Region Patterns ===
export const REGION_CODES = ["NTSC", "PAL", "JPN"];
export const REGION_PATTERNS = {
  NTSC: ["ntsc", "usa", "north america", "canada"],
  PAL: ["pal", "europe", "eu", "uk", "australia"],
  JPN: ["jpn", "japan"],
};

// === Query Helpers ===

/**
 * Apply filters to a Supabase query builder.
 * @param {any} query - Supabase query builder
 * @param {Object} filters - Filter values
 * @param {string} [columnPrefix] - Optional column prefix for joins
 * @returns {any}
 */
export function applySupabaseFilters(query, filters = {}, columnPrefix = "") {
  if (!filters) return query;
  const column = (name) => (columnPrefix ? `${columnPrefix}.${name}` : name);

  if (filters.search) {
    query = query.ilike(column(COL_GAME), `%${filters.search}%`);
  }
  if (filters.platform) {
    query = query.eq(column(COL_PLATFORM), filters.platform);
  }
  if (filters.genre) {
    query = query.ilike(column(COL_GENRE), `%${filters.genre}%`);
  }
  if (filters.ratingMin !== null && filters.ratingMin !== undefined) {
    query = query.gte(column(COL_RATING), filters.ratingMin);
  }
  if (filters.yearStart !== null && filters.yearStart !== undefined) {
    query = query.gte(column(COL_RELEASE_YEAR), filters.yearStart);
  }
  if (filters.yearEnd !== null && filters.yearEnd !== undefined) {
    query = query.lte(column(COL_RELEASE_YEAR), filters.yearEnd);
  }
  if (filters.region) {
    const patterns = REGION_PATTERNS[filters.region];
    const clauses = [];
    if (patterns && patterns.length) {
      for (const pat of patterns) {
        clauses.push(`region.ilike.%${pat}%`);
      }
    }
    if (clauses.length) {
      query = query.or(clauses.join(","));
    }
  }

  return query;
}

// === Row Enhancement ===

/**
 * Compute region codes from a row's region field.
 * @param {Object} row
 * @returns {string[]}
 */
export function computeRegionCodes(row) {
  if (!row) return [];
  const regions = [];

  // Check explicit region_codes array
  if (Array.isArray(row.region_codes)) {
    return row.region_codes.filter(Boolean);
  }

  // Parse from region string
  const regionField = row.region || row.region_code || "";
  if (!regionField) return [];

  const normalized = regionField.toString().toLowerCase();

  for (const code of REGION_CODES) {
    const patterns = REGION_PATTERNS[code];
    if (patterns && patterns.some((p) => normalized.includes(p))) {
      regions.push(code);
    }
  }

  return regions;
}

/**
 * Apply enhancements to a game row (cover resolution, region codes, etc.).
 * @param {Object} row
 */
export function applyRowEnhancements(row) {
  if (!row || typeof row !== "object") return;

  // Try storage cover first
  const storageCover = resolveStorageCover(row);
  if (storageCover) {
    row.cover = storageCover;
  }

  // Normalize existing cover
  if (row.cover && typeof row.cover !== "string") {
    const normalized = normalizeCoverUrl(row.cover);
    if (normalized) {
      row.cover = normalized;
    }
  }

  // Try screenshot fallback if no cover
  if (!row.cover && Array.isArray(row.screenshots) && row.screenshots.length) {
    const screenshot = row.screenshots.find((s) => normalizeCoverUrl(s));
    if (screenshot) {
      setRowCover(row, screenshot, { provisional: true });
    }
  }

  // Compute region codes
  const regions = computeRegionCodes(row);
  row.__regionCodes = regions;
  if (!row.region && regions.length) {
    row.region = regions.join(", ");
  }
}

/**
 * Normalize an array of incoming rows.
 * @param {Object[]} rows
 * @returns {Object[]}
 */
export function normalizeIncomingRows(rows) {
  if (!Array.isArray(rows)) return rows;
  rows.forEach(applyRowEnhancements);
  return rows;
}

// === Sample Data Loading ===

/**
 * Load sample data from the local JSON file.
 * @returns {Promise<Object[]>}
 */
export async function loadSampleData() {
  try {
    const response = await fetch(SAMPLE_DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load sample data: ${response.status}`);
    }
    const data = await response.json();
    return normalizeIncomingRows(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Error loading sample data:", error);
    return [];
  }
}

/**
 * Build a composite key for a game row.
 * @param {Object} row
 * @returns {string|null}
 */
export function buildRowKey(row) {
  if (!row) return null;
  const game = row[COL_GAME] || row.game_name;
  const platform = row[COL_PLATFORM] || row.platform;
  if (!game || !platform) return null;
  return `${game}___${platform}`;
}
