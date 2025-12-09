/**
 * Application Store v3.0 (Simplified)
 * Clean state management for the game collection app
 */

import { signal, computed, effect } from "../core/runtime";
import type {
  Game,
  GameWithKey,
  GameKey,
  CollectionStatus,
  CollectionEntry,
  FilterState,
  CollectionStats,
} from "../core/types.v3";
import { withKeys } from "../core/keys.v3";

// === Initial Filter State ===

const DEFAULT_FILTER_STATE: FilterState = {
  search: "",
  platform: "",
  genre: "",
  status: "all",
  sortBy: "game_name",
  sortDirection: "asc",
};

// === Core Signals ===

// Games data
const _gamesSignal = signal<GameWithKey[]>([]);
const _collectionSignal = signal<Map<string, CollectionEntry>>(new Map());
const _notesSignal = signal<Map<string, string>>(new Map());
const _filterStateSignal = signal<FilterState>(DEFAULT_FILTER_STATE);
const _selectedGameKeySignal = signal<string | null>(null);
const _isLoadingSignal = signal(true);

// === Computed Values ===

// Games lookup by key
export const gamesLookup = computed(() => {
  const games = _gamesSignal();
  const lookup = new Map<string, GameWithKey>();
  for (const game of games) {
    lookup.set(game.key, game);
  }
  return lookup;
});

// Filtered and sorted games
export const filteredGames = computed(() => {
  const games = _gamesSignal();
  const filters = _filterStateSignal();
  const collection = _collectionSignal();

  let result = games;

  // Filter by search
  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter(
      (g) =>
        g.game_name.toLowerCase().includes(query) ||
        g.platform.toLowerCase().includes(query) ||
        g.genre?.toLowerCase().includes(query)
    );
  }

  // Filter by platform
  if (filters.platform) {
    result = result.filter((g) => g.platform === filters.platform);
  }

  // Filter by genre
  if (filters.genre) {
    result = result.filter((g) => g.genre === filters.genre);
  }

  // Filter by collection status
  if (filters.status !== "all") {
    result = result.filter((g) => {
      const entry = collection.get(g.key);
      if (filters.status === "none") {
        // "none" means not in collection - entry doesn't exist
        return !entry;
      }
      return entry?.status === filters.status;
    });
  }

  // Sort
  const sortKey = filters.sortBy;
  const direction = filters.sortDirection === "asc" ? 1 : -1;

  result = [...result].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortKey) {
      case "game_name":
        aVal = a.game_name.toLowerCase();
        bVal = b.game_name.toLowerCase();
        break;
      case "platform":
        aVal = a.platform.toLowerCase();
        bVal = b.platform.toLowerCase();
        break;
      case "genre":
        aVal = (a.genre || "").toLowerCase();
        bVal = (b.genre || "").toLowerCase();
        break;
      case "release_year":
        aVal = Number(a.release_year) || 0;
        bVal = Number(b.release_year) || 0;
        break;
      case "rating":
        aVal = Number(a.rating) || 0;
        bVal = Number(b.rating) || 0;
        break;
    }

    if (aVal < bVal) return -1 * direction;
    if (aVal > bVal) return 1 * direction;
    return 0;
  });

  return result;
});

// Collection statistics
export const collectionStats = computed((): CollectionStats => {
  const games = _gamesSignal();
  const collection = _collectionSignal();

  let owned = 0;
  let wishlist = 0;
  let backlog = 0;
  let trade = 0;

  for (const entry of collection.values()) {
    switch (entry.status) {
      case "owned":
        owned++;
        break;
      case "wishlist":
        wishlist++;
        break;
      case "backlog":
        backlog++;
        break;
      case "trade":
        trade++;
        break;
    }
  }

  return {
    total: games.length,
    owned,
    wishlist,
    backlog,
    trade,
  };
});

// Selected game
export const selectedGame = computed(() => {
  const key = _selectedGameKeySignal();
  if (!key) return null;
  return gamesLookup().get(key) || null;
});

// === Accessors ===

// Export signal getters as functions
export function gamesSignal() {
  return _gamesSignal();
}
export function collectionSignal() {
  return _collectionSignal();
}
export function notesSignal() {
  return _notesSignal();
}
export function filterState() {
  return _filterStateSignal();
}
export function selectedGameKey() {
  return _selectedGameKeySignal();
}
export function isLoading() {
  return _isLoadingSignal();
}

