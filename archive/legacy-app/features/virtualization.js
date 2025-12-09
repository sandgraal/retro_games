/**
 * Virtual scrolling calculations extracted from archive/app-legacy.js.
 * Pure functions for computing virtual ranges and metrics.
 * @module features/virtualization
 */

// === Constants ===
export const VIRTUALIZE_MIN_ITEMS = 80;
export const VIRTUAL_DEFAULT_CARD_HEIGHT = 360;
export const VIRTUAL_OVERSCAN_ROWS = 2;
export const VIRTUAL_SCROLL_THROTTLE_MS = 80;
export const VIRTUAL_DEFAULT_CARD_WIDTH = 260;

// === State Factory ===

/**
 * Create a fresh virtualization state object.
 * @returns {VirtualizationState}
 */
export function createVirtualizationState() {
  return {
    enabled: true,
    active: false,
    sourceData: [],
    container: null,
    visibleStart: 0,
    visibleEnd: 0,
    rowHeight: 0,
    columns: 1,
    topPadding: 0,
    bottomPadding: 0,
    scrollHandler: null,
    resizeHandler: null,
    pendingAnimationFrame: null,
    pendingMeasureFrame: null,
    gridGap: 0,
    lastRenderLength: 0,
    datasetOffset: 0,
  };
}

/**
 * Reset virtualization state to defaults (in-place mutation).
 * @param {VirtualizationState} state
 * @returns {VirtualizationState}
 */
export function resetVirtualizationState(state) {
  if (!state || typeof state !== "object") return createVirtualizationState();
  state.active = false;
  state.sourceData = [];
  state.container = null;
  state.visibleStart = 0;
  state.visibleEnd = 0;
  state.topPadding = 0;
  state.bottomPadding = 0;
  state.scrollHandler = null;
  state.resizeHandler = null;
  state.pendingAnimationFrame = null;
  state.pendingMeasureFrame = null;
  state.lastRenderLength = 0;
  state.datasetOffset = 0;
  return state;
}

// === Threshold Checks ===

/**
 * Check if virtualization should be used for a dataset.
 * @param {number} itemCount - Number of items in dataset
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - Whether virtualization is enabled
 * @param {number} [options.minItems=VIRTUALIZE_MIN_ITEMS] - Minimum items to trigger virtualization
 * @returns {boolean}
 */
export function shouldVirtualize(itemCount, options = {}) {
  const { enabled = true, minItems = VIRTUALIZE_MIN_ITEMS } = options;
  if (!enabled) return false;
  if (!Number.isFinite(itemCount) || itemCount < 0) return false;
  return itemCount >= minItems;
}

// === Column Estimation ===

/**
 * Estimate number of columns in a grid based on container and card width.
 * @param {number} containerWidth - Width of container in pixels
 * @param {number} [cardWidth=VIRTUAL_DEFAULT_CARD_WIDTH] - Width of each card
 * @param {number} [gap=0] - Gap between cards
 * @returns {number} Estimated column count (minimum 1)
 */
export function estimateColumnCount(
  containerWidth,
  cardWidth = VIRTUAL_DEFAULT_CARD_WIDTH,
  gap = 0
) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) return 1;
  const safeGap = Number.isFinite(gap) ? gap : 0;
  return Math.max(1, Math.floor((containerWidth + safeGap) / (cardWidth + safeGap)));
}

// === Virtual Metrics ===

/**
 * @typedef {Object} VirtualMetrics
 * @property {number} rowHeight - Height of each row in pixels
 * @property {number} columns - Number of columns in grid
 * @property {number} gap - Gap between items
 */

/**
 * Build metrics object from state or defaults.
 * @param {Object} [options]
 * @param {number} [options.rowHeight]
 * @param {number} [options.columns]
 * @param {number} [options.gap]
 * @param {number} [options.containerWidth]
 * @returns {VirtualMetrics}
 */
