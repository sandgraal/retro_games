/**
 * Export & Import Features
 * Handles collection backup, restore, and CSV export
 */

import type { CollectionEntry, CollectionStatus } from "../core/types";
import { games, collection, notes, filterState, prices } from "../state/store";

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
export function exportCollectionToCSV(
  statusFilter?: CollectionStatus,
  includePrices = true
): string {
  const gamesList = games.get();
  const collectionMap = collection.get();
  const notesMap = notes.get();
  const priceMap = prices.get();

  const baseHeaders = [
    "Game Name",
    "Platform",
    "Genre",
    "Rating",
    "Year",
    "Status",
    "Notes",
  ];
  const priceHeaders = includePrices
    ? ["Loose Price", "Complete Price", "New Price", "Week Change %"]
    : [];
  const headers = [...baseHeaders, ...priceHeaders];

  const rows: string[][] = [headers];

  gamesList.forEach((game) => {
    const entry = collectionMap.get(game.key);
    const status = entry?.status ?? "none";

    // Skip if filtering by status and doesn't match
    if (statusFilter && status !== statusFilter) return;
    if (!statusFilter && status === "none") return;

    const note = notesMap.get(game.key) ?? "";
    const price = priceMap.get(game.key);

    const baseRow = [
      escapeCSV(game.game_name),
      escapeCSV(game.platform),
      escapeCSV(game.genre ?? ""),
      String(game.rating ?? ""),
      String(game.release_year ?? ""),
      status,
      escapeCSV(note),
    ];

    const priceRow = includePrices
      ? [
          formatPriceForCSV(price?.loose),
          formatPriceForCSV(price?.cib),
          formatPriceForCSV(price?.new),
          price?.weekChangePct !== undefined ? price.weekChangePct.toFixed(1) : "",
        ]
      : [];

    rows.push([...baseRow, ...priceRow]);
  });

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Format price in cents to dollars for CSV
 */
function formatPriceForCSV(cents: number | undefined): string {
  if (cents === undefined) return "";
  return (cents / 100).toFixed(2);
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
    const filters = isObject(data.filters)
      ? (data.filters as Record<string, unknown>)
      : undefined;

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

function normalizeCollectionEntries(
  value: Record<string, unknown>
): Record<string, CollectionEntry> {
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

const COLLECTION_STATUSES: CollectionStatus[] = [
  "none",
  "owned",
  "wishlist",
  "backlog",
  "trade",
];

function isCollectionStatus(value: unknown): value is CollectionStatus {
  return (
    typeof value === "string" && COLLECTION_STATUSES.includes(value as CollectionStatus)
  );
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

// === CSV Import ===

interface CSVImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse a CSV string into rows
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV file and return import data
 * Expected format: Game Name, Platform, Genre, Rating, Year, Status, Notes
 */
export function parseCSVImport(csv: string): CSVImportResult & {
  data: Array<{ key: string; status: CollectionStatus; notes: string }>;
} {
  const rows = parseCSV(csv);
  if (rows.length < 2) {
    return {
      imported: 0,
      skipped: 0,
      errors: ["CSV file is empty or has no data rows"],
      data: [],
    };
  }

  // Validate headers (case-insensitive)
  const headers = rows[0].map((h) => h.toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes("game") && h.includes("name"));
  const platformIdx = headers.findIndex((h) => h === "platform");
  const statusIdx = headers.findIndex((h) => h === "status");
  const notesIdx = headers.findIndex((h) => h === "notes");

  if (nameIdx === -1 || platformIdx === -1) {
    return {
      imported: 0,
      skipped: 0,
      errors: ["CSV must have 'Game Name' and 'Platform' columns"],
      data: [],
    };
  }

  const data: Array<{ key: string; status: CollectionStatus; notes: string }> = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const gameName = row[nameIdx]?.trim();
    const platform = row[platformIdx]?.trim();
    const statusRaw = statusIdx >= 0 ? row[statusIdx]?.trim().toLowerCase() : "owned";
    const notes = notesIdx >= 0 ? (row[notesIdx]?.trim() ?? "") : "";

    if (!gameName || !platform) {
      skipped++;
      continue;
    }

    // Validate status
    const validStatuses = ["owned", "wishlist", "backlog", "trade", "none"];
    const status = validStatuses.includes(statusRaw)
      ? (statusRaw as CollectionStatus)
      : "owned";

    // Generate key
    const key = `${gameName.toLowerCase()}___${platform.toLowerCase()}`;

    data.push({ key, status, notes });
  }

  return {
    imported: data.length,
    skipped,
    errors,
    data,
  };
}
