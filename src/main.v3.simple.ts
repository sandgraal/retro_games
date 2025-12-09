/**
 * Dragon's Hoard Atlas v3.0
 * Main Application Entry Point (Simplified)
 */

import { effect } from "./core/runtime";
import {
  loadGames,
  gamesSignal,
  filteredGames,
  filterState,
  setFilter,
  clearFilters,
  availablePlatforms,
  availableGenres,
  collectionStats,
  selectedGame,
  clearSelectedGame,
  getGameStatus,
  setGameStatus,
  getGameNotes,
  setGameNotes,
} from "./state/store.v3.simple";
import { loadGameData } from "./data/loader.v3.simple";
import {
  registerComponents,
  GameCard,
  renderSkeleton,
  renderEmptyState,
  renderErrorState,
} from "./ui/components.v3";
import { VirtualList } from "./ui/virtual-list";
import type { GameWithKey } from "./core/types.v3";

// === Application Configuration ===

const APP_CONFIG = {
  version: "3.0.0",
  name: "Dragon's Hoard Atlas",
  gridColumns: {
    mobile: 2,
    tablet: 3,
    desktop: 4,
    wide: 5,
  },
  cardHeight: 320,
};

// === DOM References ===

interface AppElements {
  header: HTMLElement;
  main: HTMLElement;
  filters: HTMLElement;
  dashboard: HTMLElement;
  grid: HTMLElement;
  footer: HTMLElement;
}

function getElements(): AppElements {
  const header = document.querySelector<HTMLElement>("#app-header");
  const main = document.querySelector<HTMLElement>("#app-main");
  const filters = document.querySelector<HTMLElement>("#filters-container");
  const dashboard = document.querySelector<HTMLElement>("#dashboard-container");
  const grid = document.querySelector<HTMLElement>("#games-grid");
  const footer = document.querySelector<HTMLElement>("#app-footer");

  if (!header || !main || !filters || !dashboard || !grid || !footer) {
    throw new Error("Required DOM elements not found");
  }

  return { header, main, filters, dashboard, grid, footer };
}

// === Virtual Grid ===

let virtualList: VirtualList | null = null;