export function buildVirtualMetrics(options = {}) {
  const rowHeight =
    Number.isFinite(options.rowHeight) && options.rowHeight > 0
      ? options.rowHeight
      : VIRTUAL_DEFAULT_CARD_HEIGHT;

  let columns = 1;
  if (Number.isFinite(options.columns) && options.columns > 0) {
    columns = options.columns;
  } else if (Number.isFinite(options.containerWidth) && options.containerWidth > 0) {
    columns = estimateColumnCount(
      options.containerWidth,
      VIRTUAL_DEFAULT_CARD_WIDTH,
      options.gap || 0
    );
  }

  const gap = Number.isFinite(options.gap) && options.gap >= 0 ? options.gap : 0;

  return { rowHeight, columns, gap };
}

// === Range Calculation ===

/**
 * @typedef {Object} VirtualRange
 * @property {number} start - Start index in dataset
 * @property {number} end - End index in dataset (exclusive)
 * @property {number} topPadding - Top spacer height in pixels
 * @property {number} bottomPadding - Bottom spacer height in pixels
 */

/**
 * Compute the visible range of items for virtual scrolling.
 * @param {Object} params
 * @param {number} params.dataLength - Total number of items
 * @param {number} params.scrollTop - Current scroll position
 * @param {number} params.containerTop - Top position of container
 * @param {number} params.viewportHeight - Height of viewport
 * @param {VirtualMetrics} params.metrics - Row height, columns, gap
 * @param {number} [params.overscanRows=VIRTUAL_OVERSCAN_ROWS] - Extra rows to render
 * @returns {VirtualRange}
 */
export function computeVirtualRange(params) {
  const {
    dataLength,
    scrollTop = 0,
    containerTop = 0,
    viewportHeight,
    metrics,
    overscanRows = VIRTUAL_OVERSCAN_ROWS,
  } = params;

  // Handle empty or invalid data
  if (!Number.isFinite(dataLength) || dataLength <= 0) {
    return { start: 0, end: 0, topPadding: 0, bottomPadding: 0 };
  }

  const { rowHeight, columns } = metrics || buildVirtualMetrics();
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0
      ? viewportHeight
      : rowHeight * 6;
  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  const safeContainerTop = Number.isFinite(containerTop) ? containerTop : 0;

  // Calculate which row is at top of viewport
  const startOffset = Math.max(
    0,
    safeScrollTop - safeContainerTop - rowHeight * overscanRows
  );
  const startRow = Math.max(0, Math.floor(startOffset / rowHeight));

  // Calculate how many rows fit in viewport plus overscan
  const rowsInView = Math.ceil(safeViewportHeight / rowHeight) + overscanRows * 2;

  // Convert rows to item indices
  const startIndex = Math.min(dataLength, startRow * columns);
  const endIndex = Math.min(
    dataLength,
    Math.max(startIndex + rowsInView * columns, startIndex + columns)
  );

  // Calculate spacer heights
  const totalRows = Math.ceil(dataLength / columns);
  const endRow = Math.ceil(endIndex / columns);
  const topPadding = startRow * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRow) * rowHeight);

  return { start: startIndex, end: endIndex, topPadding, bottomPadding };
}

/**
 * Check if a range has changed from previous values.
 * @param {VirtualRange} newRange
 * @param {VirtualRange} oldRange
 * @returns {boolean}
 */
export function hasRangeChanged(newRange, oldRange) {
  if (!newRange || !oldRange) return true;
  return newRange.start !== oldRange.start || newRange.end !== oldRange.end;
}

// === Spacer Helpers ===

/**
 * Build spacer div HTML for virtualization.
 * @param {number} height - Height in pixels
 * @param {string} [className='virtual-spacer'] - CSS class
 * @returns {string} HTML string
 */
export function buildSpacerHtml(height, className = "virtual-spacer") {
  const safeHeight = Math.max(0, Math.floor(height || 0));
  return `<div class="${className}" style="height:${safeHeight}px"></div>`;
}

/**
 * Build both top and bottom spacers.
 * @param {number} topPadding
 * @param {number} bottomPadding
 * @returns {{top: string, bottom: string}}
 */
export function buildSpacers(topPadding, bottomPadding) {
  return {
    top: buildSpacerHtml(topPadding),
    bottom: buildSpacerHtml(bottomPadding),
  };
}

// === Scroll Position Helpers ===

