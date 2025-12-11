/**
 * Application State Store
 * Centralized reactive state management
 */

import { createSignal, computed, type ComputedSignal } from "../core/signals";
import type {
  Game,
  GameKey,
  GameWithKey,
  CollectionStatus,
  CollectionEntry,
  FilterState,
  SortOption,
  Theme,
  ViewMode,
  PriceData,
  CollectionStats,
  PricingSource,
} from "../core/types";
import { withGameKeys } from "../core/keys";

// === Storage Keys ===
const STORAGE_KEYS = {
  collection: "dragonshoard_collection",
  notes: "dragonshoard_notes",
  preferences: "dragonshoard_preferences",
  filterState: "dragonshoard_filters",
} as const;

// === Default States ===
const DEFAULT_FILTER_STATE: FilterState = {
  platforms: new Set(),
  genres: new Set(),
  regions: new Set(),
  statuses: new Set(),
  searchQuery: "",
  yearRange: {},
  minRating: 0,
  sortBy: "name",
  sortDirection: "asc",
};

// === Core State Signals ===

// Games data
const gamesSignal = createSignal<GameWithKey[]>([]);
const pricesSignal = createSignal<Map<GameKey, PriceData>>(new Map());
const priceMetaSignal = createSignal<{
  lastUpdated?: string;
  source: PricingSource;
  reason?: string;
}>({ source: "none" });
const isLoadingSignal = createSignal<boolean>(true);
const errorSignal = createSignal<string | null>(null);
const dataSourceSignal = createSignal<"supabase" | "sample" | "cache">("sample");

// Collection state
const collectionSignal = createSignal<Map<GameKey, CollectionEntry>>(new Map());
const notesSignal = createSignal<Map<GameKey, string>>(new Map());

// Filter state
const filterStateSignal = createSignal<FilterState>(DEFAULT_FILTER_STATE);

// UI state
const themeSignal = createSignal<Theme>("dark");
const viewModeSignal = createSignal<ViewMode>("grid");
const sidebarOpenSignal = createSignal<boolean>(false);
const modalGameSignal = createSignal<GameWithKey | null>(null);

// === Computed Values ===

/**
 * Games filtered by current filter state
 */
export const filteredGames: ComputedSignal<GameWithKey[]> = computed(() => {
  const games = gamesSignal.get();
  const filters = filterStateSignal.get();
  const collection = collectionSignal.get();
  const prices = pricesSignal.get();

  let result = [...games];

  // Platform filter
  if (filters.platforms.size > 0) {
    result = result.filter((g) => filters.platforms.has(g.platform));
  }

  // Genre filter
  if (filters.genres.size > 0) {
    result = result.filter((g) => {
      const gameGenres = g.genre?.split(",").map((s) => s.trim()) ?? [];
      return gameGenres.some((genre) => filters.genres.has(genre));
    });
  }

  // Region filter
  if (filters.regions.size > 0) {
    result = result.filter((g) => {
      const region = g.region ?? "NTSC";
      return filters.regions.has(region);
    });
  }

  // Status filter
  if (filters.statuses.size > 0) {
    result = result.filter((g) => {
      const entry = collection.get(g.key);
      const status = entry?.status ?? "none";
      return filters.statuses.has(status);
    });
  }

  // Search filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter((g) => {
      const searchable = [g.game_name, g.platform, g.genre, g.region]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }

  // Year range
  if (filters.yearRange.start !== undefined) {
    result = result.filter((g) => {
      const year = parseInt(String(g.release_year), 10);
      return !isNaN(year) && year >= filters.yearRange.start!;
    });
  }
  if (filters.yearRange.end !== undefined) {
    result = result.filter((g) => {
      const year = parseInt(String(g.release_year), 10);
      return !isNaN(year) && year <= filters.yearRange.end!;
    });
  }

  // Min rating
  if (filters.minRating > 0) {
    result = result.filter((g) => {
      const rating = parseFloat(String(g.rating));
      return !isNaN(rating) && rating >= filters.minRating;
    });
  }

  // Sort
  result.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case "name":
        comparison = a.game_name.localeCompare(b.game_name);
        break;
      case "rating": {
        const ratingA = parseFloat(String(a.rating)) || 0;
        const ratingB = parseFloat(String(b.rating)) || 0;
        comparison = ratingA - ratingB; // ascending by default
        break;
      }
      case "year": {
        const yearA = parseInt(String(a.release_year), 10) || 0;
        const yearB = parseInt(String(b.release_year), 10) || 0;
        comparison = yearA - yearB; // ascending by default
        break;
      }
      case "value": {
        const valueFor = (key: string) => {
          const price = prices.get(key);
          const raw = price?.loose ?? price?.cib ?? price?.new ?? 0;
          return Number(raw) || 0;
        };
        comparison = valueFor(a.key) - valueFor(b.key);
        break;
      }
      case "platform":
        comparison = a.platform.localeCompare(b.platform);
        break;
      default:
        comparison = 0;
    }
    return filters.sortDirection === "desc" ? -comparison : comparison;
  });

  return result;
});