function initGrid(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  // Create virtual list with render callback
  virtualList = new VirtualList(container, (game: GameWithKey, element: HTMLElement) => {
    // Reuse or create game card
    let card = element.querySelector("game-card") as GameCard | null;
    if (!card) {
      card = document.createElement("game-card") as GameCard;
      element.appendChild(card);
    }
    card.setGame(game);
  });

  // Handle resize
  let resizeTimeout: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (virtualList) {
        virtualList.refresh();
      }
    }, 100);
  };

  window.addEventListener("resize", handleResize);
  cleanups.push(() => {
    clearTimeout(resizeTimeout);
    window.removeEventListener("resize", handleResize);
  });

  // Watch for data changes
  const disposeEffect = effect(() => {
    const games = filteredGames();

    if (virtualList) {
      if (games.length === 0) {
        virtualList.dispose();
        virtualList = null;
        container.innerHTML = "";
        const state = filterState();
        const hasFilters =
          state.search || state.platform || state.genre || state.status !== "all";

        if (hasFilters) {
          container.appendChild(renderEmptyState("Try adjusting your filters"));
        } else if (gamesSignal().length === 0) {
          container.appendChild(renderEmptyState("No games loaded yet"));
        } else {
          container.appendChild(renderEmptyState("No matching games found"));
        }
      } else {
        virtualList.setItems(games);
      }
    } else if (games.length > 0) {
      // Recreate virtual list if it was disposed
      virtualList = new VirtualList(
        container,
        (game: GameWithKey, element: HTMLElement) => {
          let card = element.querySelector("game-card") as GameCard | null;
          if (!card) {
            card = document.createElement("game-card") as GameCard;
            element.appendChild(card);
          }
          card.setGame(game);
        }
      );
      virtualList.setItems(games);
    }
  });
  cleanups.push(disposeEffect);

  cleanups.push(() => {
    if (virtualList) {
      virtualList.dispose();
      virtualList = null;
    }
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// === Loading State ===

function showLoading(container: HTMLElement): void {
  container.innerHTML = "";
  container.appendChild(renderSkeleton(12));
}

function showError(container: HTMLElement, error: string): void {
  container.innerHTML = "";
  container.appendChild(renderErrorState(error));
}

// === Filters Component (inline for simplicity) ===

function initFilters(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  let searchTimeout: ReturnType<typeof setTimeout>;

  function render(): void {
    const state = filterState();
    const platforms = availablePlatforms();
    const genres = availableGenres();
    const filtered = filteredGames();
    const total = gamesSignal().length;

    container.innerHTML = `
      <div class="filters" role="search" aria-label="Filter games">
        <div class="filter-group filter-group--search">
          <label class="filter-label" for="filter-search">Search</label>
          <input 
            type="search" 
            id="filter-search"
            class="filter-input"
            placeholder="Search games..."
            value="${escapeAttr(state.search)}"
          />
        </div>
        
        <div class="filter-group">
          <label class="filter-label" for="filter-platform">Platform</label>
          <select id="filter-platform" class="filter-select">
            <option value="">All Platforms</option>
            ${platforms
              .map(
                (p: string) => `
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
                (g: string) => `
              <option value="${escapeAttr(g)}" ${state.genre === g ? "selected" : ""}>
                ${escapeHtml(g)}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
        
        <div class="filter-actions">
          <button class="filter-btn" id="clear-filters">Clear</button>
          <div class="filter-count">
            <span class="filter-count__number">${filtered.length}</span>
            <span>of ${total}</span>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents(): void {
    // Search input with debounce
    const searchInput = container.querySelector<HTMLInputElement>("#filter-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          setFilter("search", searchInput.value);
        }, 200);
      });
    }

    // Platform select
    const platformSelect = container.querySelector<HTMLSelectElement>("#filter-platform");
    if (platformSelect) {
      platformSelect.addEventListener("change", () => {
        setFilter("platform", platformSelect.value);
      });
    }

    // Genre select
    const genreSelect = container.querySelector<HTMLSelectElement>("#filter-genre");
    if (genreSelect) {
      genreSelect.addEventListener("change", () => {
        setFilter("genre", genreSelect.value);
      });
    }

    // Clear filters
    const clearBtn = container.querySelector<HTMLButtonElement>("#clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearFilters();
      });
    }
  }

  // Watch for state changes
  const disposeEffect = effect(() => {
    filterState();
    availablePlatforms();
    availableGenres();
    filteredGames();
    gamesSignal();
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

// === Dashboard Component (inline for simplicity) ===

function initDashboard(container: HTMLElement): () => void {
  // collectionStats already imported at top level
  const cleanups: Array<() => void> = [];

  function render(): void {
    const stats = collectionStats();

    container.innerHTML = `
      <div class="dashboard">
        <div class="stat-card stat-card--total">
          <div class="stat-card__title">🎮 Total Games</div>
          <div class="stat-card__value">${stats.total.toLocaleString()}</div>
        </div>
        <div class="stat-card stat-card--owned">
          <div class="stat-card__title">✓ Owned</div>
          <div class="stat-card__value">${stats.owned.toLocaleString()}</div>
        </div>
        <div class="stat-card stat-card--wishlist">
          <div class="stat-card__title">★ Wishlist</div>
          <div class="stat-card__value">${stats.wishlist.toLocaleString()}</div>
        </div>
        <div class="stat-card stat-card--backlog">
          <div class="stat-card__title">📚 Backlog</div>
          <div class="stat-card__value">${stats.backlog.toLocaleString()}</div>
        </div>
      </div>
    `;
  }

  const disposeEffect = effect(() => {
    collectionStats();
    render();
  });
  cleanups.push(disposeEffect);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// === Modal Component (inline for simplicity) ===

function initModal(): () => void {
  // All needed functions are imported at top level:
  // selectedGame, clearSelectedGame, getGameStatus, setGameStatus, getGameNotes, setGameNotes

  const cleanups: Array<() => void> = [];

  // Create modal elements
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  cleanups.push(() => {
    backdrop.remove();
    modal.remove();
  });

  // Close modal handler
  function close(): void {
    backdrop.classList.remove("open");
    modal.classList.remove("open");
    document.body.style.overflow = "";
    clearSelectedGame();
  }

  // Event handlers
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Watch for selected game
  const disposeEffect = effect(() => {
    const game = selectedGame();

    if (!game) {
      backdrop.classList.remove("open");
      modal.classList.remove("open");
      return;
    }

    const status = getGameStatus(game.key);
    const notes = getGameNotes(game.key);
    const rating = parseFloat(String(game.rating));
    const hasRating = !isNaN(rating);

    modal.innerHTML = `
      <div class="modal__header">
        <h2>${escapeHtml(game.game_name)}</h2>
        <button class="modal__close" aria-label="Close">×</button>
      </div>
      <div class="modal__content">
        <div class="game-detail">
          <div class="game-detail__cover">
            ${
              game.cover
                ? `<img src="${escapeAttr(game.cover)}" alt="${escapeAttr(game.game_name)}" />`
                : `<div class="game-detail__placeholder">${game.game_name.slice(0, 2).toUpperCase()}</div>`
            }
          </div>
          <div class="game-detail__info">
            <div class="game-detail__meta">
              <span>🎮 ${escapeHtml(game.platform)}</span>
              ${game.genre ? `<span>📂 ${escapeHtml(game.genre)}</span>` : ""}
              ${game.release_year ? `<span>📅 ${game.release_year}</span>` : ""}
              ${hasRating ? `<span>⭐ ${rating.toFixed(1)}</span>` : ""}
            </div>
            
            <div class="status-selector">
              <button class="status-btn ${status === "none" ? "active" : ""}" data-status="none">✕ Not in Collection</button>
              <button class="status-btn owned ${status === "owned" ? "active" : ""}" data-status="owned">✓ Owned</button>
              <button class="status-btn wishlist ${status === "wishlist" ? "active" : ""}" data-status="wishlist">★ Wishlist</button>
              <button class="status-btn backlog ${status === "backlog" ? "active" : ""}" data-status="backlog">📚 Backlog</button>
              <button class="status-btn trade ${status === "trade" ? "active" : ""}" data-status="trade">↔ Trade</button>
            </div>
            
            <div class="notes-section">
              <h4>Notes</h4>
              <textarea class="notes-textarea" placeholder="Add personal notes...">${escapeHtml(notes || "")}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind close button
    modal.querySelector(".modal__close")?.addEventListener("click", close);

    // Bind status buttons
    modal.querySelectorAll<HTMLButtonElement>(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const newStatus = btn.dataset.status as any;
        setGameStatus(game.key, newStatus);

        modal.querySelectorAll<HTMLButtonElement>(".status-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.status === newStatus);
        });
      });
    });

    // Bind notes textarea
    let notesTimeout: ReturnType<typeof setTimeout>;
    const textarea = modal.querySelector<HTMLTextAreaElement>(".notes-textarea");
    if (textarea) {
      textarea.addEventListener("input", () => {
        clearTimeout(notesTimeout);
        notesTimeout = setTimeout(() => {
          setGameNotes(game.key, textarea.value || undefined);
        }, 500);
      });
    }

    backdrop.classList.add("open");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  });
  cleanups.push(disposeEffect);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// === Utility Functions ===

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// === Main Application ===

