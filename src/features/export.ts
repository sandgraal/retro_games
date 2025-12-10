/**
 * Export & Import Features
 * Handles collection backup, restore, and CSV export
 */

import type { CollectionEntry, CollectionStatus } from "../core/types";
import { games, collection, notes, filterState } from "../state/store";

// Version for schema migrations
const BACKUP_VERSION = 2;

interface BackupPayload {
  version: number;
  timestamp: number;
  collection: Record<string, CollectionEntry>;
  notes: Record<string, string>;
  filters?: Record<string, unknown>;
}

interface SharePayload {
  version: number;
  owned: string[];
  wishlist: string[];
  backlog: string[];
  trade: string[];
}

/**
 * Generate a CSV export of the collection
 */
export function exportCollectionToCSV(statusFilter?: CollectionStatus): string {
  const gamesList = games.get();
  const collectionMap = collection.get();
  const notesMap = notes.get();

  const headers = ["Game Name", "Platform", "Genre", "Rating", "Year", "Status", "Notes"];

  const rows: string[][] = [headers];

  gamesList.forEach((game) => {
    const entry = collectionMap.get(game.key);
    const status = entry?.status ?? "none";

    // Skip if filtering by status and doesn't match
    if (statusFilter && status !== statusFilter) return;
    if (!statusFilter && status === "none") return;

    const note = notesMap.get(game.key) ?? "";

    rows.push([
      escapeCSV(game.game_name),
      escapeCSV(game.platform),
      escapeCSV(game.genre ?? ""),
      String(game.rating ?? ""),
      String(game.release_year ?? ""),
      status,
      escapeCSV(note),
    ]);
  });

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (!value) return "";
  // If contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Create a full backup of the collection
 */
export function createBackup(): BackupPayload {
  const collectionMap = collection.get();
  const notesMap = notes.get();
  const filters = filterState.get();

  return {
    version: BACKUP_VERSION,
    timestamp: Date.now(),
    collection: Object.fromEntries(collectionMap),
    notes: Object.fromEntries(notesMap),
    filters: {
      platforms: Array.from(filters.platforms),
      genres: Array.from(filters.genres),
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    },
  };
}

/**
 * Create a shareable code from the collection
 */
export function createShareCode(): string {
  const collectionMap = collection.get();

  const payload: SharePayload = {
    version: BACKUP_VERSION,
    owned: [],
    wishlist: [],
    backlog: [],
    trade: [],
  };

  collectionMap.forEach((entry) => {
    if (entry.status === "owned") payload.owned.push(entry.gameKey);
    else if (entry.status === "wishlist") payload.wishlist.push(entry.gameKey);
    else if (entry.status === "backlog") payload.backlog.push(entry.gameKey);
    else if (entry.status === "trade") payload.trade.push(entry.gameKey);
  });

  // Compress by using shorter keys
  const compact = {
    v: payload.version,
    o: payload.owned,
    w: payload.wishlist,
    b: payload.backlog,
    t: payload.trade,
  };

  return btoa(JSON.stringify(compact));
}

/**
 * Parse a share code back to collection data
 */
export function parseShareCode(code: string): SharePayload | null {
  try {
    const json = atob(code);
    const compact = JSON.parse(json);

    if (!isObject(compact)) {
      console.warn("Failed to parse share code");
      return null;
    }

    const owned = parseStringArray(compact.o);
    const wishlist = parseStringArray(compact.w);
    const backlog = parseStringArray(compact.b);
    const trade = parseStringArray(compact.t);

    if (!owned || !wishlist || !backlog || !trade) {
      console.warn("Invalid share code structure");
      return null;
    }

    const version = typeof compact.v === "number" ? compact.v : 1;

    return {
      version,
      owned,
      wishlist,
      backlog,
      trade,
    };
  } catch {
    console.warn("Failed to parse share code");
    return null;
  }
}

/**
 * Parse a backup payload
 */
export function parseBackup(json: string): BackupPayload | null {
  try {
    const data = JSON.parse(json);

    if (!isObject(data)) {
      console.warn("Invalid backup format");
      return null;
    }

    const version = typeof data.version === "number" ? data.version : null;
    const collection = isObject(data.collection) ? data.collection : null;

    if (version === null || !collection) {
      console.warn("Invalid backup format");
      return null;
    }

    const notes = normalizeNotes(data.notes);
    const filters = isObject(data.filters) ? (data.filters as Record<string, unknown>) : undefined;

    return {
      version,
      timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
      collection: normalizeCollectionEntries(collection),
      notes,
      filters,
    } satisfies BackupPayload;
  } catch {
    console.warn("Failed to parse backup");
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCollectionEntries(value: Record<string, unknown>): Record<string, CollectionEntry> {
  const entries: Record<string, CollectionEntry> = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (!isCollectionEntry(entry)) return;

    entries[key] = {
      gameKey: entry.gameKey,
      status: entry.status,
      addedAt: entry.addedAt,
      ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
    };
  });

  return entries;
}

function normalizeNotes(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, note]) => {
    if (typeof note === "string") acc[key] = note;
    return acc;
  }, {});
}

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (!isObject(value)) return false;

  const entry = value as Record<string, unknown>;
  const { gameKey, status, addedAt, notes } = entry;

  if (typeof gameKey !== "string" || typeof addedAt !== "number") return false;
  if (!isCollectionStatus(status)) return false;
  if (notes !== undefined && typeof notes !== "string") return false;

  return true;
}

function isCollectionStatus(value: unknown): value is CollectionStatus {
  return value === "none" || value === "owned" || value === "wishlist" || value === "backlog" || value === "trade";
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string") ? (value as string[]) : null;
}

/**
 * Download a file
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Get collection statistics for export
 */
export function getExportStats(): {
  owned: number;
  wishlist: number;
  backlog: number;
  trade: number;
  total: number;
} {
  const collectionMap = collection.get();
  const stats = { owned: 0, wishlist: 0, backlog: 0, trade: 0, total: 0 };

  collectionMap.forEach((entry) => {
    if (entry.status !== "none") {
      stats[entry.status]++;
      stats.total++;
    }
  });

  return stats;
}
