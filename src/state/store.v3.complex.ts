/**
 * Application Store v3.0
 * Centralized state management with event sourcing
 *
 * Architecture:
 * - All state changes are events
 * - State is computed from event stream
 * - Full undo/redo support
 * - Automatic persistence to IndexedDB
 * - Worker offloading for heavy computations
 */

import {
  signal,
  computed,
  effect,
  batch,
  type Signal,
  type Computed,
} from "../core/runtime";
import {
  createEventStore,
  collectionReducer,
  type CollectionState,
  type CollectionEvent,
  DEFAULT_FILTER_STATE,
  type FilterState,
} from "../core/events";
import {
  put,
  get,
  getAll,
  putMany,
  STORES,
  getPreference,
  setPreference,
} from "../core/storage";
import { filterGames, sortGames, computeStats, fuzzySearch } from "../core/worker";
import { withKeys, gameToKey, findGameByKey, type GameKey } from "../core/keys.v3";
import type {
  Game,
  GameWithKey,
  CollectionStatus,
  ViewMode,
  Theme,
  DataSource,
  CollectionStats,
  PriceData,
  SortField,
  SortDirection,
} from "../core/types.v3";
import {
  getFiltersFromURL,
  setFiltersToURL,
  getGameKeyFromURL,
  setGameKeyToURL,
} from "../core/router";

// === Initial States ===

const INITIAL_COLLECTION_STATE: CollectionState = {
  entries: new Map(),
  stats: { owned: 0, wishlist: 0, backlog: 0, trade: 0, total: 0 },
};

// === Event Store ===

export const collectionStore = createEventStore<CollectionState, CollectionEvent>(
  collectionReducer,
  {
    initialState: INITIAL_COLLECTION_STATE,
    persist: true,
    storageKey: "dragonshoard_events",
    maxEvents: 10000,
  }
);

// === Core Signals ===

// Games data
const gamesSignal = signal<GameWithKey[]>([]);
const pricesSignal = signal<Map<GameKey, PriceData>>(new Map());
const dataSourceSignal = signal<DataSource>("sample");

// Loading state
const isLoadingSignal = signal(true);
const loadingMessageSignal = signal("Loading games...");
const errorSignal = signal<string | null>(null);

// Filter state (URL-synced)
const filterStateSignal = signal<FilterState>({
  ...DEFAULT_FILTER_STATE,
  ...urlToFilterState(),
});

// UI state
const themeSignal = signal<Theme>("dark");
const viewModeSignal = signal<ViewMode>("grid");
const sidebarOpenSignal = signal(false);
const activeModalSignal = signal<string | null>(null);
const selectedGameKeySignal = signal<GameKey | null>(null);

// === Computed Values ===

/**
 * Filtered games (computed async via worker)
 */
const filteredGamesCache = signal<GameWithKey[]>([]);
const isFiltering = signal(false);

// Trigger filtering when dependencies change
effect(() => {
  const games = gamesSignal();
  const filters = filterStateSignal();
  const collection = collectionStore.state().entries;

  if (games.length === 0) {
    filteredGamesCache.set([]);
    return;
  }

  isFiltering.set(true);

  // Apply status filter from collection
  let toFilter = games;
  if (filters.statuses.size > 0) {
    const statusGames: GameWithKey[] = [];
    for (const game of games) {
      const entry = collection.get(game.key);
      const status: CollectionStatus = entry?.status ?? "none";
      if (filters.statuses.has(status)) {
        statusGames.push(game);
      }
    }
    toFilter = statusGames;
  }

  // Offload to worker
  (async () => {
    try {
      // Filter
      let result = await filterGames(toFilter, {
        platforms: filters.platforms,
        genres: filters.genres,
        searchQuery: filters.searchQuery,
        yearRange: filters.yearRange,
        ratingRange: filters.ratingRange,
      });

      // Sort
      result = await sortGames(result, filters.sortBy, filters.sortDirection);

      filteredGamesCache.set(result as GameWithKey[]);
    } catch (error) {
      console.error("Filter error:", error);
      filteredGamesCache.set(toFilter);
    } finally {
      isFiltering.set(false);
    }
  })();
});

