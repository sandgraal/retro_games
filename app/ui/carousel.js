/**
 * Carousel UI helpers extracted from archive/app-legacy.js.
 * Pure functions for carousel calculations and trending picks.
 * @module ui/carousel
 */

import { escapeHtml } from "../utils/dom.js";

// === Scroll Calculations ===

/**
 * Default scroll step percentage of container width.
 */
export const DEFAULT_SCROLL_PERCENT = 0.85;

/**
 * Minimum scroll step in pixels.
 */
export const MIN_SCROLL_STEP = 220;

/**
 * Calculate scroll step based on container width.
 * @param {number} containerWidth - Container width in pixels
 * @param {number} [customStep] - Optional custom step override
 * @param {number} [percent=0.85] - Percentage of width
 * @returns {number} Scroll step in pixels
 */
export function calculateScrollStep(
  containerWidth,
  customStep,
  percent = DEFAULT_SCROLL_PERCENT
) {
  if (Number.isFinite(customStep) && customStep > 0) {
    return customStep;
  }
  const calculated = Math.round(containerWidth * percent);
  return calculated > 0 ? calculated : MIN_SCROLL_STEP;
}

/**
 * Calculate maximum scroll position.
 * @param {number} scrollWidth - Total scrollable width
 * @param {number} clientWidth - Visible width
 * @returns {number} Maximum scroll left value
 */
export function calculateMaxScroll(scrollWidth, clientWidth) {
  return Math.max(0, scrollWidth - clientWidth);
}

/**
 * Compute button disabled states based on scroll position.
 * @param {number} scrollLeft - Current scroll position
 * @param {number} scrollWidth - Total scrollable width
 * @param {number} clientWidth - Visible width
 * @param {number} [threshold=1] - Pixel threshold for edge detection
 * @returns {{prevDisabled: boolean, nextDisabled: boolean}}
 */
export function computeButtonStates(scrollLeft, scrollWidth, clientWidth, threshold = 1) {
  const maxScroll = calculateMaxScroll(scrollWidth, clientWidth);
  return {
    prevDisabled: scrollLeft <= threshold,
    nextDisabled: scrollLeft >= maxScroll - threshold,
  };
}

/**
 * Calculate new scroll position after navigation.
 * @param {number} currentScroll - Current scroll position
 * @param {number} step - Scroll step amount
 * @param {'prev'|'next'} direction - Scroll direction
 * @returns {number} New scroll position
 */
export function calculateNewScrollPosition(currentScroll, step, direction) {
  const delta = direction === "next" ? step : -step;
  return currentScroll + delta;
}

// === Trending Picks Selection ===

/**
 * Entry object for ranking games.
 * @typedef {Object} RankedEntry
 * @property {Object} row - Original game row
 * @property {number|null} value - Ranking value (rating or year)
 * @property {number} index - Original array index
 */

/**
 * Rank games by rating (descending, then by name).
 * @param {Object[]} data - Array of game rows
 * @param {string} ratingField - Field name for rating
 * @param {string} nameField - Field name for game name
 * @returns {RankedEntry[]} Sorted entries
 */
