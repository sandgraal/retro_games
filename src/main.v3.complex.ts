/**
 * Dragon's Hoard Atlas v3.0
 * Main Application Entry Point
 */

import { effect, batch } from "./core/runtime";
import { initRouter, navigateTo, router } from "./core/router";
import {
  initStorage,
  loadFromStorage,
  saveToStorage,
  STORAGE_STORES,
} from "./core/storage";
import {
  loadGames,
  initState,
  gamesSignal,
  filteredGames,
  selectGame,
  selectedGameKey,
  collectionSignal,
  notesSignal,
  filterState,
} from "./state/store.v3";
import { loadGameData } from "./data/loader.v3";
import {
  registerComponents,
  GameCard,
  renderSkeleton,
  renderEmptyState,
  renderErrorState,
} from "./ui/components.v3";
import { VirtualList } from "./ui/virtual-list";
import { initModal } from "./ui/modal.v3";
import { initFilters } from "./ui/filters.v3";
import { initDashboard } from "./ui/dashboard.v3";
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
  loadingDelay: 150, // ms before showing loading state
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

let virtualList: VirtualList<GameWithKey> | null = null;

function initGrid(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  // Calculate columns based on viewport
  function getColumnCount(): number {
    const width = window.innerWidth;
    if (width < 640) return APP_CONFIG.gridColumns.mobile;
    if (width < 1024) return APP_CONFIG.gridColumns.tablet;
    if (width < 1440) return APP_CONFIG.gridColumns.desktop;
    return APP_CONFIG.gridColumns.wide;
  }

  // Create virtual list
  virtualList = new VirtualList<GameWithKey>({
    container,
    itemHeight: APP_CONFIG.cardHeight,
    columns: getColumnCount(),
    overscan: 2,
    renderItem: (game, element) => {
      // Reuse or create game card
      let card = element.querySelector<GameCard>("game-card");
      if (!card) {
        card = document.createElement("game-card") as GameCard;
        element.appendChild(card);
      }
      card.setGame(game);
    },
    getItemKey: (game) => game.key,
  });

  // Handle resize
  let resizeTimeout: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (virtualList) {
        virtualList.setColumns(getColumnCount());
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
    }
  });
  cleanups.push(disposeEffect);

  cleanups.push(() => {
    if (virtualList) {
      virtualList.destroy();
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

// === Persistence ===

async function loadPersistedData(): Promise<void> {
  try {
    // Load collection
    const collection = await loadFromStorage<Map<string, any>>(
      STORAGE_STORES.COLLECTION,
      "user_collection"
    );
    if (collection) {
      // Merge into state
      // Note: This would need proper deserialization in a real app
    }

    // Load notes
    const notes = await loadFromStorage<Map<string, any>>(
      STORAGE_STORES.PREFERENCES,
      "user_notes"
    );
    if (notes) {
      // Merge into state
    }
  } catch (err) {
    console.warn("Failed to load persisted data:", err);
  }
}

async function persistData(): Promise<void> {
  try {
    const collection = collectionSignal();
    const notes = notesSignal();

    await Promise.all([
      saveToStorage(
        STORAGE_STORES.COLLECTION,
        "user_collection",
        Object.fromEntries(collection)
      ),
      saveToStorage(STORAGE_STORES.PREFERENCES, "user_notes", Object.fromEntries(notes)),
    ]);
  } catch (err) {
    console.warn("Failed to persist data:", err);
  }
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

    // Initialize systems in parallel
    await Promise.all([initStorage(), loadPersistedData()]);

    // Register web components
    registerComponents();

    // Initialize router
    cleanups.push(initRouter());

    // Initialize UI components
    cleanups.push(initFilters(elements.filters));
    cleanups.push(initDashboard(elements.dashboard));
    cleanups.push(initModal());

    // Initialize grid
    cleanups.push(initGrid(elements.grid));

    // Load game data
    const games = await loadGameData();
    loadGames(games);

    // Handle URL state (e.g., shared game links)
    handleInitialRoute();

    // Set up persistence on collection changes
    let persistTimeout: ReturnType<typeof setTimeout>;
    const disposePersist = effect(() => {
      // Subscribe to changes
      collectionSignal();
      notesSignal();

      // Debounce persistence
      clearTimeout(persistTimeout);
      persistTimeout = setTimeout(persistData, 1000);
    });
    cleanups.push(() => {
      clearTimeout(persistTimeout);
      disposePersist();
    });

    // Performance logging
    const loadTime = performance.now() - startTime;
    console.log(`✅ App initialized in ${loadTime.toFixed(0)}ms`);
    console.log(`📊 Loaded ${games.length.toLocaleString()} games`);

    // Expose debug API in development
    if (import.meta.env.DEV) {
      (window as any).__DRAGONS_HOARD__ = {
        version: APP_CONFIG.version,
        games: gamesSignal,
        filtered: filteredGames,
        collection: collectionSignal,
        router,
      };
    }
  } catch (err) {
    console.error("Failed to initialize app:", err);

    try {
      const elements = getElements();
      showError(elements.grid, "Failed to load application. Please refresh the page.");
    } catch {
      // Elements not found, show alert
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

function handleInitialRoute(): void {
  const params = new URLSearchParams(window.location.search);

  // Check for shared game
  const gameKey = params.get("game");
  if (gameKey) {
    selectGame(gameKey);
  }

  // Check for share code
  const shareCode = params.get("share");
  if (shareCode) {
    // TODO: Implement share code import
    console.log("Share code detected:", shareCode);
  }
}

// === Service Worker Registration ===

async function registerServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("ServiceWorker registered:", registration.scope);
    } catch (err) {
      console.warn("ServiceWorker registration failed:", err);
    }
  }
}

// === Bootstrap ===

// Wait for DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initApp();
    registerServiceWorker();
  });
} else {
  initApp();
  registerServiceWorker();
}
