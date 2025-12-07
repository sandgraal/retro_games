/**
 * Sharing, backup, and import logic extracted from archive/app-legacy.js.
 * Pure functions for encoding/decoding collections and generating backup payloads.
 * @module features/sharing
 */

// Status constants (duplicated to avoid circular deps)
const STATUS_NONE = "none";
const STATUS_OWNED = "owned";

/**
 * Valid status values for validation during import.
 */
const STATUS_LABELS = {
  owned: "Owned",
  wishlist: "Wishlist",
  backlog: "Backlog",
  trade: "Trade",
  none: "None",
};

/**
 * Encode a collection payload to a shareable base64 string.
 * @param {{statuses: Object, notes: Object}} payload - Collection data
 * @returns {string} Base64-encoded string
 */
export function encodeSharePayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  const jsonString = JSON.stringify(payload);
  // Handle unicode characters correctly
  return btoa(unescape(encodeURIComponent(jsonString)));
}

/**
 * Decode a base64 share code into a collection payload.
 * Supports both JSON format and legacy pipe-delimited format.
 * @param {string} code - Base64-encoded share code
 * @returns {{statuses: Object, notes: Object}|null} Decoded payload or null on error
 */
export function decodeSharePayload(code) {
  if (!code || typeof code !== "string") return null;
  try {
    const decoded = decodeURIComponent(escape(atob(code.trim())));
    // New JSON format
    if (decoded.trim().startsWith("{")) {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        const statuses = parsed.statuses || {};
        const notes = parsed.notes || {};
        // Ensure all noted games have a status entry
        Object.keys(notes).forEach((key) => {
          if (!statuses[key]) statuses[key] = STATUS_NONE;
        });
        return { statuses, notes };
      }
    }
    // Legacy pipe-delimited format: key::status|key::status|...
    const statuses = {};
    decoded.split("|").forEach((entry) => {
      if (!entry) return;
      const [key, status] = entry.split("::");
      if (!key) return;
      const normalized = status && STATUS_LABELS[status] ? status : STATUS_OWNED;
      statuses[key] = normalized;
    });
    return { statuses, notes: {} };
  } catch (e) {
    console.error("Failed to decode share code:", e);
    return null;
  }
}

/**
 * Build a shareable payload from collection state.
 * Filters out empty/none statuses and empty notes.
 * @param {Object} statuses - Status map {gameKey: status}
 * @param {Object} notes - Notes map {gameKey: note}
 * @returns {{statuses: Object, notes: Object}} Filtered payload
 */
export function buildSharePayload(statuses, notes) {
  const payload = {
    statuses: {},
    notes: {},
  };
  if (statuses && typeof statuses === "object") {
    Object.entries(statuses).forEach(([key, status]) => {
      if (status && status !== STATUS_NONE) {
        payload.statuses[key] = status;
      }
    });
  }
  if (notes && typeof notes === "object") {
    Object.entries(notes).forEach(([key, note]) => {
      if (note && note.trim()) {
        payload.notes[key] = note;
      }
    });
  }
  return payload;
}

/**
 * Build a complete backup payload with statuses, notes, and filters.
 * @param {Object} statuses - Status map
 * @param {Object} notes - Notes map
 * @param {Object} filters - Persisted filter state
 * @returns {{statuses: Object, notes: Object, filters: Object}} Backup payload
 */
export function buildBackupPayload(statuses, notes, filters) {
  return {
    statuses: statuses || {},
    notes: notes || {},
    filters: filters || {},
  };
}

/**
 * Parse a backup file payload and validate structure.
 * @param {string} jsonString - Raw JSON string from backup file
 * @returns {{statuses?: Object, notes?: Object, filters?: Object}|null} Parsed backup or null
 */
export function parseBackupPayload(jsonString) {
  if (!jsonString || typeof jsonString !== "string") return null;
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") return null;
    // Validate structure - at least one valid section
    const hasStatuses = parsed.statuses && typeof parsed.statuses === "object";
    const hasNotes = parsed.notes && typeof parsed.notes === "object";
    const hasFilters = parsed.filters && typeof parsed.filters === "object";
    if (!hasStatuses && !hasNotes && !hasFilters) return null;
    return {
      statuses: hasStatuses ? parsed.statuses : undefined,
      notes: hasNotes ? parsed.notes : undefined,
      filters: hasFilters ? parsed.filters : undefined,
    };
  } catch (e) {
    console.error("Failed to parse backup payload:", e);
    return null;
  }
}

/**
 * Generate a timestamp-based backup filename.
 * @param {string} [prefix="collection-backup"] - Filename prefix
 * @returns {string} Filename with timestamp
 */
export function generateBackupFilename(prefix = "collection-backup") {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${prefix}-${timestamp}.json`;
}

/**
 * Create a CSV row from game data and collection status.
 * @param {Object} game - Game row data
 * @param {string} status - Collection status
 * @param {string} [note=""] - Optional note
 * @returns {string} CSV row string
 */
export function buildCsvRow(game, status, note = "") {
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [
    escape(game.game_name || game.game || ""),
    escape(game.platform || ""),
    escape(game.genre || ""),
    escape(game.release_year || ""),
    escape(status),
    escape(note),
  ].join(",");
}

/**
 * Build CSV content from collection data.
 * @param {Array<Object>} games - All games data
 * @param {Object} statuses - Status map {gameKey: status}
 * @param {Object} notes - Notes map {gameKey: note}
 * @param {Function} keyGenerator - Function to generate game key from row
 * @returns {string} Complete CSV content with header
 */
export function buildCsvExport(games, statuses, notes, keyGenerator) {
  const header = "Game Name,Platform,Genre,Release Year,Status,Notes";
  const rows = [header];
  if (!Array.isArray(games)) return header;
  games.forEach((game) => {
    const key = keyGenerator(game);
    const status = statuses[key];
    if (!status || status === STATUS_NONE) return;
    const note = notes[key] || "";
    rows.push(buildCsvRow(game, status, note));
  });
  return rows.join("\n");
}

/**
 * Count items in a collection payload.
 * @param {{statuses: Object, notes: Object}} payload - Collection payload
 * @returns {{totalStatuses: number, nonNoneStatuses: number, totalNotes: number}}
 */
export function countCollectionItems(payload) {
  if (!payload) {
    return { totalStatuses: 0, nonNoneStatuses: 0, totalNotes: 0 };
  }
  const statuses = payload.statuses || {};
  const notes = payload.notes || {};
  const totalStatuses = Object.keys(statuses).length;
  const nonNoneStatuses = Object.values(statuses).filter(
    (s) => s && s !== STATUS_NONE
  ).length;
  const totalNotes = Object.values(notes).filter((n) => n && n.trim()).length;
  return { totalStatuses, nonNoneStatuses, totalNotes };
}
