/**
 * Game Grid Component
 * Renders the masonry grid of game cards with virtualization
 */

import type { GameWithKey } from "../core/types";
import type { ComponentContext } from "./components";
import { mount, debounce, throttle } from "./components";
import { createGameCard, renderSkeletonCards } from "./game-card";
import { filteredGames, isLoading } from "../state/store";
import { effect } from "../core/signals";

// Virtualization settings
const VIRTUAL_THRESHOLD = 100;
const OVERSCAN = 5;
const CARD_HEIGHT = 360;
const CARD_WIDTH = 260;
const GAP = 16;

/**
 * Initialize the game grid
 */
export function initGameGrid(ctx: ComponentContext): void {
  const { element, cleanup } = ctx;
  let lastGames: GameWithKey[] = [];

  // Subscribe to loading state
  const loadingUnsub = isLoading.subscribe((loading) => {
    if (loading) {
      element.innerHTML = "";
      element.appendChild(renderSkeletonCards(12));
    }
  });
  cleanup.push(loadingUnsub);

  // Subscribe to filtered games
  const gamesUnsub = effect(() => {
    const games = filteredGames.get();
    const loading = isLoading.get();

    if (loading) return;

    lastGames = games;

    if (games.length === 0) {
      renderEmptyState(element);
      return;
    }

    if (games.length >= VIRTUAL_THRESHOLD) {
      setupVirtualization(element, games);
    } else {
      renderAllCards(element, games);
    }
  });
  cleanup.push(gamesUnsub);

  // Scroll handler for virtualization
  const handleScroll = throttle(() => {
    if (lastGames.length < VIRTUAL_THRESHOLD) return;
    updateVirtualWindow(element, lastGames);
  }, 50);

  window.addEventListener("scroll", handleScroll, { passive: true });
  cleanup.push(() => window.removeEventListener("scroll", handleScroll));

  // Resize handler
  const handleResize = debounce(() => {
    if (lastGames.length < VIRTUAL_THRESHOLD) return;
    updateVirtualWindow(element, lastGames);
  }, 100);

  window.addEventListener("resize", handleResize, { passive: true });
  cleanup.push(() => window.removeEventListener("resize", handleResize));
}

/**
 * Render empty state
 */
function renderEmptyState(container: HTMLElement): void {
  container.innerHTML = `
    <div class="game-grid-empty">
      <div class="game-grid-empty-icon">🎮</div>
      <h3 class="game-grid-empty-title">No Games Found</h3>
      <p class="game-grid-empty-text">Try adjusting your filters or search to see more games.</p>
    </div>
  `;
}

/**
 * Render all cards (non-virtualized)
 */
function renderAllCards(container: HTMLElement, games: GameWithKey[]): void {
  container.innerHTML = "";
  container.style.paddingTop = "";
  container.style.paddingBottom = "";

  const fragment = document.createDocumentFragment();
  games.forEach((game, index) => {
    const card = createGameCard(game, index);
    // Stagger animation
    card.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Setup virtualization
 */
function setupVirtualization(container: HTMLElement, games: GameWithKey[]): void {
  updateVirtualWindow(container, games);
}

/**
 * Update virtual window based on scroll position
 */
function updateVirtualWindow(container: HTMLElement, games: GameWithKey[]): void {
  const rect = container.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const scrollTop = window.scrollY;
  const containerTop = rect.top + scrollTop;

  // Calculate columns
  const containerWidth = container.clientWidth;
  const columns = Math.max(1, Math.floor((containerWidth + GAP) / (CARD_WIDTH + GAP)));
  const rowHeight = CARD_HEIGHT + GAP;
  const totalRows = Math.ceil(games.length / columns);

  // Calculate visible range
  const startOffset = Math.max(0, scrollTop - containerTop - rowHeight * OVERSCAN);
  const startRow = Math.floor(startOffset / rowHeight);
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;

  const startIndex = Math.max(0, startRow * columns);
  const endIndex = Math.min(games.length, (startRow + visibleRows) * columns);

  // Calculate padding
  const topPadding = startRow * rowHeight;
  const bottomRows = totalRows - startRow - visibleRows;
  const bottomPadding = Math.max(0, bottomRows * rowHeight);

  // Apply padding
  container.style.paddingTop = `${topPadding}px`;
  container.style.paddingBottom = `${bottomPadding}px`;

  // Render visible cards
  const visibleGames = games.slice(startIndex, endIndex);
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();
  visibleGames.forEach((game, i) => {
    fragment.appendChild(createGameCard(game, startIndex + i));
  });

  container.appendChild(fragment);
}

/**
 * Mount the game grid component
 */
export function mountGameGrid(selector: string | HTMLElement): () => void {
  return mount(selector, initGameGrid);
}
