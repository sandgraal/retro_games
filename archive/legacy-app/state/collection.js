/**
 * Collection state management extracted from archive/app-legacy.js.
 * Handles game statuses (owned, wishlist, backlog, trade) and notes persistence.
 */

// === Constants ===
export const STORAGE_KEY = "roms_owned";
export const NOTES_STORAGE_KEY = "rom_notes";
export const STATUS_NONE = "none";
export const STATUS_OWNED = "owned";
export const STATUS_WISHLIST = "wishlist";
export const STATUS_BACKLOG = "backlog";
export const STATUS_TRADE = "trade";

export const STATUS_OPTIONS = [
  { value: STATUS_NONE, label: "None" },
  { value: STATUS_OWNED, label: "Owned" },
  { value: STATUS_WISHLIST, label: "Wishlist" },
  { value: STATUS_BACKLOG, label: "Backlog" },
  { value: STATUS_TRADE, label: "Trade" },
];

export const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, /** @type {Record<string, string>} */ ({}));

// === State ===
/** @type {Record<string, string>} */
let gameStatuses = {};

/** @type {Record<string, string>} */
let gameNotes = {};

/** @type {Record<string, string>|null} */
let importedCollection = null;

// === Status Functions ===

/**
 * Resolve status for a given key, defaulting to STATUS_NONE.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
export function getStatusForKey(key, sourceMap) {
  const map = sourceMap || gameStatuses;
  return map[key] || STATUS_NONE;
}

/**
 * Persist a status for the provided key.
 * @param {string} key
 * @param {string} status
 */
export function setStatusForKey(key, status) {
  if (!status || status === STATUS_NONE) {
    delete gameStatuses[key];
  } else {
    gameStatuses[key] = status;
  }
}

/**
 * Resolve the status map that should be considered active.
 * Prefers an imported collection when present, otherwise falls back to local state.
 * @returns {Record<string, string>}
 */
export function getActiveStatusMap() {
  return importedCollection || gameStatuses;
}

/**
 * Set an imported collection (for viewing shared collections).
 * @param {Record<string, string>|null} collection
 */
export function setImportedCollection(collection) {
  importedCollection = collection;
}

/**
 * Check if an imported collection is active.
 * @returns {boolean}
 */
export function hasImportedCollection() {
  return importedCollection !== null;
}

// === Notes Functions ===

/**
 * Read a saved note for the given key.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
export function getNoteForKey(key, sourceMap) {
  const map = sourceMap || gameNotes;
  return map[key] || "";
}

/**
 * Save a note (or remove when empty) for the given key.
 * @param {string} key
 * @param {string} note
 */
export function setNoteForKey(key, note) {
  if (!note || !note.trim()) {
    delete gameNotes[key];
  } else {
    gameNotes[key] = note.trim();
  }
}

// === Persistence Functions ===

/**
 * Load statuses from localStorage.
 */
export function loadStatuses() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (raw && typeof raw === "object") {
      gameStatuses = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (typeof value === "string") {
          gameStatuses[key] = value;
        } else if (value === true) {
          // Legacy format migration
          gameStatuses[key] = STATUS_OWNED;
        }
      });
    } else {
      gameStatuses = {};
    }
  } catch {
    gameStatuses = {};
  }
}

/**
 * Save statuses to localStorage.
 */
export function saveStatuses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameStatuses));
}

/**
 * Load notes from localStorage.
 */
export function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "{}");
    gameNotes = raw && typeof raw === "object" ? raw : {};
  } catch {
    gameNotes = {};
  }
}

/**
 * Save notes to localStorage.
 */
export function saveNotes() {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(gameNotes));
}

/**
 * Get all game statuses (for export/backup).
 * @returns {Record<string, string>}
 */
export function getAllStatuses() {
  return { ...gameStatuses };
}

/**
 * Get all game notes (for export/backup).
 * @returns {Record<string, string>}
 */
export function getAllNotes() {
  return { ...gameNotes };
}

/**
 * Reset all state (for testing).
 */
export function resetState() {
  gameStatuses = {};
  gameNotes = {};
  importedCollection = null;
}