/**
 * Available platforms from all games
 */
export const availablePlatforms: ComputedSignal<string[]> = computed(() => {
  const games = gamesSignal.get();
  const platforms = new Set(games.map((g) => g.platform).filter(Boolean));
  return Array.from(platforms).sort();
});

/**
 * Available genres from all games
 */
export const availableGenres: ComputedSignal<string[]> = computed(() => {
  const games = gamesSignal.get();
  const genres = new Set<string>();
  games.forEach((g) => {
    g.genre?.split(",").forEach((genre) => {
      const trimmed = genre.trim();
      if (trimmed) genres.add(trimmed);
    });
  });
  return Array.from(genres).sort();
});

/**
 * Collection statistics
 */
export const collectionStats: ComputedSignal<CollectionStats> = computed(() => {
  const games = gamesSignal.get();
  const collection = collectionSignal.get();
  const prices = pricesSignal.get();

  const statusCounts = {
    owned: 0,
    wishlist: 0,
    backlog: 0,
    trade: 0,
  };

  const platformBreakdown = new Map<string, number>();
  const genreBreakdown = new Map<string, number>();
  let totalValue = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  collection.forEach((entry, key) => {
    if (entry.status !== "none") {
      statusCounts[entry.status]++;

      // Find the game for platform/genre breakdown
      const game = games.find((g) => g.key === key);
      if (game && entry.status === "owned") {
        // Platform breakdown
        const count = platformBreakdown.get(game.platform) ?? 0;
        platformBreakdown.set(game.platform, count + 1);

        // Genre breakdown
        game.genre?.split(",").forEach((genre) => {
          const trimmed = genre.trim();
          if (trimmed) {
            const gc = genreBreakdown.get(trimmed) ?? 0;
            genreBreakdown.set(trimmed, gc + 1);
          }
        });

        // Value calculation
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
  });

  return {
    totalGames: games.length,
    ownedCount: statusCounts.owned,
    wishlistCount: statusCounts.wishlist,
    backlogCount: statusCounts.backlog,
    tradeCount: statusCounts.trade,
    totalValue,
    platformBreakdown,
    genreBreakdown,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
    completionPercentage:
      games.length > 0 ? (statusCounts.owned / games.length) * 100 : 0,
  };
});

// === Actions ===

/**
 * Set games data
 */
export function setGames(games: Game[]): void {
  gamesSignal.set(withGameKeys(games));
}

/**
 * Set price data
 */
export function setPrices(prices: Record<string, PriceData>): void {
  pricesSignal.set(new Map(Object.entries(prices)));
}

export function setPriceMeta(meta: {
  lastUpdated?: string;
  source: PricingSource;
  reason?: string;
}): void {
  priceMetaSignal.set(meta);
}

/**
 * Set loading state
 */
export function setLoading(loading: boolean): void {
  isLoadingSignal.set(loading);
}

/**
 * Set error state
 */
export function setError(error: string | null): void {
  errorSignal.set(error);
}

/**
 * Set data source
 */
export function setDataSource(source: "supabase" | "sample" | "cache"): void {
  dataSourceSignal.set(source);
}

/**
 * Update game status in collection
 */
export function setGameStatus(gameKey: GameKey, status: CollectionStatus): void {
  const collection = new Map(collectionSignal.get());

  if (status === "none") {
    collection.delete(gameKey);
  } else {
    collection.set(gameKey, {
      gameKey,
      status,
      addedAt: Date.now(),
    });
  }

  collectionSignal.set(collection);
  persistCollection();
}

/**
 * Get game status
 */
export function getGameStatus(gameKey: GameKey): CollectionStatus {
  return collectionSignal.get().get(gameKey)?.status ?? "none";
}

/**
 * Update game notes
 */
export function setGameNotes(gameKey: GameKey, notes: string): void {
  const notesMap = new Map(notesSignal.get());

  if (!notes.trim()) {
    notesMap.delete(gameKey);
  } else {
    notesMap.set(gameKey, notes.trim());
  }

  notesSignal.set(notesMap);
  persistNotes();
}

/**
 * Get game notes
 */
export function getGameNotes(gameKey: GameKey): string {
  return notesSignal.get().get(gameKey) ?? "";
}

/**
 * Update filter state
 */
export function updateFilters(updates: Partial<FilterState>): void {
  filterStateSignal.set((current) => ({
    ...current,
    ...updates,
  }));
}

/**
 * Reset all filters
 */
export function resetFilters(): void {
  filterStateSignal.set(DEFAULT_FILTER_STATE);
}

/**
 * Reset collection (for testing)
 */
export function resetCollection(): void {
  collectionSignal.set(new Map());
  notesSignal.set(new Map());
}

/**
 * Toggle platform filter
 */
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
}

/**
 * Toggle genre filter
 */
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
}

