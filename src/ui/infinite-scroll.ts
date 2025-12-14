/**
 * Infinite Scroll with URL State Sync
 * Progressive loading and URL-based pagination state
 */

import { createSignal, effect } from "../core/signals";
import { filteredGames } from "../state/store";
import type { GameWithKey } from "../core/types";

// Configuration
const PAGE_SIZE = 48; // Games per page
const LOAD_THRESHOLD = 300; // Pixels from bottom to trigger load

// Pagination state
export const currentPage = createSignal(1);
export const isLoadingMore = createSignal(false);
export const hasMoreGames = createSignal(true);

/**
 * Get paginated games based on current page
 */
export function getPaginatedGames(): GameWithKey[] {
  const allGames = filteredGames.get();
  const page = currentPage.get();
  const endIndex = page * PAGE_SIZE;

  return allGames.slice(0, endIndex);
}

/**
 * Load more games (next page)
 */
export function loadMoreGames(): void {
  if (isLoadingMore.get() || !hasMoreGames.get()) return;

  isLoadingMore.set(true);
  const allGames = filteredGames.get();
  const nextPage = currentPage.get() + 1;
  const endIndex = nextPage * PAGE_SIZE;

  // Simulate async load (for smooth UX)
  requestAnimationFrame(() => {
    currentPage.set(nextPage);
    hasMoreGames.set(endIndex < allGames.length);
    isLoadingMore.set(false);

    // Update URL with page
    syncPageToUrl(nextPage);
  });
}

/**
 * Reset pagination (when filters change)
 */
export function resetPagination(): void {
  currentPage.set(1);
  hasMoreGames.set(filteredGames.get().length > PAGE_SIZE);
  syncPageToUrl(1);
}

/**
 * Sync page number to URL
 */
function syncPageToUrl(page: number): void {
  const url = new URL(window.location.href);

  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }

  // Update URL without reload
  window.history.replaceState({}, "", url.toString());
}

/**
 * Read page from URL on init
 */
function readPageFromUrl(): number {
  const url = new URL(window.location.href);
  const pageParam = url.searchParams.get("page");
  return pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
}

/**
 * Initialize infinite scroll behavior
 */
export function initInfiniteScroll(containerSelector: string = "#gameGrid"): () => void {
  const container = document.querySelector<HTMLElement>(containerSelector);
  if (!container) {
    console.warn("Infinite scroll: container not found");
    return () => {};
  }

  // Read initial page from URL
  const initialPage = readPageFromUrl();
  if (initialPage > 1) {
    currentPage.set(initialPage);
  }

  // Update hasMoreGames when filtered games change
  let prevGameCount = filteredGames.get().length;
  const filterUnsub = effect(() => {
    const total = filteredGames.get().length;
    const page = currentPage.get();
    hasMoreGames.set(page * PAGE_SIZE < total);

    // Reset to page 1 when filters change (detect via game count change)
    if (total !== prevGameCount && page > 1 && initialPage === 1) {
      resetPagination();
    }
    prevGameCount = total;
  });

  // Scroll handler for loading more
  let ticking = false;
  const handleScroll = (): void => {
    if (ticking) return;

    ticking = true;
    requestAnimationFrame(() => {
      const { scrollY, innerHeight } = window;
      const docHeight = document.documentElement.scrollHeight;

      // Check if near bottom
      if (docHeight - scrollY - innerHeight < LOAD_THRESHOLD) {
        loadMoreGames();
      }

      ticking = false;
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true });

  // Create loading indicator
  const loadingIndicator = createLoadingIndicator();
  container.parentElement?.appendChild(loadingIndicator);

  // Update loading indicator visibility
  const loadingUnsub = isLoadingMore.subscribe((loading) => {
    loadingIndicator.style.display = loading ? "flex" : "none";
  });

  // Update "load more" visibility based on hasMore
  const hasMoreUnsub = hasMoreGames.subscribe((hasMore) => {
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.style.display = hasMore ? "block" : "none";
    }
  });

  // Cleanup
  return () => {
    window.removeEventListener("scroll", handleScroll);
    filterUnsub();
    loadingUnsub();
    hasMoreUnsub();
    loadingIndicator.remove();
  };
}

/**
 * Create loading indicator element
 */
function createLoadingIndicator(): HTMLElement {
  const indicator = document.createElement("div");
  indicator.className = "infinite-scroll-loading";
  indicator.innerHTML = `
    <div class="infinite-scroll-spinner"></div>
    <span>Loading more games...</span>
  `;
  indicator.style.display = "none";
  return indicator;
}

/**
 * Create a "Load More" button (alternative to scroll-based loading)
 */
export function createLoadMoreButton(): HTMLElement {
  const button = document.createElement("button");
  button.id = "loadMoreBtn";
  button.type = "button";
  button.className = "load-more-btn";
  button.innerHTML = `
    <span>Load More Games</span>
    <span class="load-more-count" id="loadMoreCount"></span>
  `;

  button.addEventListener("click", () => {
    loadMoreGames();
  });

  // Update count
  const updateCount = (): void => {
    const total = filteredGames.get().length;
    const shown = currentPage.get() * PAGE_SIZE;
    const remaining = Math.max(0, total - shown);
    const countEl = button.querySelector("#loadMoreCount");
    if (countEl) {
      countEl.textContent = remaining > 0 ? `(${remaining} more)` : "";
    }
    button.style.display = remaining > 0 ? "flex" : "none";
  };

  // Subscribe to changes
  effect(() => {
    filteredGames.get();
    currentPage.get();
    updateCount();
  });

  return button;
}

/**
 * Get current pagination info
 */
export function getPaginationInfo(): {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  hasMore: boolean;
} {
  const total = filteredGames.get().length;
  const page = currentPage.get();
  const shown = Math.min(page * PAGE_SIZE, total);

  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    shown,
    hasMore: hasMoreGames.get(),
  };
}