/**
 * Calculate scroll offset needed to bring an item into view.
 * @param {number} itemIndex - Index of target item
 * @param {number} columns - Number of columns in grid
 * @param {number} rowHeight - Height of each row
 * @param {number} currentScroll - Current scroll position
 * @param {number} containerTop - Top position of container
 * @param {number} viewportHeight - Height of viewport
 * @returns {number|null} New scroll position or null if already in view
 */
export function calculateScrollToItem(
  itemIndex,
  columns,
  rowHeight,
  currentScroll,
  containerTop,
  viewportHeight
) {
  if (!Number.isFinite(itemIndex) || itemIndex < 0) return null;
  if (!Number.isFinite(columns) || columns < 1) return null;
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) return null;

  const row = Math.floor(itemIndex / columns);
  const itemTop = containerTop + row * rowHeight;
  const itemBottom = itemTop + rowHeight;
  const viewportTop = currentScroll;
  const viewportBottom = currentScroll + viewportHeight;

  // Check if already fully in view
  if (itemTop >= viewportTop && itemBottom <= viewportBottom) {
    return null;
  }

  // Scroll to put item at top of viewport with some margin
  if (itemTop < viewportTop) {
    return Math.max(0, itemTop - rowHeight * 0.5);
  }

  // Scroll to put item at bottom of viewport
  return Math.max(0, itemBottom - viewportHeight + rowHeight * 0.5);
}

// === Prefetch Helpers ===

/**
 * Determine if more data should be prefetched based on scroll position.
 * @param {number} visibleEndIndex - Last visible item index
 * @param {number} totalLoaded - Total items currently loaded
 * @param {number} totalAvailable - Total items available (or null if unknown)
 * @param {Object} [options]
 * @param {number} [options.threshold=0.8] - Prefetch when this fraction is visible
 * @returns {boolean}
 */
export function shouldPrefetch(
  visibleEndIndex,
  totalLoaded,
  totalAvailable,
  options = {}
) {
  const { threshold = 0.8 } = options;
  if (!Number.isFinite(visibleEndIndex) || visibleEndIndex < 0) return false;
  if (!Number.isFinite(totalLoaded) || totalLoaded <= 0) return false;

  // If we know total and have loaded all, no prefetch needed
  if (Number.isFinite(totalAvailable) && totalLoaded >= totalAvailable) return false;

  // Prefetch if we've scrolled past threshold of loaded data
  return visibleEndIndex >= totalLoaded * threshold;
}

/**
 * Calculate how many more items to fetch.
 * @param {number} currentTotal - Currently loaded count
 * @param {number} pageSize - Fetch page size
 * @param {number} [maxTotal] - Maximum total to load
 * @returns {number}
 */
export function calculatePrefetchCount(currentTotal, pageSize, maxTotal) {
  if (!Number.isFinite(currentTotal) || currentTotal < 0) return pageSize;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 0;

  if (Number.isFinite(maxTotal) && maxTotal > 0) {
    const remaining = maxTotal - currentTotal;
    return Math.min(pageSize, Math.max(0, remaining));
  }

  return pageSize;
}

// === Measurement Helpers ===

/**
 * Calculate row height from card height and gap.
 * @param {number} cardHeight
 * @param {number} [gap=0]
 * @returns {number}
 */
export function calculateRowHeight(cardHeight, gap = 0) {
  const safeCardHeight =
    Number.isFinite(cardHeight) && cardHeight > 0
      ? cardHeight
      : VIRTUAL_DEFAULT_CARD_HEIGHT;
  const safeGap = Number.isFinite(gap) && gap >= 0 ? gap : 0;
  return safeCardHeight + safeGap;
}

/**
 * Calculate total scroll height for dataset.
 * @param {number} itemCount - Total items
 * @param {number} columns - Columns in grid
 * @param {number} rowHeight - Height per row
 * @returns {number}
 */
export function calculateTotalHeight(itemCount, columns, rowHeight) {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0;
  if (!Number.isFinite(columns) || columns < 1) return 0;
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) return 0;

  const totalRows = Math.ceil(itemCount / columns);
  return totalRows * rowHeight;
}
