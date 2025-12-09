/**
 * Supabase Storage helpers and cover hydration extracted from archive/app-legacy.js.
 * Handles cover URL normalization and storage path resolution.
 */

import { STORAGE_PUBLIC_BASE, STORAGE_PUBLIC_BUCKET } from "./supabase.js";

// === URL Normalization ===

/**
 * Normalize a cover path into an absolute URL when possible.
 * @param {string|undefined} value
 * @param {string} origin
 * @returns {string|undefined}
 */
export function normalizeImageUrl(value, origin) {
  if (!value) return undefined;
  const stringValue = value.toString();
  if (/^https?:\/\//i.test(stringValue)) return stringValue;
  if (stringValue.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location
        ? window.location.protocol
        : "https:";
    return `${protocol}${stringValue}`;
  }
  if (!origin) return undefined;
  if (stringValue.startsWith("/")) return `${origin}${stringValue}`;
  return `${origin}/${stringValue}`;
}

/**
 * Encode a storage path for URL use.
 * @param {string} path
 * @returns {string}
 */
export function encodeStoragePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Build a public URL for a Supabase Storage object.
 * @param {string} bucket
 * @param {string} path
 * @returns {string|null}
 */
export function buildStoragePublicUrl(bucket, path) {
  if (!bucket || !path || !STORAGE_PUBLIC_BASE) return null;
  if (bucket !== STORAGE_PUBLIC_BUCKET) return null;
  const trimmed = path.toString().replace(/^\/+/, "");
  return `${STORAGE_PUBLIC_BASE}/${bucket}/${encodeStoragePath(trimmed)}`;
}

/**
 * Resolve a storage cover URL from a game row.
 * @param {Object} row
 * @returns {string|null}
 */
export function resolveStorageCover(row) {
  if (!row || typeof row !== "object") return null;
  const bucket =
    row.storage_bucket || row.cover_bucket || row.coverBucket || row.cover_storage_bucket;
  const path =
    row.storage_path || row.cover_path || row.cover_storage_path || row.coverPath;
  if (bucket && path) {
    const url = buildStoragePublicUrl(bucket, path);
    if (url) return url;
  }
  if (row.cover_public_url) return row.cover_public_url;
  return null;
}

/**
 * Normalize a cover URL value to a valid HTTPS URL string.
 * Handles string values, objects with url/href/source properties, and nested structures.
 * @param {string|object|any} value
 * @returns {string}
 */
export function normalizeCoverUrl(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "";
  }
  if (typeof value === "object") {
    if (typeof value.url === "string") {
      return normalizeCoverUrl(value.url);
    }
    if (typeof value.href === "string") {
      return normalizeCoverUrl(value.href);
    }
    if (typeof value.source === "string") {
      return normalizeCoverUrl(value.source);
    }
  }
  return "";
}

/**
 * Set a cover URL on a game row, with optional provisional flag.
 * @param {Object} row
 * @param {string|object|any} value
 * @param {Object} [options]
 * @param {boolean} [options.provisional=false]
 * @returns {boolean}
 */
export function setRowCover(row, value, { provisional = false } = {}) {
  if (!row || typeof row !== "object") return false;
  const normalized = normalizeCoverUrl(value);
  if (!normalized) return false;
  row.cover = normalized;
  if (provisional) {
    row.__provisionalCover = true;
  } else {
    delete row.__provisionalCover;
  }
  return true;
}

/**
 * Resolve the first valid screenshot URL from a game row.
 * @param {Object} row
 * @returns {string}
 */
export function resolveScreenshotCover(row) {
  if (!row || typeof row !== "object") return "";
  const screenshots = Array.isArray(row.screenshots) ? row.screenshots : [];
  for (const candidate of screenshots) {
    const url = normalizeCoverUrl(candidate);
    if (url) return url;
  }
  return "";
}
