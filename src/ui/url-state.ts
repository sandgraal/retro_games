/**
 * URL State Synchronization
 * Sync filter state to/from URL for shareable links
 */

import { effect } from "../core/signals";
import { filterState, updateFilters, resetFilters } from "../state/store";
import type { FilterState, CollectionStatus, GameEra, SortOption } from "../core/types";

// URL parameter names
const URL_PARAMS = {
  search: "q",
  platforms: "platforms",
  genres: "genres",
  regions: "regions",
  statuses: "status",
  eras: "era",
  yearStart: "year_min",
  yearEnd: "year_max",
  priceMin: "price_min",
  priceMax: "price_max",
  minRating: "rating",
  sortBy: "sort",
  sortDirection: "order",
  dealsOnly: "deals",
  indieOnly: "indie",
  vrOnly: "vr",
  page: "page",
} as const;

/**
 * Read filter state from URL
 */
export function readFiltersFromUrl(): Partial<FilterState> {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const filters: Partial<FilterState> = {};

  // Search query
  const search = params.get(URL_PARAMS.search);
  if (search) {
    filters.searchQuery = search;
  }

  // Platforms (comma-separated)
  const platforms = params.get(URL_PARAMS.platforms);
  if (platforms) {
    filters.platforms = new Set(platforms.split(",").filter(Boolean));
  }

  // Genres (comma-separated)
  const genres = params.get(URL_PARAMS.genres);
  if (genres) {
    filters.genres = new Set(genres.split(",").filter(Boolean));
  }

  // Regions (comma-separated)
  const regions = params.get(URL_PARAMS.regions);
  if (regions) {
    filters.regions = new Set(regions.split(",").filter(Boolean));
  }

  // Statuses (comma-separated)
  const statuses = params.get(URL_PARAMS.statuses);
  if (statuses) {
    const validStatuses: CollectionStatus[] = [
      "none",
      "owned",
      "wishlist",
      "backlog",
      "trade",
    ];
    filters.statuses = new Set(
      statuses
        .split(",")
        .filter((s): s is CollectionStatus =>
          validStatuses.includes(s as CollectionStatus)
        )
    );
  }

  // Eras (comma-separated)
  const eras = params.get(URL_PARAMS.eras);
  if (eras) {
    const validEras: GameEra[] = ["retro", "last-gen", "current"];
    filters.eras = new Set(
      eras.split(",").filter((e): e is GameEra => validEras.includes(e as GameEra))
    );
  }

  // Year range
  const yearStart = params.get(URL_PARAMS.yearStart);
  const yearEnd = params.get(URL_PARAMS.yearEnd);
  if (yearStart || yearEnd) {
    filters.yearRange = {
      start: yearStart ? parseInt(yearStart, 10) : undefined,
      end: yearEnd ? parseInt(yearEnd, 10) : undefined,
    };
  }

  // Price range (in cents in URL for precision)
  const priceMin = params.get(URL_PARAMS.priceMin);
  const priceMax = params.get(URL_PARAMS.priceMax);
  if (priceMin || priceMax) {
    filters.priceRange = {
      min: priceMin ? parseInt(priceMin, 10) : undefined,
      max: priceMax ? parseInt(priceMax, 10) : undefined,
    };
  }

  // Min rating
  const minRating = params.get(URL_PARAMS.minRating);
  if (minRating) {
    filters.minRating = parseFloat(minRating);
  }

  // Sort
  const sortBy = params.get(URL_PARAMS.sortBy);
  if (sortBy) {
    const validSorts: SortOption[] = ["name", "rating", "year", "value", "platform"];
    if (validSorts.includes(sortBy as SortOption)) {
      filters.sortBy = sortBy as SortOption;
    }
  }

  // Sort direction
  const sortDirection = params.get(URL_PARAMS.sortDirection);
  if (sortDirection === "asc" || sortDirection === "desc") {
    filters.sortDirection = sortDirection;
  }

  // Boolean filters
  if (params.get(URL_PARAMS.dealsOnly) === "1") {
    filters.showDealsOnly = true;
  }
  if (params.get(URL_PARAMS.indieOnly) === "1") {
    filters.showIndieOnly = true;
  }
  if (params.get(URL_PARAMS.vrOnly) === "1") {
    filters.showVrOnly = true;
  }

  return filters;
}

/**
 * Write filter state to URL
 */
export function writeFiltersToUrl(state: FilterState): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // Clear existing filter params
  Object.values(URL_PARAMS).forEach((param) => params.delete(param));

  // Search query
  if (state.searchQuery) {
    params.set(URL_PARAMS.search, state.searchQuery);
  }

  // Platforms
  if (state.platforms.size > 0) {
    params.set(URL_PARAMS.platforms, Array.from(state.platforms).join(","));
  }

  // Genres
  if (state.genres.size > 0) {
    params.set(URL_PARAMS.genres, Array.from(state.genres).join(","));
  }

  // Regions
  if (state.regions.size > 0) {
    params.set(URL_PARAMS.regions, Array.from(state.regions).join(","));
  }

  // Statuses
  if (state.statuses.size > 0) {
    params.set(URL_PARAMS.statuses, Array.from(state.statuses).join(","));
  }

  // Eras
  if (state.eras.size > 0) {
    params.set(URL_PARAMS.eras, Array.from(state.eras).join(","));
  }

  // Year range
  if (state.yearRange.start) {
    params.set(URL_PARAMS.yearStart, String(state.yearRange.start));
  }
  if (state.yearRange.end) {
    params.set(URL_PARAMS.yearEnd, String(state.yearRange.end));
  }

  // Price range
  if (state.priceRange.min) {
    params.set(URL_PARAMS.priceMin, String(state.priceRange.min));
  }
  if (state.priceRange.max) {
    params.set(URL_PARAMS.priceMax, String(state.priceRange.max));
  }

  // Min rating
  if (state.minRating > 0) {
    params.set(URL_PARAMS.minRating, String(state.minRating));
  }

  // Sort (only if not default)
  if (state.sortBy !== "name") {
    params.set(URL_PARAMS.sortBy, state.sortBy);
  }
  if (state.sortDirection !== "asc") {
    params.set(URL_PARAMS.sortDirection, state.sortDirection);
  }

  // Boolean filters
  if (state.showDealsOnly) {
    params.set(URL_PARAMS.dealsOnly, "1");
  }
  if (state.showIndieOnly) {
    params.set(URL_PARAMS.indieOnly, "1");
  }
  if (state.showVrOnly) {
    params.set(URL_PARAMS.vrOnly, "1");
  }

  // Update URL without reload
  const newUrl = params.toString()
    ? `${url.pathname}?${params.toString()}`
    : url.pathname;
  window.history.replaceState({}, "", newUrl);
}

