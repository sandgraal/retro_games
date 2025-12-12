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
  PriceAlert,
  CollectionStats,
  PricingSource,
} from "../core/types";
import { withGameKeys } from "../core/keys";
import { safeStorage } from "../core/storage";
import { getPlatformsInFamily } from "../core/platform-families";

// === Storage Keys ===
const STORAGE_KEYS = {
  collection: "dragonshoard_collection",
  notes: "dragonshoard_notes",
  preferences: "dragonshoard_preferences",
  filterState: "dragonshoard_filters",
  priceAlerts: "dragonshoard_price_alerts",
} as const;

// === Default States ===
export const DEFAULT_FILTER_STATE: FilterState = {
  platforms: new Set(),
  genres: new Set(),
  regions: new Set(),
  statuses: new Set(),
  eras: new Set(),
  searchQuery: "",
  yearRange: {},
  priceRange: {},
  minRating: 0,
  sortBy: "name",
  sortDirection: "asc",
  showDealsOnly: false,
  showIndieOnly: false,
  showVrOnly: false,
};

// === Core State Signals ===

// Games data
export const gamesSignal = createSignal<GameWithKey[]>([]);
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
const priceAlertsSignal = createSignal<Map<GameKey, PriceAlert>>(new Map());

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

  // Era filter
  if (filters.eras.size > 0) {
    result = result.filter((g) => {
      const era = g.era ?? "retro"; // Default to retro for legacy data
      return filters.eras.has(era);
    });
  }

  // Indie filter
  if (filters.showIndieOnly) {
    result = result.filter((g) => g.is_indie === true);
  }

  // VR filter
  if (filters.showVrOnly) {
    result = result.filter((g) => g.is_vr_supported === true);
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

  // Price range filter
  if (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined) {
    result = result.filter((g) => {
      const price = prices.get(g.key);
      const loosePrice = price?.loose ?? 0;
      if (filters.priceRange.min !== undefined && loosePrice < filters.priceRange.min) {
        return false;
      }
      if (filters.priceRange.max !== undefined && loosePrice > filters.priceRange.max) {
        return false;
      }
      return loosePrice > 0; // Only include games with prices
    });
  }

  // Show only deals (price drops)
  if (filters.showDealsOnly) {
    result = result.filter((g) => {
      const price = prices.get(g.key);
      return price?.weekChangePct !== undefined && price.weekChangePct < -2;
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
 * Available eras from all games
 */
export const availableEras: ComputedSignal<string[]> = computed(() => {
  const games = gamesSignal.get();
  const eras = new Set(games.map((g) => g.era ?? "retro").filter(Boolean));
  // Return in chronological order
  const eraOrder = ["retro", "last-gen", "current"];
  return Array.from(eras).sort((a, b) => eraOrder.indexOf(a) - eraOrder.indexOf(b));
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
 * Set entire filter state (for presets)
 */
export function setFilters(state: FilterState): void {
  filterStateSignal.set(state);
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
 * Toggle all platforms in a family
 */
export function togglePlatformFamilyFilter(familyId: string): void {
  const familyPlatforms = getPlatformsInFamily(familyId);
  if (familyPlatforms.length === 0) return;

  filterStateSignal.set((current) => {
    const platforms = new Set(current.platforms);
    const games = gamesSignal.get();

    // Get available platforms in this family (ones that have games)
    const availableFamilyPlatforms = familyPlatforms.filter((p) =>
      games.some((g) => g.platform === p)
    );

    // Check if all family platforms are currently selected
    const allSelected = availableFamilyPlatforms.every((p) => platforms.has(p));

    if (allSelected) {
      // Deselect all
      availableFamilyPlatforms.forEach((p) => platforms.delete(p));
    } else {
      // Select all
      availableFamilyPlatforms.forEach((p) => platforms.add(p));
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
export function toggleStatusFilter(status: CollectionStatus): void {
  filterStateSignal.set((current) => {
    const statuses = new Set(current.statuses);
    if (statuses.has(status)) {
      statuses.delete(status);
    } else {
      statuses.add(status);
    }
    return { ...current, statuses };
  });
}

/**
 * Toggle era filter
 */
export function toggleEraFilter(era: "retro" | "last-gen" | "current"): void {
  filterStateSignal.set((current) => {
    const eras = new Set(current.eras);
    if (eras.has(era)) {
      eras.delete(era);
    } else {
      eras.add(era);
    }
    return { ...current, eras };
  });
}

/**
 * Toggle indie-only filter
 */
export function toggleIndieFilter(): void {
  filterStateSignal.set((current) => ({
    ...current,
    showIndieOnly: !current.showIndieOnly,
  }));
}

/**
 * Toggle VR-only filter
 */
export function toggleVrFilter(): void {
  filterStateSignal.set((current) => ({
    ...current,
    showVrOnly: !current.showVrOnly,
  }));
}

/**
 * Get a random game from current filtered results
 */
export function getRandomGame(): GameWithKey | null {
  const games = filteredGames.get();
  if (games.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * games.length);
  return games[randomIndex];
}

/**
 * Get a random game from all games (ignores filters)
 */
export function getRandomGameFromAll(): GameWithKey | null {
  const games = gamesSignal.get();
  if (games.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * games.length);
  return games[randomIndex];
}

/**
 * Apply a quick filter preset
 */
export function applyQuickFilter(
  preset: "popular" | "new" | "affordable" | "clear"
): void {
  if (preset === "clear") {
    resetFilters();
    return;
  }

  // Start with default filters
  const baseFilter = { ...DEFAULT_FILTER_STATE };

  switch (preset) {
    case "popular":
      // Top rated games (7+ rating)
      filterStateSignal.set({
        ...baseFilter,
        minRating: 7,
        sortBy: "rating",
        sortDirection: "desc",
      });
      break;
    case "new":
      // Recent releases (last 5 years)
      filterStateSignal.set({
        ...baseFilter,
        yearRange: { start: new Date().getFullYear() - 5 },
        sortBy: "year",
        sortDirection: "desc",
      });
      break;
    case "affordable":
      // Games under $30
      filterStateSignal.set({
        ...baseFilter,
        priceRange: { max: 30 },
        sortBy: "value",
        sortDirection: "asc",
      });
      break;
  }
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

// Callbacks for game modal open
const gameModalOpenCallbacks: ((game: GameWithKey) => void)[] = [];

/**
 * Register a callback for when a game modal opens
 */
export function onGameModalOpen(callback: (game: GameWithKey) => void): () => void {
  gameModalOpenCallbacks.push(callback);
  return () => {
    const index = gameModalOpenCallbacks.indexOf(callback);
    if (index > -1) gameModalOpenCallbacks.splice(index, 1);
  };
}

/**
 * Open game modal
 */
export function openGameModal(game: GameWithKey): void {
  modalGameSignal.set(game);
  // Notify callbacks
  gameModalOpenCallbacks.forEach((cb) => cb(game));
}

/**
 * Close game modal
 */
export function closeGameModal(): void {
  modalGameSignal.set(null);
}

/**
 * Set price range filter (prices in cents)
 */
export function setPriceRange(min?: number, max?: number): void {
  filterStateSignal.set((current) => ({
    ...current,
    priceRange: { min, max },
  }));
}

/**
 * Toggle deals-only filter
 */
export function toggleDealsOnly(): void {
  filterStateSignal.set((current) => ({
    ...current,
    showDealsOnly: !current.showDealsOnly,
  }));
}

// === Price Alerts ===

/**
 * Set a price alert for a game
 */
export function setPriceAlert(
  gameKey: GameKey,
  targetPriceCents: number,
  condition: "loose" | "cib" | "new" = "loose"
): void {
  const alert: PriceAlert = {
    gameKey,
    targetPriceCents,
    condition,
    createdAt: Date.now(),
  };

  priceAlertsSignal.set((current) => {
    const updated = new Map(current);
    updated.set(gameKey, alert);
    return updated;
  });
  persistPriceAlerts();
}

/**
 * Remove a price alert
 */
export function removePriceAlert(gameKey: GameKey): void {
  priceAlertsSignal.set((current) => {
    const updated = new Map(current);
    updated.delete(gameKey);
    return updated;
  });
  persistPriceAlerts();
}

/**
 * Get price alert for a game
 */
export function getPriceAlert(gameKey: GameKey): PriceAlert | undefined {
  return priceAlertsSignal.get().get(gameKey);
}

/**
 * Check if any alerts are triggered
 */
export function checkPriceAlerts(): Array<{ alert: PriceAlert; currentPrice: number }> {
  const alerts = priceAlertsSignal.get();
  const prices = pricesSignal.get();
  const triggered: Array<{ alert: PriceAlert; currentPrice: number }> = [];

  alerts.forEach((alert, gameKey) => {
    if (alert.triggered) return;

    const priceData = prices.get(gameKey);
    if (!priceData) return;

    const currentPrice =
      alert.condition === "loose"
        ? priceData.loose
        : alert.condition === "cib"
          ? priceData.cib
          : priceData.new;

    if (currentPrice !== undefined && currentPrice <= alert.targetPriceCents) {
      triggered.push({ alert, currentPrice });

      // Mark as triggered
      priceAlertsSignal.set((current) => {
        const updated = new Map(current);
        const updatedAlert = { ...alert, triggered: true, triggeredAt: Date.now() };
        updated.set(gameKey, updatedAlert);
        return updated;
      });
    }
  });

  if (triggered.length > 0) {
    persistPriceAlerts();
  }

  return triggered;
}

/**
 * Export price alerts signal for components
 */
export const priceAlerts = priceAlertsSignal;

// === Persistence ===

function persistCollection(): void {
  try {
    const collection = collectionSignal.get();
    const data = Object.fromEntries(collection);
    safeStorage.setItem(STORAGE_KEYS.collection, JSON.stringify(data));
  } catch {
    console.warn("Failed to persist collection");
  }
}

function persistNotes(): void {
  try {
    const notes = notesSignal.get();
    const data = Object.fromEntries(notes);
    safeStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(data));
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
    safeStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(prefs));
  } catch {
    console.warn("Failed to persist preferences");
  }
}

function persistPriceAlerts(): void {
  try {
    const alerts = priceAlertsSignal.get();
    const data = Object.fromEntries(alerts);
    safeStorage.setItem(STORAGE_KEYS.priceAlerts, JSON.stringify(data));
  } catch {
    console.warn("Failed to persist price alerts");
  }
}

/**
 * Load persisted state from localStorage
 */
export function loadPersistedState(): void {
  try {
    // Load collection
    const collectionRaw = safeStorage.getItem(STORAGE_KEYS.collection);
    if (collectionRaw) {
      const data = JSON.parse(collectionRaw);
      collectionSignal.set(new Map(Object.entries(data)));
    }

    // Load notes
    const notesRaw = safeStorage.getItem(STORAGE_KEYS.notes);
    if (notesRaw) {
      const data = JSON.parse(notesRaw);
      notesSignal.set(new Map(Object.entries(data)));
    }

    // Load preferences
    const prefsRaw = safeStorage.getItem(STORAGE_KEYS.preferences);
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw);
      if (prefs.theme) themeSignal.set(prefs.theme);
      if (prefs.viewMode) viewModeSignal.set(prefs.viewMode);
    }

    // Load price alerts
    const alertsRaw = safeStorage.getItem(STORAGE_KEYS.priceAlerts);
    if (alertsRaw) {
      const data = JSON.parse(alertsRaw);
      priceAlertsSignal.set(new Map(Object.entries(data)));
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
