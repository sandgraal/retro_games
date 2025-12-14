/**
 * Recently Viewed Games
 * Track and display games the user has recently viewed
 */

import { createSignal } from "../core/signals";
import { gamesSignal, openGameModal } from "../state/store";
import type { GameWithKey, GameKey } from "../core/types";

// Storage key
const RECENTLY_VIEWED_KEY = "dragonshoard_recently_viewed";

// Configuration
const MAX_RECENTLY_VIEWED = 20;

// Interface for viewed game entry
interface ViewedEntry {
  key: GameKey;
  viewedAt: number;
}

// Signal for recently viewed games
export const recentlyViewedSignal = createSignal<ViewedEntry[]>([]);

/**
 * Load recently viewed from localStorage
 */
export function loadRecentlyViewed(): void {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (stored) {
      const entries = JSON.parse(stored) as ViewedEntry[];
      recentlyViewedSignal.set(entries);
    }
  } catch (error) {
    console.warn("Failed to load recently viewed:", error);
  }
}

/**
 * Save recently viewed to localStorage
 */
function saveRecentlyViewed(): void {
  try {
    const entries = recentlyViewedSignal.get();
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("Failed to save recently viewed:", error);
  }
}

/**
 * Add a game to recently viewed
 */
export function addToRecentlyViewed(gameKey: GameKey): void {
  const current = recentlyViewedSignal.get();

  // Remove if already exists
  const filtered = current.filter((entry) => entry.key !== gameKey);

  // Add to front
  const updated = [{ key: gameKey, viewedAt: Date.now() }, ...filtered].slice(
    0,
    MAX_RECENTLY_VIEWED
  );

  recentlyViewedSignal.set(updated);
  saveRecentlyViewed();
}

/**
 * Clear recently viewed history
 */
export function clearRecentlyViewed(): void {
  recentlyViewedSignal.set([]);
  localStorage.removeItem(RECENTLY_VIEWED_KEY);
}

/**
 * Get recently viewed games with full data
 */
export function getRecentlyViewedGames(): GameWithKey[] {
  const entries = recentlyViewedSignal.get();
  const allGames = gamesSignal.get();
  const gamesMap = new Map(allGames.map((g) => [g.key, g]));

  return entries
    .map((entry) => gamesMap.get(entry.key))
    .filter((g): g is GameWithKey => g !== undefined);
}

/**
 * Render recently viewed section
 */
export function renderRecentlyViewed(containerId: string): () => void {
  const container = document.getElementById(containerId);
  if (!container) return () => {};

  const render = (): void => {
    const games = getRecentlyViewedGames();

    if (games.length === 0) {
      container.innerHTML = `
        <div class="recently-viewed recently-viewed--empty">
          <span class="recently-viewed__empty-icon">👀</span>
          <span class="recently-viewed__empty-text">No recently viewed games</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="recently-viewed">
        <div class="recently-viewed__header">
          <h4 class="recently-viewed__title">
            <span aria-hidden="true">👀</span> Recently Viewed
          </h4>
          <button type="button" class="recently-viewed__clear" id="clearRecentlyViewed" title="Clear history">
            Clear
          </button>
        </div>
        <div class="recently-viewed__list">
          ${games
            .slice(0, 10)
            .map(
              (game) => `
            <button
              type="button"
              class="recently-viewed__item"
              data-game-key="${game.key}"
              title="${game.game_name}"
            >
              <div class="recently-viewed__cover">
                ${
                  game.cover
                    ? `<img src="${game.cover}" alt="${game.game_name} cover" loading="lazy" decoding="async" />`
                    : `<span class="recently-viewed__cover-placeholder">🎮</span>`
                }
              </div>
              <div class="recently-viewed__info">
                <span class="recently-viewed__name">${game.game_name}</span>
                <span class="recently-viewed__platform">${game.platform}</span>
              </div>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    // Add click handlers
    container.querySelectorAll("[data-game-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameKey = (btn as HTMLElement).dataset.gameKey;
        if (gameKey) {
          const game = gamesSignal.get().find((g) => g.key === gameKey);
          if (game) {
            openGameModal(game);
          }
        }
      });
    });

    // Clear button handler
    const clearBtn = container.querySelector("#clearRecentlyViewed");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearRecentlyViewed();
        render();
      });
    }
  };

  // Initial render
  render();

  // Re-render on changes
  const unsub = recentlyViewedSignal.subscribe(render);

  return unsub;
}

/**
 * Initialize recently viewed tracking
 * Call this after mounting the modal
 */
export function initRecentlyViewed(): () => void {
  // Load from storage
  loadRecentlyViewed();

  // No automatic cleanup needed - modal handles tracking
  return () => {};
}

/**
 * Hook to track game views - call when modal opens
 */
export function trackGameView(game: GameWithKey): void {
  addToRecentlyViewed(game.key);
}