export const filteredGames: Computed<GameWithKey[]> = computed(() =>
  filteredGamesCache()
);

/**
 * Available platforms
 */
export const availablePlatforms: Computed<string[]> = computed(() => {
  const games = gamesSignal();
  const platforms = new Set<string>();

  for (const game of games) {
    if (game.platform) {
      platforms.add(game.platform);
    }
  }

  return Array.from(platforms).sort();
});

/**
 * Available genres
 */
export const availableGenres: Computed<string[]> = computed(() => {
  const games = gamesSignal();
  const genres = new Set<string>();

  for (const game of games) {
    if (game.genre) {
      for (const g of game.genre.split(",")) {
        const trimmed = g.trim();
        if (trimmed) {
          genres.add(trimmed);
        }
      }
    }
  }

  return Array.from(genres).sort();
});

/**
 * Available years
 */
export const availableYears: Computed<number[]> = computed(() => {
  const games = gamesSignal();
  const years = new Set<number>();

  for (const game of games) {
    const year = parseInt(String(game.release_year), 10);
    if (!isNaN(year) && year > 1970 && year < 2100) {
      years.add(year);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
});

/**
 * Collection statistics
 */
export const collectionStats: Computed<CollectionStats> = computed(() => {
  const state = collectionStore.state();
  const games = gamesSignal();
  const prices = pricesSignal();

  const platformBreakdown = new Map<string, number>();
  const genreBreakdown = new Map<string, number>();
  const yearBreakdown = new Map<number, number>();

  let totalValue = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const [key, entry] of state.entries) {
    if (entry.status === "owned") {
      const game = findGameByKey(games, key);
      if (game) {
        // Platform
        const pCount = platformBreakdown.get(game.platform) ?? 0;
        platformBreakdown.set(game.platform, pCount + 1);

        // Genre
        if (game.genre) {
          for (const g of game.genre.split(",")) {
            const trimmed = g.trim();
            if (trimmed) {
              const gCount = genreBreakdown.get(trimmed) ?? 0;
              genreBreakdown.set(trimmed, gCount + 1);
            }
          }
        }

        // Year
        const year = parseInt(String(game.release_year), 10);
        if (!isNaN(year)) {
          const yCount = yearBreakdown.get(year) ?? 0;
          yearBreakdown.set(year, yCount + 1);
        }

        // Value
        const price = prices.get(key);
        if (price?.loose) {
          totalValue += price.loose;
        }

        // Rating
        const rating = parseFloat(String(game.rating));
        if (!isNaN(rating)) {
          ratingSum += rating;
          ratingCount++;
        }
      }
    }
  }

  return {
    totalGames: games.length,
    ownedCount: state.stats.owned,
    wishlistCount: state.stats.wishlist,
    backlogCount: state.stats.backlog,
    tradeCount: state.stats.trade,
    totalValue,
    platformBreakdown,
    genreBreakdown,
    yearBreakdown,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
    completionPercentage: games.length > 0 ? (state.stats.owned / games.length) * 100 : 0,
    lastUpdated: Date.now(),
  };
});

/**
 * Selected game
 */
export const selectedGame: Computed<GameWithKey | null> = computed(() => {
  const key = selectedGameKeySignal();
  if (!key) return null;

  const games = gamesSignal();
  return findGameByKey(games, key) ?? null;
});

// === Actions ===

export function setGames(games: Game[]): void {
  const gamesWithKeys = withKeys(games);
  gamesSignal.set(gamesWithKeys);

  // Cache in IndexedDB
  putMany(STORES.GAMES, gamesWithKeys).catch(console.warn);
}

export function setPrices(prices: Record<string, PriceData>): void {
  pricesSignal.set(new Map(Object.entries(prices) as [GameKey, PriceData][]));
}

export function setDataSource(source: DataSource): void {
  dataSourceSignal.set(source);
}

export function setLoading(loading: boolean, message?: string): void {
  isLoadingSignal.set(loading);
  if (message) {
    loadingMessageSignal.set(message);
  }
}

export function setError(error: string | null): void {
  errorSignal.set(error);
}

// === Collection Actions ===

export function setGameStatus(gameKey: GameKey, status: CollectionStatus): void {
  const state = collectionStore.state();
  const existing = state.entries.get(gameKey);
  const previousStatus = existing?.status ?? "none";

  if (previousStatus === status) return;

  if (status === "none") {
    collectionStore.dispatch({
      type: "GAME_REMOVED",
      payload: { gameKey },
    });
  } else {
    collectionStore.dispatch({
      type: "STATUS_CHANGED",
      payload: {
        gameKey,
        previousStatus,
        newStatus: status,
      },
    });
  }
}

export function getGameStatus(gameKey: GameKey): CollectionStatus {
  const state = collectionStore.state();
  return state.entries.get(gameKey)?.status ?? "none";
}

export function setGameNote(gameKey: GameKey, note: string): void {
  const state = collectionStore.state();
  const existing = state.entries.get(gameKey);
  const previousNote = existing?.note ?? "";

  if (previousNote === note) return;

  collectionStore.dispatch({
    type: "NOTE_UPDATED",
    payload: {
      gameKey,
      previousNote,
      newNote: note,
    },
  });
}

export function getGameNote(gameKey: GameKey): string {
  const state = collectionStore.state();
  return state.entries.get(gameKey)?.note ?? "";
}

export function setUserRating(gameKey: GameKey, rating: number): void {
  const state = collectionStore.state();
  const existing = state.entries.get(gameKey);
  const previousRating = existing?.userRating ?? null;

  collectionStore.dispatch({
    type: "RATING_CHANGED",
    payload: {
      gameKey,
      previousRating,
      newRating: rating,
    },
  });
}

export function getUserRating(gameKey: GameKey): number | null {
  const state = collectionStore.state();
  return state.entries.get(gameKey)?.userRating ?? null;
}

export function bulkImport(
  games: Array<{ gameKey: GameKey; status: CollectionStatus; note?: string }>,
  source: string
): void {
  const validGames = games.filter((g) => g.status !== "none");

  if (validGames.length === 0) return;

  collectionStore.dispatch({
    type: "BULK_IMPORT",
    payload: {
      games: validGames.map((g) => ({
        gameKey: g.gameKey,
        status: g.status,
        note: g.note,
      })),
      source,
    },
  });
}

export function clearCollection(): void {
  if (confirm("Are you sure you want to clear your entire collection?")) {
    collectionStore.dispatch({
      type: "COLLECTION_CLEARED",
      payload: {},
    });
  }
}

// === Filter Actions ===

export function updateFilters(updates: Partial<FilterState>): void {
  batch(() => {
    filterStateSignal.set((current) => ({ ...current, ...updates }));

    // Sync to URL
    setFiltersToURL({
      platforms: updates.platforms,
      genres: updates.genres,
      search: updates.searchQuery,
      sortBy: updates.sortBy,
      sortDir: updates.sortDirection,
    });
  });
}

export function togglePlatformFilter(platform: string): void {
  filterStateSignal.set((current) => {
    const platforms = new Set(current.platforms);
    if (platforms.has(platform)) {
      platforms.delete(platform);
    } else {
      platforms.add(platform);
    }
    return { ...current, platforms };
  });

  setFiltersToURL({ platforms: filterStateSignal().platforms });
}

export function toggleGenreFilter(genre: string): void {
  filterStateSignal.set((current) => {
    const genres = new Set(current.genres);
    if (genres.has(genre)) {
      genres.delete(genre);
    } else {
      genres.add(genre);
    }
    return { ...current, genres };
  });

  setFiltersToURL({ genres: filterStateSignal().genres });
}

export function setSearchQuery(query: string): void {
  filterStateSignal.set((current) => ({ ...current, searchQuery: query }));
  setFiltersToURL({ search: query });
}

export function setSort(sortBy: SortField, direction?: SortDirection): void {
  filterStateSignal.set((current) => ({
    ...current,
    sortBy,
    sortDirection: direction ?? current.sortDirection,
  }));

  setFiltersToURL({ sortBy, sortDir: direction ?? filterStateSignal().sortDirection });
}

export function resetFilters(): void {
  filterStateSignal.set(DEFAULT_FILTER_STATE);
  setFiltersToURL({
    platforms: new Set(),
    genres: new Set(),
    search: "",
    sortBy: "name",
    sortDir: "asc",
    status: "",
  });
}

// === UI Actions ===

export function setTheme(theme: Theme): void {
  themeSignal.set(theme);
  applyTheme(theme);
  setPreference("theme", theme);
}

export function setViewMode(mode: ViewMode): void {
  viewModeSignal.set(mode);
  setFiltersToURL({ view: mode });
  setPreference("viewMode", mode);
}

export function toggleSidebar(): void {
  sidebarOpenSignal.set((current) => !current);
}

export function openModal(modalId: string): void {
  activeModalSignal.set(modalId);
}

export function closeModal(): void {
  activeModalSignal.set(null);
}

export function selectGame(gameKey: GameKey | null): void {
  selectedGameKeySignal.set(gameKey);
  setGameKeyToURL(gameKey);
}

// === Getters (read-only access) ===

export const games = { get: () => gamesSignal(), subscribe: gamesSignal.subscribe };
export const prices = { get: () => pricesSignal(), subscribe: pricesSignal.subscribe };
export const dataSource = {
  get: () => dataSourceSignal(),
  subscribe: dataSourceSignal.subscribe,
};
export const isLoading = {
  get: () => isLoadingSignal(),
  subscribe: isLoadingSignal.subscribe,
};
export const loadingMessage = {
  get: () => loadingMessageSignal(),
  subscribe: loadingMessageSignal.subscribe,
};
export const error = { get: () => errorSignal(), subscribe: errorSignal.subscribe };
export const filterState = {
  get: () => filterStateSignal(),
  subscribe: filterStateSignal.subscribe,
};
export const theme = { get: () => themeSignal(), subscribe: themeSignal.subscribe };
export const viewMode = {
  get: () => viewModeSignal(),
  subscribe: viewModeSignal.subscribe,
};
export const sidebarOpen = {
  get: () => sidebarOpenSignal(),
  subscribe: sidebarOpenSignal.subscribe,
};
export const activeModal = {
  get: () => activeModalSignal(),
  subscribe: activeModalSignal.subscribe,
};
export const collection = {
  get: () => collectionStore.state().entries,
  subscribe: collectionStore.state.subscribe,
};

// === Undo/Redo ===

export const undo = collectionStore.undo;
export const redo = collectionStore.redo;
export const canUndo = collectionStore.canUndo;
export const canRedo = collectionStore.canRedo;

// === Helpers ===

function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function urlToFilterState(): Partial<FilterState> {
  const url = getFiltersFromURL();
  return {
    platforms: url.platforms,
    genres: url.genres,
    searchQuery: url.search,
    sortBy: url.sortBy as SortField,
    sortDirection: url.sortDir,
  };
}

// === Initialization ===

export async function initializeStore(): Promise<void> {
  // Load preferences
  const savedTheme = await getPreference<Theme>("theme", "dark");
  const savedViewMode = await getPreference<ViewMode>("viewMode", "grid");

  themeSignal.set(savedTheme);
  viewModeSignal.set(savedViewMode);
  applyTheme(savedTheme);

  // Check for game key in URL
  const gameKey = getGameKeyFromURL();
  if (gameKey) {
    selectedGameKeySignal.set(gameKey as GameKey);
  }

  // Listen for URL changes
  window.addEventListener("popstate", () => {
    const key = getGameKeyFromURL();
    selectedGameKeySignal.set(key as GameKey | null);

    const urlFilters = urlToFilterState();
    filterStateSignal.set((current) => ({ ...current, ...urlFilters }));
  });
}