/**
 * Toggle region filter
 */
export function toggleRegionFilter(region: string): void {
  filterStateSignal.set((current) => {
    const regions = new Set(current.regions);
    if (regions.has(region)) {
      regions.delete(region);
    } else {
      regions.add(region);
    }
    return { ...current, regions };
  });
}

/**
 * Toggle status filter
 */
export function toggleStatusFilter(status: string): void {
  filterStateSignal.set((current) => {
    const statuses = new Set(current.statuses);
    if (statuses.has(status as any)) {
      statuses.delete(status as any);
    } else {
      statuses.add(status as any);
    }
    return { ...current, statuses };
  });
}

/**
 * Set search query
 */
export function setSearchQuery(query: string): void {
  filterStateSignal.set((current) => ({
    ...current,
    searchQuery: query,
  }));
}

/**
 * Set sort options
 */
export function setSort(sortBy: SortOption, direction?: "asc" | "desc"): void {
  filterStateSignal.set((current) => ({
    ...current,
    sortBy,
    sortDirection: direction ?? current.sortDirection,
  }));
}

/**
 * Set theme
 */
export function setTheme(theme: Theme): void {
  themeSignal.set(theme);
  document.documentElement.dataset.theme = theme;
  persistPreferences();
}

/**
 * Set view mode
 */
export function setViewMode(mode: ViewMode): void {
  viewModeSignal.set(mode);
  persistPreferences();
}

/**
 * Toggle sidebar
 */
export function toggleSidebar(): void {
  sidebarOpenSignal.set((current) => !current);
}

/**
 * Open game modal
 */
export function openGameModal(game: GameWithKey): void {
  modalGameSignal.set(game);
}

/**
 * Close game modal
 */
export function closeGameModal(): void {
  modalGameSignal.set(null);
}

// === Persistence ===

function persistCollection(): void {
  try {
    const collection = collectionSignal.get();
    const data = Object.fromEntries(collection);
    localStorage.setItem(STORAGE_KEYS.collection, JSON.stringify(data));
  } catch {
    console.warn("Failed to persist collection");
  }
}

function persistNotes(): void {
  try {
    const notes = notesSignal.get();
    const data = Object.fromEntries(notes);
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(data));
  } catch {
    console.warn("Failed to persist notes");
  }
}

function persistPreferences(): void {
  try {
    const prefs = {
      theme: themeSignal.get(),
      viewMode: viewModeSignal.get(),
    };
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(prefs));
  } catch {
    console.warn("Failed to persist preferences");
  }
}

/**
 * Load persisted state from localStorage
 */
export function loadPersistedState(): void {
  try {
    // Load collection
    const collectionRaw = localStorage.getItem(STORAGE_KEYS.collection);
    if (collectionRaw) {
      const data = JSON.parse(collectionRaw);
      collectionSignal.set(new Map(Object.entries(data)));
    }

    // Load notes
    const notesRaw = localStorage.getItem(STORAGE_KEYS.notes);
    if (notesRaw) {
      const data = JSON.parse(notesRaw);
      notesSignal.set(new Map(Object.entries(data)));
    }

    // Load preferences
    const prefsRaw = localStorage.getItem(STORAGE_KEYS.preferences);
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw);
      if (prefs.theme) themeSignal.set(prefs.theme);
      if (prefs.viewMode) viewModeSignal.set(prefs.viewMode);
    }
  } catch {
    console.warn("Failed to load persisted state");
  }
}

// === Getters for direct access ===

export const games = { get: gamesSignal.get, subscribe: gamesSignal.subscribe };
export const prices = { get: pricesSignal.get, subscribe: pricesSignal.subscribe };
export const priceMeta = {
  get: priceMetaSignal.get,
  subscribe: priceMetaSignal.subscribe,
};
export const isLoading = {
  get: isLoadingSignal.get,
  subscribe: isLoadingSignal.subscribe,
};
export const error = { get: errorSignal.get, subscribe: errorSignal.subscribe };
export const dataSource = {
  get: dataSourceSignal.get,
  subscribe: dataSourceSignal.subscribe,
};
export const collection = {
  get: collectionSignal.get,
  subscribe: collectionSignal.subscribe,
};
export const notes = { get: notesSignal.get, subscribe: notesSignal.subscribe };
export const filterState = {
  get: filterStateSignal.get,
  subscribe: filterStateSignal.subscribe,
};
export const theme = { get: themeSignal.get, subscribe: themeSignal.subscribe };
export const viewMode = { get: viewModeSignal.get, subscribe: viewModeSignal.subscribe };
export const sidebarOpen = {
  get: sidebarOpenSignal.get,
  subscribe: sidebarOpenSignal.subscribe,
};
export const modalGame = {
  get: modalGameSignal.get,
  subscribe: modalGameSignal.subscribe,
};
