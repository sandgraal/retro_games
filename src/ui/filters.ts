/**
 * Filter Sidebar Component
 * Handles filter UI and interactions
 */

import type { ComponentContext } from "./components";
import type { SortOption, GameWithKey } from "../core/types";
import { mount, debounce, escapeHtml } from "./components";
import {
  availablePlatforms,
  availableGenres,
  availableEras,
  filterState,
  filteredGames,
  gamesSignal,
  togglePlatformFilter,
  toggleGenreFilter,
  toggleRegionFilter,
  toggleStatusFilter,
  toggleEraFilter,
  toggleIndieFilter,
  toggleVrFilter,
  setSearchQuery,
  setSort,
  resetFilters,
  setPriceRange,
  toggleDealsOnly,
  applyQuickFilter,
  togglePlatformFamilyFilter,
} from "../state/store";
import { effect } from "../core/signals";
import { groupPlatformsByFamily } from "../core/platform-families";

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

  // Subscribe to available eras and update UI
  const eraUnsub = effect(() => {
    const eras = availableEras.get();
    const currentFilters = filterState.get().eras;
    updateEraFilterCounts(eras, currentFilters);
  });
  cleanup.push(eraUnsub);

  // Subscribe to special toggle states
  const specialUnsub = effect(() => {
    const state = filterState.get();
    updateSpecialToggles(state.showIndieOnly, state.showVrOnly, state.showDealsOnly);
  });
  cleanup.push(specialUnsub);

  // Setup search input
  setupSearchInput(cleanup);

  // Setup sort buttons
  setupSortButtons(cleanup);

  // Setup clear button
  setupClearButton(cleanup);

  // Setup price filter
  setupPriceFilter(cleanup);

  // Setup quick filters
  setupQuickFilters(cleanup);

  // Subscribe to match count updates
  const matchCountUnsub = effect(() => {
    const games = filteredGames.get();
    const total = gamesSignal.get().length;
    updateMatchCount(games.length, total);
  });
  cleanup.push(matchCountUnsub);

  // Setup filter checkboxes (event delegation)
  element.addEventListener("change", handleFilterChange);
  cleanup.push(() => element.removeEventListener("change", handleFilterChange));
}

/**
 * Render platform filter checkboxes grouped by family
 */
