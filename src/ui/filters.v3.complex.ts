/**
 * Filters Component v3.0
 * URL-synced filtering with debounced search
 */

import { effect, batch } from "../core/runtime";
import {
  filterState,
  setFilter,
  clearFilters,
  availablePlatforms,
  availableGenres,
  filteredGames,
  gamesSignal,
} from "../state/store.v3";
import type { FilterState, CollectionStatus } from "../core/types.v3";
import { escapeHtml, escapeAttr } from "./components.v3";

const FILTERS_STYLES = `
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 24px;
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 150px;
  }
  
  .filter-group--search {
    flex: 2;
    min-width: 200px;
  }
  
  .filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .filter-input,
  .filter-select {
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  
  .filter-input:focus,
  .filter-select:focus {
    outline: none;
    border-color: var(--accent-primary, #00d4ff);
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }
  
  .filter-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .filter-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }
  
  .filter-select option {
    background: #1a1a2e;
    color: white;
  }
  
  .filter-actions {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  
  .filter-btn {
    padding: 10px 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .filter-btn:focus-visible {
    outline: 2px solid var(--accent-primary, #00d4ff);
    outline-offset: 2px;
  }
  
  .filter-btn--primary {
    background: var(--accent-primary, #00d4ff);
    border-color: transparent;
    color: #000;
  }
  
  .filter-btn--primary:hover {
    background: #00b8e6;
    color: #000;
  }
  
  .filter-count {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .filter-count__number {
    font-weight: 600;
    color: var(--accent-primary, #00d4ff);
  }
  
  .sort-group {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  
  .sort-direction {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .sort-direction:hover {
    background: rgba(0, 0, 0, 0.4);
    color: white;
  }
  
  .active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  
  .filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 20px;
    font-size: 0.75rem;
    color: #00d4ff;
  }
  
  .filter-tag__remove {
    background: none;
    border: none;
    padding: 0;
    font-size: 1rem;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .filter-tag__remove:hover {
    opacity: 1;
  }
`;

const SORT_OPTIONS: Array<{ value: FilterState["sortBy"]; label: string }> = [
  { value: "game_name", label: "Title" },
  { value: "platform", label: "Platform" },
  { value: "release_year", label: "Year" },
  { value: "rating", label: "Rating" },
  { value: "genre", label: "Genre" },
];

const STATUS_OPTIONS: Array<{ value: CollectionStatus | "all"; label: string }> = [
  { value: "all", label: "All Games" },
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
  { value: "backlog", label: "Backlog" },
  { value: "trade", label: "For Trade" },
  { value: "none", label: "Not in Collection" },
];