async function initApp(): Promise<void> {
  const startTime = performance.now();

  console.log(
    `%c🐉 ${APP_CONFIG.name} v${APP_CONFIG.version}`,
    "font-size: 1.5em; font-weight: bold;"
  );

  const cleanups: Array<() => void> = [];

  try {
    // Get DOM elements
    const elements = getElements();

    // Show loading state
    showLoading(elements.grid);

    // Register web components
    registerComponents();

    // Initialize UI components
    cleanups.push(initFilters(elements.filters));
    cleanups.push(initDashboard(elements.dashboard));
    cleanups.push(initModal());

    // Initialize grid
    cleanups.push(initGrid(elements.grid));

    // Load game data
    const games = await loadGameData();
    loadGames(games);

    // Performance logging
    const loadTime = performance.now() - startTime;
    console.log(`✅ App initialized in ${loadTime.toFixed(0)}ms`);
    console.log(`📊 Loaded ${games.length.toLocaleString()} games`);
  } catch (err) {
    console.error("Failed to initialize app:", err);

    try {
      const elements = getElements();
      showError(elements.grid, "Failed to load application. Please refresh the page.");
    } catch {
      alert("Failed to load application. Please refresh the page.");
    }
  }

  // Global cleanup on page unload
  window.addEventListener("beforeunload", () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  });
}

// === Bootstrap ===

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