// Export computed values as functions for consistency
export function availablePlatforms() {
  return _availablePlatforms();
}
export function availableGenres() {
  return _availableGenres();
}

// Rename internals to avoid conflicts
const _availablePlatforms = computed(() => {
  const games = _gamesSignal();
  const platforms = new Set<string>();
  for (const game of games) {
    if (game.platform) platforms.add(game.platform);
  }
  return Array.from(platforms).sort();
});

const _availableGenres = computed(() => {
  const games = _gamesSignal();
  const genres = new Set<string>();
  for (const game of games) {
    if (game.genre) genres.add(game.genre);
  }
  return Array.from(genres).sort();
});

// Direct signal access for watchers
export const filterStateSignal = {
  get: () => _filterStateSignal(),
  subscribe: (fn: (value: FilterState) => void) => {
    return effect(() => fn(_filterStateSignal()));
  },
};

// === Actions ===

// Load games
export function loadGames(games: Game[]): void {
  const gamesWithKeys = withKeys(games);
  _gamesSignal.set(gamesWithKeys);
  _isLoadingSignal.set(false);
}

// Set individual filter
export function setFilter<K extends keyof FilterState>(
  key: K,
  value: FilterState[K]
): void {
  _filterStateSignal.set((current) => ({
    ...current,
    [key]: value,
  }));
}

// Clear all filters
export function clearFilters(): void {
  _filterStateSignal.set(DEFAULT_FILTER_STATE);
}

// Select a game (open modal)
export function selectGame(key: string): void {
  _selectedGameKeySignal.set(key);
}

// Clear selected game (close modal)
export function clearSelectedGame(): void {
  _selectedGameKeySignal.set(null);
}

// Get game status
export function getGameStatus(key: string): CollectionStatus {
  const collection = _collectionSignal();
  const entry = collection.get(key);
  return entry?.status || "none";
}

// Set game status
export function setGameStatus(key: string, status: CollectionStatus): void {
  _collectionSignal.set((current) => {
    const next = new Map(current);

    if (status === "none") {
      next.delete(key);
    } else {
      const existing = current.get(key);
      next.set(key, {
        gameKey: key as GameKey,
        status,
        note: existing?.note || "",
        userRating: existing?.userRating ?? null,
        addedAt: existing?.addedAt || Date.now(),
        updatedAt: Date.now(),
      });
    }

    return next;
  });

  // Persist to localStorage
  persistCollection();
}

// Get game notes
export function getGameNotes(key: string): string | undefined {
  return _notesSignal().get(key);
}

// Set game notes
export function setGameNotes(key: string, notes: string | undefined): void {
  _notesSignal.set((current) => {
    const next = new Map(current);

    if (!notes || notes.trim() === "") {
      next.delete(key);
    } else {
      next.set(key, notes);
    }

    return next;
  });

  // Persist to localStorage
  persistNotes();
}

// === Persistence ===

const STORAGE_KEYS = {
  collection: "dragonshoard_collection",
  notes: "dragonshoard_notes",
  preferences: "dragonshoard_preferences",
};

function persistCollection(): void {
  try {
    const collection = _collectionSignal();
    const serialized = JSON.stringify(Array.from(collection.entries()));
    localStorage.setItem(STORAGE_KEYS.collection, serialized);
  } catch (err) {
    console.warn("Failed to persist collection:", err);
  }
}

function persistNotes(): void {
  try {
    const notes = _notesSignal();
    const serialized = JSON.stringify(Array.from(notes.entries()));
    localStorage.setItem(STORAGE_KEYS.notes, serialized);
  } catch (err) {
    console.warn("Failed to persist notes:", err);
  }
}

export function loadPersistedState(): void {
  try {
    // Load collection
    const collectionRaw = localStorage.getItem(STORAGE_KEYS.collection);
    if (collectionRaw) {
      const entries = JSON.parse(collectionRaw) as Array<[string, CollectionEntry]>;
      _collectionSignal.set(new Map(entries));
    }

    // Load notes
    const notesRaw = localStorage.getItem(STORAGE_KEYS.notes);
    if (notesRaw) {
      const entries = JSON.parse(notesRaw) as Array<[string, string]>;
      _notesSignal.set(new Map(entries));
    }
  } catch (err) {
    console.warn("Failed to load persisted state:", err);
  }
}

// Initialize on load
loadPersistedState();