export function initFilters(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  // Inject styles
  const style = document.createElement("style");
  style.textContent = FILTERS_STYLES;
  document.head.appendChild(style);
  cleanups.push(() => style.remove());

  // Create filters container
  const filtersEl = document.createElement("div");
  filtersEl.className = "filters";
  filtersEl.setAttribute("role", "search");
  filtersEl.setAttribute("aria-label", "Filter games");

  container.appendChild(filtersEl);
  cleanups.push(() => filtersEl.remove());

  // Render initial state
  let searchTimeout: ReturnType<typeof setTimeout>;

  function render(): void {
    const state = filterState();
    const platforms = availablePlatforms();
    const genres = availableGenres();
    const filtered = filteredGames();
    const total = gamesSignal().length;

    filtersEl.innerHTML = `
      <div class="filter-group filter-group--search">
        <label class="filter-label" for="filter-search">Search</label>
        <input 
          type="search" 
          id="filter-search"
          class="filter-input"
          placeholder="Search games..."
          value="${escapeAttr(state.search)}"
          aria-label="Search games by title"
        />
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="filter-platform">Platform</label>
        <select id="filter-platform" class="filter-select">
          <option value="">All Platforms</option>
          ${platforms
            .map(
              (p) => `
            <option value="${escapeAttr(p)}" ${state.platform === p ? "selected" : ""}>
              ${escapeHtml(p)}
            </option>
          `
            )
            .join("")}
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="filter-genre">Genre</label>
        <select id="filter-genre" class="filter-select">
          <option value="">All Genres</option>
          ${genres
            .map(
              (g) => `
            <option value="${escapeAttr(g)}" ${state.genre === g ? "selected" : ""}>
              ${escapeHtml(g)}
            </option>
          `
            )
            .join("")}
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="filter-status">Collection</label>
        <select id="filter-status" class="filter-select">
          ${STATUS_OPTIONS.map(
            (opt) => `
            <option value="${opt.value}" ${state.status === opt.value ? "selected" : ""}>
              ${opt.label}
            </option>
          `
          ).join("")}
        </select>
      </div>
      
      <div class="filter-group sort-group">
        <div class="filter-group" style="min-width: auto;">
          <label class="filter-label" for="filter-sort">Sort By</label>
          <select id="filter-sort" class="filter-select">
            ${SORT_OPTIONS.map(
              (opt) => `
              <option value="${opt.value}" ${state.sortBy === opt.value ? "selected" : ""}>
                ${opt.label}
              </option>
            `
            ).join("")}
          </select>
        </div>
        <button 
          class="sort-direction" 
          aria-label="Sort ${state.sortDirection === "asc" ? "descending" : "ascending"}"
          title="Sort ${state.sortDirection === "asc" ? "descending" : "ascending"}"
        >
          ${state.sortDirection === "asc" ? "↑" : "↓"}
        </button>
      </div>
      
      <div class="filter-actions">
        <button class="filter-btn" id="clear-filters">Clear</button>
        <div class="filter-count">
          <span class="filter-count__number">${filtered.length}</span>
          <span>of ${total}</span>
        </div>
      </div>
    `;

    bindEvents();
    renderActiveTags(state);
  }

  function renderActiveTags(state: FilterState): void {
    const existingTags = filtersEl.querySelector(".active-filters");
    if (existingTags) existingTags.remove();

    const activeTags: Array<{ key: keyof FilterState; value: string; label: string }> =
      [];

    if (state.search) {
      activeTags.push({ key: "search", value: state.search, label: `"${state.search}"` });
    }
    if (state.platform) {
      activeTags.push({ key: "platform", value: state.platform, label: state.platform });
    }
    if (state.genre) {
      activeTags.push({ key: "genre", value: state.genre, label: state.genre });
    }
    if (state.status !== "all") {
      const statusLabel =
        STATUS_OPTIONS.find((o) => o.value === state.status)?.label || state.status;
      activeTags.push({ key: "status", value: state.status, label: statusLabel });
    }

    if (activeTags.length === 0) return;

    const tagsEl = document.createElement("div");
    tagsEl.className = "active-filters";
    tagsEl.innerHTML = activeTags
      .map(
        (tag) => `
      <span class="filter-tag">
        ${escapeHtml(tag.label)}
        <button class="filter-tag__remove" data-key="${tag.key}" aria-label="Remove ${tag.label} filter">×</button>
      </span>
    `
      )
      .join("");

    filtersEl.appendChild(tagsEl);

    // Bind tag removal
    tagsEl.querySelectorAll<HTMLButtonElement>(".filter-tag__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key as keyof FilterState;
        if (key === "status") {
          setFilter("status", "all");
        } else if (key === "search" || key === "platform" || key === "genre") {
          setFilter(key, "");
        }
      });
    });
  }

  function bindEvents(): void {
    // Search input with debounce
    const searchInput = filtersEl.querySelector<HTMLInputElement>("#filter-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          setFilter("search", searchInput.value);
        }, 200);
      });
    }

    // Platform select
    const platformSelect = filtersEl.querySelector<HTMLSelectElement>("#filter-platform");
    if (platformSelect) {
      platformSelect.addEventListener("change", () => {
        setFilter("platform", platformSelect.value);
      });
    }

    // Genre select
    const genreSelect = filtersEl.querySelector<HTMLSelectElement>("#filter-genre");
    if (genreSelect) {
      genreSelect.addEventListener("change", () => {
        setFilter("genre", genreSelect.value);
      });
    }

    // Status select
    const statusSelect = filtersEl.querySelector<HTMLSelectElement>("#filter-status");
    if (statusSelect) {
      statusSelect.addEventListener("change", () => {
        setFilter("status", statusSelect.value as CollectionStatus | "all");
      });
    }

    // Sort select
    const sortSelect = filtersEl.querySelector<HTMLSelectElement>("#filter-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        setFilter("sortBy", sortSelect.value as FilterState["sortBy"]);
      });
    }

    // Sort direction
    const sortDirection = filtersEl.querySelector<HTMLButtonElement>(".sort-direction");
    if (sortDirection) {
      sortDirection.addEventListener("click", () => {
        const current = filterState().sortDirection;
        setFilter("sortDirection", current === "asc" ? "desc" : "asc");
      });
    }

    // Clear filters
    const clearBtn = filtersEl.querySelector<HTMLButtonElement>("#clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearFilters();
      });
    }
  }

  // Watch for state changes and re-render
  const disposeEffect = effect(() => {
    // Subscribe to all relevant signals
    filterState();
    availablePlatforms();
    availableGenres();
    filteredGames();
    gamesSignal();

    // Re-render
    render();
  });
  cleanups.push(disposeEffect);

  return () => {
    clearTimeout(searchTimeout);
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