function renderPlatformFilters(platforms: string[], active: Set<string>): void {
  const container = document.getElementById("platformFilters");
  if (!container) return;

  // Count games per platform
  const games: GameWithKey[] = gamesSignal.get();
  const platformCounts = new Map<string, number>();
  games.forEach((game: GameWithKey) => {
    const count = platformCounts.get(game.platform) || 0;
    platformCounts.set(game.platform, count + 1);
  });

  // Group platforms by family
  const familyGroups = groupPlatformsByFamily(platforms, platformCounts);

  // Render grouped platforms
  container.innerHTML = familyGroups
    .map(({ family, platforms: familyPlatforms, totalCount }) => {
      const familyPlatformNames = familyPlatforms.map((p) => p.name);
      const allSelected = familyPlatformNames.every((p) => active.has(p));
      const someSelected = familyPlatformNames.some((p) => active.has(p));

      return `
      <div class="platform-family" data-family="${family.id}">
        <button 
          type="button" 
          class="platform-family-header ${someSelected ? "platform-family-header--active" : ""}"
          data-family-toggle="${family.id}"
          aria-expanded="false"
          style="--family-color: ${family.color}"
        >
          <span class="platform-family-icon">${family.icon}</span>
          <span class="platform-family-name">${escapeHtml(family.name)}</span>
          <span class="platform-family-count">${totalCount}</span>
          <label class="platform-family-select-all" title="Select all ${family.name}">
            <input 
              type="checkbox" 
              data-filter="platform-family"
              value="${family.id}"
              ${allSelected ? "checked" : ""}
              ${someSelected && !allSelected ? 'class="indeterminate"' : ""}
            />
          </label>
          <span class="platform-family-arrow">▶</span>
        </button>
        <div class="platform-family-items" hidden>
          ${familyPlatforms
            .map(
              ({ name, count }) => `
            <label class="filter-option filter-option--nested">
              <input 
                type="checkbox" 
                value="${escapeAttr(name)}" 
                data-filter="platform"
                ${active.has(name) ? "checked" : ""}
              />
              <span class="filter-option-label">${escapeHtml(name)}</span>
              <span class="filter-option-count">${count}</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `;
    })
    .join("");

  // Setup family toggle handlers
  container.querySelectorAll<HTMLButtonElement>("[data-family-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // Don't toggle if clicking the checkbox
      if ((e.target as HTMLElement).closest(".platform-family-select-all")) return;

      const items = btn.nextElementSibling as HTMLElement;
      const isExpanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!isExpanded));
      items.hidden = isExpanded;
    });
  });

  // Handle indeterminate state for checkboxes
  container
    .querySelectorAll<HTMLInputElement>(
      'input.indeterminate[data-filter="platform-family"]'
    )
    .forEach((checkbox) => {
      checkbox.indeterminate = true;
      checkbox.classList.remove("indeterminate");
    });
}

/**
 * Update era filter checkbox states and counts
 */
function updateEraFilterCounts(_availableEras: string[], active: Set<string>): void {
  const container = document.getElementById("eraFilters");
  if (!container) return;

  // Update checkbox states
  container
    .querySelectorAll<HTMLInputElement>('input[data-filter="era"]')
    .forEach((checkbox) => {
      checkbox.checked = active.has(checkbox.value as "retro" | "last-gen" | "current");
    });

  // Update count badge
  const countEl = document.getElementById("eraCount");
  if (countEl) {
    countEl.textContent = String(active.size);
  }
}

/**
 * Update special toggle states (indie, VR, deals)
 */
function updateSpecialToggles(
  showIndieOnly: boolean,
  showVrOnly: boolean,
  showDealsOnly: boolean
): void {
  const indieToggle = document.getElementById("indieToggle") as HTMLInputElement | null;
  const vrToggle = document.getElementById("vrToggle") as HTMLInputElement | null;
  const dealsToggle = document.getElementById("dealsToggle") as HTMLInputElement | null;

  if (indieToggle) {
    indieToggle.checked = showIndieOnly;
  }
  if (vrToggle) {
    vrToggle.checked = showVrOnly;
  }
  if (dealsToggle) {
    dealsToggle.checked = showDealsOnly;
  }
}

/**
 * Render genre filter checkboxes with counts
 */
function renderGenreFilters(genres: string[], active: Set<string>): void {
  const container = document.getElementById("genreFilters");
  if (!container) return;

  // Count games per genre
  const games: GameWithKey[] = gamesSignal.get();
  const genreCounts = new Map<string, number>();
  games.forEach((game: GameWithKey) => {
    game.genre?.split(",").forEach((g: string) => {
      const trimmed = g.trim();
      if (trimmed) {
        const count = genreCounts.get(trimmed) || 0;
        genreCounts.set(trimmed, count + 1);
      }
    });
  });

  // Sort genres by count (descending) then by name
  const sortedGenres = [...genres].sort((a, b) => {
    const countDiff = (genreCounts.get(b) || 0) - (genreCounts.get(a) || 0);
    return countDiff !== 0 ? countDiff : a.localeCompare(b);
  });

  container.innerHTML = sortedGenres
    .map((genre) => {
      const count = genreCounts.get(genre) || 0;
      return `
      <label class="filter-option">
        <input 
          type="checkbox" 
          value="${escapeAttr(genre)}" 
          data-filter="genre"
          ${active.has(genre) ? "checked" : ""}
        />
        <span class="filter-option-label">${escapeHtml(genre)}</span>
        <span class="filter-option-count">${count}</span>
      </label>
    `;
    })
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
 * Setup price filter inputs
 */
function setupPriceFilter(cleanup: (() => void)[]): void {
  const priceMin = document.getElementById("priceMin") as HTMLInputElement | null;
  const priceMax = document.getElementById("priceMax") as HTMLInputElement | null;

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
  } else if (filterType === "platform-family") {
    togglePlatformFamilyFilter(value);
  } else if (filterType === "genre") {
    toggleGenreFilter(value);
  } else if (filterType === "region") {
    toggleRegionFilter(value);
  } else if (filterType === "era") {
    if (value === "retro" || value === "last-gen" || value === "current") {
      toggleEraFilter(value);
    }
  } else if (filterType === "indie") {
    toggleIndieFilter();
  } else if (filterType === "vr") {
    toggleVrFilter();
  } else if (filterType === "deals") {
    toggleDealsOnly();
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

/**
 * Update match count display
 */
function updateMatchCount(count: number, total: number): void {
  const matchCountEl = document.getElementById("matchCount");
  if (!matchCountEl) return;

  const formatted = count.toLocaleString();
  const isFiltered = count !== total;

  if (isFiltered) {
    matchCountEl.textContent = `${formatted} of ${total.toLocaleString()} games`;
  } else {
    matchCountEl.textContent = `${formatted} games`;
  }

  // Brief highlight animation
  matchCountEl.classList.add("updating");
  setTimeout(() => matchCountEl.classList.remove("updating"), 300);
}

/**
 * Setup quick filter buttons
 */
function setupQuickFilters(cleanup: (() => void)[]): void {
  const container = document.getElementById("quickFilters");
  if (!container) return;

  const handleClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(".quick-filter-btn");
    if (!button) return;

    const preset = button.dataset.quick as "popular" | "new" | "affordable" | undefined;
    if (!preset) return;

    // Toggle active state
    const wasActive = button.classList.contains("active");

    // Clear all active states
    container.querySelectorAll(".quick-filter-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    if (wasActive) {
      // If clicking active button, clear filters
      applyQuickFilter("clear");
    } else {
      // Apply the preset and show active state
      button.classList.add("active");
      applyQuickFilter(preset);
    }
  };

  container.addEventListener("click", handleClick);
  cleanup.push(() => container.removeEventListener("click", handleClick));

  // Subscribe to filter state to clear active buttons when filters change externally
  const filterUnsub = effect(() => {
    const state = filterState.get();
    // Check if any quick filter matches current state
    const buttons = container.querySelectorAll<HTMLButtonElement>(".quick-filter-btn");
    buttons.forEach((btn) => {
      const preset = btn.dataset.quick;
      let isActive = false;

      if (preset === "popular" && state.minRating >= 7) {
        isActive = true;
      } else if (
        preset === "new" &&
        state.yearRange.start &&
        state.yearRange.start >= new Date().getFullYear() - 5
      ) {
        isActive = true;
      } else if (
        preset === "affordable" &&
        state.priceRange.max !== undefined &&
        state.priceRange.max <= 30
      ) {
        isActive = true;
      }

      btn.classList.toggle("active", isActive);
    });
  });
  cleanup.push(filterUnsub);
}
