/**
 * Filter Sidebar Component
 * Handles filter UI and interactions
 */

import type { ComponentContext } from "./components";
import type { SortOption } from "../core/types";
import { mount, debounce, escapeHtml } from "./components";
import {
  availablePlatforms,
  availableGenres,
  filterState,
  togglePlatformFilter,
  toggleGenreFilter,
  toggleRegionFilter,
  toggleStatusFilter,
  setSearchQuery,
  setSort,
  resetFilters,
  setPriceRange,
  toggleDealsOnly,
} from "../state/store";
import { effect } from "../core/signals";

const VALID_SORT_OPTIONS: SortOption[] = ["name", "rating", "year", "value", "platform"];

function isValidSortOption(value: string): value is SortOption {
  return VALID_SORT_OPTIONS.includes(value as SortOption);
}

/**
 * Initialize the filter sidebar
 */
export function initFilters(ctx: ComponentContext): void {
  const { element, cleanup } = ctx;

  // Subscribe to available platforms
  const platformUnsub = effect(() => {
    const platforms = availablePlatforms.get();
    const currentFilters = filterState.get().platforms;
    renderPlatformFilters(platforms, currentFilters);
  });
  cleanup.push(platformUnsub);

  // Subscribe to available genres
  const genreUnsub = effect(() => {
    const genres = availableGenres.get();
    const currentFilters = filterState.get().genres;
    renderGenreFilters(genres, currentFilters);
  });
  cleanup.push(genreUnsub);

  // Setup search input
  setupSearchInput(cleanup);

  // Setup sort buttons
  setupSortButtons(cleanup);

  // Setup clear button
  setupClearButton(cleanup);

  // Setup price filter
  setupPriceFilter(cleanup);

  // Setup filter checkboxes (event delegation)
  element.addEventListener("change", handleFilterChange);
  cleanup.push(() => element.removeEventListener("change", handleFilterChange));
}

/**
 * Render platform filter checkboxes
 */
function renderPlatformFilters(platforms: string[], active: Set<string>): void {
  const container = document.getElementById("platformFilters");
  if (!container) return;

  container.innerHTML = platforms
    .map(
      (platform) => `
      <label class="filter-option">
        <input 
          type="checkbox" 
          value="${escapeAttr(platform)}" 
          data-filter="platform"
          ${active.has(platform) ? "checked" : ""}
        />
        <span class="filter-option-label">${escapeHtml(platform)}</span>
      </label>
    `
    )
    .join("");
}

/**
 * Render genre filter checkboxes
 */
function renderGenreFilters(genres: string[], active: Set<string>): void {
  const container = document.getElementById("genreFilters");
  if (!container) return;

  container.innerHTML = genres
    .map(
      (genre) => `
      <label class="filter-option">
        <input 
          type="checkbox" 
          value="${escapeAttr(genre)}" 
          data-filter="genre"
          ${active.has(genre) ? "checked" : ""}
        />
        <span class="filter-option-label">${escapeHtml(genre)}</span>
      </label>
    `
    )
    .join("");
}

/**
 * Setup search input
 */
function setupSearchInput(cleanup: (() => void)[]): void {
  const inputs = [
    document.getElementById("filterSearch"),
    document.getElementById("headerSearch"),
  ].filter(Boolean) as HTMLInputElement[];

  const handleSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  inputs.forEach((input) => {
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      handleSearch(target.value);
      // Sync all search inputs
      inputs.forEach((other) => {
        if (other !== target) other.value = target.value;
      });
    };

    input.addEventListener("input", handler);
    cleanup.push(() => input.removeEventListener("input", handler));
  });
}

/**
 * Setup sort buttons
 */
function setupSortButtons(cleanup: (() => void)[]): void {
  const container = document.getElementById("sortOptions");
  if (!container) return;

  const handler = (e: Event) => {
    const button = (e.target as HTMLElement).closest(".sort-option");
    if (!button) return;

    const sort = button.getAttribute("data-sort");
    if (sort && isValidSortOption(sort)) {
      // Toggle direction if same sort is clicked
      const current = filterState.get();
      if (current.sortBy === sort) {
        setSort(sort, current.sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSort(sort);
      }

      // Update active state
      container.querySelectorAll(".sort-option").forEach((btn) => {
        btn.classList.remove("active");
      });
      button.classList.add("active");
    }
  };

  container.addEventListener("click", handler);
  cleanup.push(() => container.removeEventListener("click", handler));
}

/**
 * Setup clear button
 */
function setupClearButton(cleanup: (() => void)[]): void {
  const button = document.getElementById("clearFilters");
  if (!button) return;

  const handler = () => {
    resetFilters();
    // Clear search inputs
    ["filterSearch", "headerSearch"].forEach((id) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) input.value = "";
    });
  };

  button.addEventListener("click", handler);
  cleanup.push(() => button.removeEventListener("click", handler));
}

const VALID_STATUSES = ["none", "owned", "wishlist", "backlog", "trade"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string): value is ValidStatus {
  return VALID_STATUSES.includes(value as ValidStatus);
}

/**
 * Setup price filter inputs and deals toggle
 */
function setupPriceFilter(cleanup: (() => void)[]): void {
  const priceMin = document.getElementById("priceMin") as HTMLInputElement | null;
  const priceMax = document.getElementById("priceMax") as HTMLInputElement | null;
  const dealsToggle = document.getElementById("dealsToggle") as HTMLButtonElement | null;

  // Handle price range changes (debounced)
  const handlePriceChange = debounce(() => {
    const minValue = priceMin?.value ? parseFloat(priceMin.value) * 100 : undefined; // Convert dollars to cents
    const maxValue = priceMax?.value ? parseFloat(priceMax.value) * 100 : undefined;
    setPriceRange(minValue, maxValue);
  }, 400);

  if (priceMin) {
    priceMin.addEventListener("input", handlePriceChange);
    cleanup.push(() => priceMin.removeEventListener("input", handlePriceChange));
  }

  if (priceMax) {
    priceMax.addEventListener("input", handlePriceChange);
    cleanup.push(() => priceMax.removeEventListener("input", handlePriceChange));
  }

  // Handle deals toggle
  if (dealsToggle) {
    const handleDealsClick = () => {
      toggleDealsOnly();
      const isActive = filterState.get().showDealsOnly;
      dealsToggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      dealsToggle.classList.toggle("active", isActive);
    };

    dealsToggle.addEventListener("click", handleDealsClick);
    cleanup.push(() => dealsToggle.removeEventListener("click", handleDealsClick));
  }
}

/**
 * Handle filter checkbox changes
 */
function handleFilterChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target.type !== "checkbox") return;

  const filterType = target.dataset.filter;
  const { value } = target;

  if (filterType === "platform") {
    togglePlatformFilter(value);
  } else if (filterType === "genre") {
    toggleGenreFilter(value);
  } else if (filterType === "region") {
    toggleRegionFilter(value);
  } else if (filterType === "status" || target.closest("#statusFilters")) {
    // Status filters may not have data-filter attribute in HTML
    if (isValidStatus(value)) {
      toggleStatusFilter(value);
    }
  }
}

/**
 * Escape attribute value for safe use in HTML attribute contexts.
 * Handles double quotes, single quotes, ampersands, and angle brackets.
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Mount the filters component
 */
export function mountFilters(selector: string | HTMLElement): () => void {
  return mount(selector, initFilters);
}