export function rankByRating(data, ratingField = "rating", nameField = "game_name") {
  if (!Array.isArray(data)) return [];

  return data
    .map((row, index) => {
      const rating = parseFloat(row?.[ratingField]);
      return {
        row,
        value: Number.isFinite(rating) ? rating : null,
        index,
      };
    })
    .filter((item) => item.value !== null)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      const nameA = String(a.row?.[nameField] || "").toLowerCase();
      const nameB = String(b.row?.[nameField] || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
}

/**
 * Rank games by year (descending, newest first).
 * @param {Object[]} data - Array of game rows
 * @param {string} yearField - Field name for year
 * @returns {RankedEntry[]} Sorted entries
 */
export function rankByYear(data, yearField = "release_year") {
  if (!Array.isArray(data)) return [];

  return data
    .map((row, index) => {
      const rawYear = row?.[yearField];
      const year = typeof rawYear === "number" ? rawYear : parseInt(rawYear, 10);
      return {
        row,
        value: Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : null,
        index,
      };
    })
    .sort((a, b) => {
      const yearA = a.value === null ? -Infinity : a.value;
      const yearB = b.value === null ? -Infinity : b.value;
      if (yearA !== yearB) return yearB - yearA;
      return b.index - a.index;
    });
}

/**
 * Select trending picks from game data.
 * Combines top rated games with most recent releases.
 * @param {Object[]} data - Array of game rows
 * @param {Object} [options={}] - Options
 * @param {number} [options.topRated=5] - Number of top rated to include
 * @param {number} [options.mostRecent=5] - Number of most recent to include
 * @param {number} [options.minPicks=8] - Minimum total picks
 * @param {string} [options.ratingField='rating'] - Rating field name
 * @param {string} [options.yearField='release_year'] - Year field name
 * @param {string} [options.nameField='game_name'] - Name field name
 * @param {string} [options.platformField='platform'] - Platform field name
 * @returns {Object[]} Selected game rows (deduplicated)
 */
export function selectTrendingPicks(data, options = {}) {
  const {
    topRated = 5,
    mostRecent = 5,
    minPicks = 8,
    ratingField = "rating",
    yearField = "release_year",
    nameField = "game_name",
    platformField = "platform",
  } = options;

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const ratingRanked = rankByRating(data, ratingField, nameField);
  const yearRanked = rankByYear(data, yearField);

  const picks = [];
  const seen = new Set();

  const addPick = (row) => {
    if (!row) return false;
    const key = `${row[nameField] || ""}___${row[platformField] || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    picks.push(row);
    return true;
  };

  // Add top rated
  ratingRanked.slice(0, topRated).forEach((entry) => addPick(entry.row));

  // Add most recent
  yearRanked.slice(0, mostRecent).forEach((entry) => addPick(entry.row));

  // Fill to minimum with remaining data
  if (picks.length < minPicks) {
    for (const row of data) {
      if (picks.length >= minPicks) break;
      addPick(row);
    }
  }

  return picks;
}

// === Trending Card Rendering ===

/**
 * Build HTML for a trending card.
 * @param {Object} row - Game row data
 * @param {Object} [options={}] - Field name options
 * @returns {string} HTML string
 */
export function buildTrendingCard(row, options = {}) {
  const {
    nameField = "game_name",
    platformField = "platform",
    ratingField = "rating",
    yearField = "release_year",
    genreField = "genre",
  } = options;

  const name = escapeHtml(String(row?.[nameField] || "Untitled"));
  const platform = escapeHtml(String(row?.[platformField] || "Unknown platform"));

  const rawYear = row?.[yearField];
  const yearValue = typeof rawYear === "number" ? rawYear : parseInt(rawYear, 10);
  const yearText = Number.isFinite(yearValue) ? String(yearValue) : "TBD";

  const ratingValue = parseFloat(row?.[ratingField]);
  const ratingText = Number.isFinite(ratingValue)
    ? ratingValue.toFixed(1).replace(/\\.0$/, "")
    : "NR";
  const ratingLabel = ratingText === "NR" ? "Not rated" : `Rating ${ratingText}`;

  const genres = row?.[genreField]
    ? String(row[genreField])
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];
  const primaryGenre = genres.length > 0 ? escapeHtml(genres[0]) : "";

  return [
    '<article class="trending-card" role="listitem" tabindex="0">',
    `<div class="trending-rating" aria-label="${ratingLabel}">`,
    '<span aria-hidden="true">★</span>',
    `<span>${ratingText}</span>`,
    "</div>",
    `<h3>${name}</h3>`,
    '<div class="trending-meta">',
    `<span>${platform}</span>`,
    `<span>${escapeHtml(yearText)}</span>`,
    primaryGenre ? `<span>${primaryGenre}</span>` : "",
    "</div>",
    "</article>",
  ].join("");
}

/**
 * Build HTML for empty trending state.
 * @returns {string} HTML string
 */
export function buildEmptyTrendingMessage() {
  return '<span class="trending-empty" role="listitem">Trending picks will appear once games are added.</span>';
}

/**
 * Build complete trending list HTML.
 * @param {Object[]} picks - Selected game rows
 * @param {Object} [options={}] - Field name options
 * @returns {string} HTML string
 */
export function buildTrendingList(picks, options = {}) {
  if (!Array.isArray(picks) || picks.length === 0) {
    return buildEmptyTrendingMessage();
  }
  return picks.map((row) => buildTrendingCard(row, options)).join("");
}

// === Carousel ARIA Helpers ===

/**
 * Build ARIA attributes for carousel navigation button.
 * @param {'prev'|'next'} direction - Button direction
 * @param {string} targetId - Target carousel ID
 * @param {boolean} [disabled=false] - Whether button is disabled
 * @returns {Object} Attributes object
 */
export function buildCarouselButtonAttrs(direction, targetId, disabled = false) {
  const label = direction === "prev" ? "Previous items" : "Next items";
  return {
    type: "button",
    "aria-label": label,
    "aria-controls": targetId,
    "data-carousel-target": targetId,
    "data-direction": direction,
    disabled: disabled ? "true" : undefined,
  };
}

/**
 * Build ARIA attributes for carousel container.
 * @param {string} id - Carousel ID
 * @param {string} [label='Carousel'] - Accessible label
 * @returns {Object} Attributes object
 */
export function buildCarouselContainerAttrs(id, label = "Carousel") {
  return {
    id,
    role: "list",
    "aria-label": label,
    tabindex: "0",
  };
}