/**
 * Generate a shareable URL for current filters
 */
export function getShareableFilterUrl(): string {
  const state = filterState.get();
  const url = new URL(window.location.origin + window.location.pathname);
  const params = url.searchParams;

  // Add all active filters to URL
  if (state.searchQuery) params.set(URL_PARAMS.search, state.searchQuery);
  if (state.platforms.size > 0)
    params.set(URL_PARAMS.platforms, Array.from(state.platforms).join(","));
  if (state.genres.size > 0)
    params.set(URL_PARAMS.genres, Array.from(state.genres).join(","));
  if (state.regions.size > 0)
    params.set(URL_PARAMS.regions, Array.from(state.regions).join(","));
  if (state.statuses.size > 0)
    params.set(URL_PARAMS.statuses, Array.from(state.statuses).join(","));
  if (state.eras.size > 0) params.set(URL_PARAMS.eras, Array.from(state.eras).join(","));
  if (state.yearRange.start)
    params.set(URL_PARAMS.yearStart, String(state.yearRange.start));
  if (state.yearRange.end) params.set(URL_PARAMS.yearEnd, String(state.yearRange.end));
  if (state.priceRange.min) params.set(URL_PARAMS.priceMin, String(state.priceRange.min));
  if (state.priceRange.max) params.set(URL_PARAMS.priceMax, String(state.priceRange.max));
  if (state.minRating > 0) params.set(URL_PARAMS.minRating, String(state.minRating));
  if (state.sortBy !== "name") params.set(URL_PARAMS.sortBy, state.sortBy);
  if (state.sortDirection !== "asc")
    params.set(URL_PARAMS.sortDirection, state.sortDirection);
  if (state.showDealsOnly) params.set(URL_PARAMS.dealsOnly, "1");
  if (state.showIndieOnly) params.set(URL_PARAMS.indieOnly, "1");
  if (state.showVrOnly) params.set(URL_PARAMS.vrOnly, "1");

  return url.toString();
}

/**
 * Copy shareable filter URL to clipboard
 */
export async function copyFilterUrl(): Promise<boolean> {
  try {
    const url = getShareableFilterUrl();
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.warn("Failed to copy filter URL:", error);
    return false;
  }
}

/**
 * Check if URL has any filter params
 */
export function hasUrlFilters(): boolean {
  const url = new URL(window.location.href);
  return Object.values(URL_PARAMS).some((param) => url.searchParams.has(param));
}

/**
 * Clear all filter params from URL
 */
export function clearUrlFilters(): void {
  const url = new URL(window.location.href);
  Object.values(URL_PARAMS).forEach((param) => url.searchParams.delete(param));
  window.history.replaceState({}, "", url.pathname + url.search);
}

/**
 * Initialize URL state synchronization
 */
export function initUrlState(): () => void {
  // Read initial state from URL
  if (hasUrlFilters()) {
    const urlFilters = readFiltersFromUrl();
    updateFilters(urlFilters);
  }

  // Debounce URL updates to avoid excessive history changes
  let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  // Subscribe to filter changes and sync to URL
  const unsub = effect(() => {
    const state = filterState.get();

    // Debounce URL updates
    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout);
    }

    urlUpdateTimeout = setTimeout(() => {
      writeFiltersToUrl(state);
    }, 300);
  });

  // Handle browser back/forward
  const handlePopState = (): void => {
    if (hasUrlFilters()) {
      const urlFilters = readFiltersFromUrl();
      updateFilters(urlFilters);
    } else {
      resetFilters();
    }
  };

  window.addEventListener("popstate", handlePopState);

  // Cleanup
  return () => {
    unsub();
    window.removeEventListener("popstate", handlePopState);
    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout);
    }
  };
}

/**
 * Generate human-readable description of current filters
 */
export function getFilterDescription(): string {
  const state = filterState.get();
  const parts: string[] = [];

  if (state.searchQuery) {
    parts.push(`"${state.searchQuery}"`);
  }

  if (state.platforms.size > 0) {
    const count = state.platforms.size;
    parts.push(count === 1 ? `1 platform` : `${count} platforms`);
  }

  if (state.genres.size > 0) {
    const count = state.genres.size;
    parts.push(count === 1 ? `1 genre` : `${count} genres`);
  }

  if (state.eras.size > 0) {
    parts.push(Array.from(state.eras).join(", ") + " era");
  }

  if (state.minRating > 0) {
    parts.push(`rating ${state.minRating}+`);
  }

  if (state.showDealsOnly) {
    parts.push("deals only");
  }

  return parts.length > 0 ? parts.join(", ") : "All games";
}
