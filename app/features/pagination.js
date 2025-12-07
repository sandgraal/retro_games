/**
 * Pagination and infinite-scroll coordination extracted from archive/app-legacy.js.
 * Pure functions for pagination calculations and markup generation.
 * @module features/pagination
 */

/**
 * Browse mode constants.
 */
export const BROWSE_MODE_INFINITE = "infinite";
export const BROWSE_MODE_PAGED = "paged";

/**
 * Default pagination configuration.
 */
export const DEFAULT_PAGE_SIZE = 24;
export const PAGE_SIZE_CHOICES = [12, 24, 48, 96];
export const PAGINATION_WINDOW_SIZE = 5;

/**
 * Normalize a page size value to a valid choice.
 * @param {number} value - Requested page size
 * @returns {number} Valid page size from choices
 */
export function normalizePageSize(value) {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  const normalized = PAGE_SIZE_CHOICES.find((choice) => choice === value);
  return normalized || DEFAULT_PAGE_SIZE;
}

/**
 * Calculate total pages from total items and page size.
 * @param {number} totalItems - Total number of items
 * @param {number} pageSize - Items per page
 * @returns {number} Total pages (minimum 1)
 */
export function calculateTotalPages(totalItems, pageSize) {
  if (!Number.isFinite(totalItems) || totalItems <= 0) return 1;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

/**
 * Calculate the start and end indices for a page.
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {{start: number, end: number}} Start and end indices (0-indexed)
 */
export function calculatePageIndices(page, pageSize) {
  const safePage = Math.max(1, page || 1);
  const safePageSize = normalizePageSize(pageSize);
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;
  return { start, end };
}

/**
 * Get items for a specific page from an array.
 * @param {Array} items - Source array
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Array} Items for the requested page
 */
export function getPageItems(items, page, pageSize) {
  if (!Array.isArray(items)) return [];
  const { start, end } = calculatePageIndices(page, pageSize);
  return items.slice(start, end);
}

/**
 * Calculate the visible page range for pagination controls.
 * Centers the current page within the window when possible.
 * @param {number} currentPage - Current page (1-indexed)
 * @param {number} totalPages - Total pages
 * @param {number} [windowSize=5] - Number of page buttons to show
 * @returns {{startPage: number, endPage: number}} Visible page range
 */
export function calculatePageWindow(
  currentPage,
  totalPages,
  windowSize = PAGINATION_WINDOW_SIZE
) {
  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));
  let startPage = Math.max(1, safeCurrent - Math.floor(windowSize / 2));
  let endPage = Math.min(totalPages, startPage + windowSize - 1);
  // Adjust start if we're near the end
  startPage = Math.max(1, endPage - windowSize + 1);
  return { startPage, endPage };
}

/**
 * Build pagination markup HTML string.
 * @param {number} currentPage - Current page (1-indexed)
 * @param {number} totalPages - Total pages
 * @param {number} [windowSize=5] - Number of page buttons to show
 * @returns {string} HTML markup for pagination controls
 */
export function buildPaginationMarkup(
  currentPage,
  totalPages,
  windowSize = PAGINATION_WINDOW_SIZE
) {
  if (totalPages <= 1) return "";
  const parts = [];
  const current = Math.max(1, Math.min(currentPage, totalPages));

  // Previous button
  const prevDisabled = current <= 1 ? " disabled" : "";
  parts.push(`<button type="button" data-page="prev"${prevDisabled}>Previous</button>`);

  // Page number buttons
  const { startPage, endPage } = calculatePageWindow(current, totalPages, windowSize);
  for (let page = startPage; page <= endPage; page += 1) {
    const activeClass = page === current ? ' class="is-active"' : "";
    parts.push(
      `<button type="button" data-page="${page}"${activeClass}>${page}</button>`
    );
  }

  // Next button
  const nextDisabled = current >= totalPages ? " disabled" : "";
  parts.push(`<button type="button" data-page="next"${nextDisabled}>Next</button>`);

  return parts.join("");
}

/**
 * Parse pagination click target into new page number.
 * @param {string} target - Click target ("prev", "next", or page number string)
 * @param {number} currentPage - Current page
 * @param {number} totalPages - Total pages
 * @returns {number|null} New page number or null if invalid/unchanged
 */
export function parsePaginationClick(target, currentPage, totalPages) {
  if (!target) return null;

  if (target === "prev") {
    if (currentPage <= 1) return null;
    return currentPage - 1;
  }

  if (target === "next") {
    if (currentPage >= totalPages) return null;
    return currentPage + 1;
  }

  const pageNumber = parseInt(target, 10);
  if (
    Number.isNaN(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > totalPages ||
    pageNumber === currentPage
  ) {
    return null;
  }
  return pageNumber;
}

/**
 * Calculate how many more items can be loaded in infinite scroll mode.
 * @param {number} renderedCount - Currently rendered items
 * @param {number} totalItems - Total available items
 * @param {number} pageSize - Batch size for loading
 * @param {boolean} hasMore - Whether more data is available from server
 * @returns {{moreAvailable: boolean, batchSize: number}}
 */
export function calculateLoadMoreState(renderedCount, totalItems, pageSize, hasMore) {
  const remaining = Math.max(0, totalItems - renderedCount);
  const moreAvailable = remaining > 0 || hasMore;
  // If server has more, load full batch; otherwise load remaining
  const batchSize = hasMore ? pageSize : Math.min(pageSize, remaining || pageSize);
  return { moreAvailable, batchSize };
}

/**
 * Generate "Load more" button text.
 * @param {number} batchSize - Number of items to load
 * @param {boolean} isLoading - Whether currently loading
 * @returns {string} Button text
 */
export function getLoadMoreText(batchSize, isLoading) {
  if (isLoading) return "Loading more games…";
  return `Load ${batchSize} more games`;
}

/**
 * Create pagination state object with computed values.
 * @param {Object} params - Pagination parameters
 * @returns {Object} Complete pagination state
 */
export function createPaginationState({
  pageSize = DEFAULT_PAGE_SIZE,
  currentPage = 1,
  totalItems = 0,
  renderedCount = 0,
} = {}) {
  const normalizedPageSize = normalizePageSize(pageSize);
  const totalPages = calculateTotalPages(totalItems, normalizedPageSize);
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  return {
    pageSize: normalizedPageSize,
    currentPage: safePage,
    totalItems,
    totalPages,
    renderedCount,
  };
}

/**
 * Build a pagination summary string.
 * @param {number} showing - Number of items currently showing
 * @param {number} total - Total number of items
 * @param {boolean} [isLoading=false] - Whether more are loading
 * @returns {string} Summary text
 */
export function buildPaginationSummary(showing, total, isLoading = false) {
  const parts = [`Showing ${showing.toLocaleString()} of ${total.toLocaleString()}`];
  if (isLoading) parts.push("Fetching more…");
  return parts.join(" • ");
}
