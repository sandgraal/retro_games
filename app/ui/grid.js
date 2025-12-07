/**
 * Grid UI Module (New Design)
 * Masonry-style game cover grid with enhanced interactions
 * @module ui/grid
 */

import { escapeHtml } from "../utils/dom.js";
import { formatRating } from "../utils/format.js";
import { generateGameKey } from "../utils/keys.js";

// === Cover URL Helpers ===

/**
 * Normalize a cover URL to a valid HTTPS URL.
 * Handles string values and objects with url/href/source properties.
 * @param {string|Object} value - Cover URL value
 * @returns {string} Normalized URL or empty string
 */
export function normalizeCoverUrl(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "";
  }
  if (typeof value === "object") {
    if (typeof value.url === "string") return normalizeCoverUrl(value.url);
    if (typeof value.href === "string") return normalizeCoverUrl(value.href);
    if (typeof value.source === "string") return normalizeCoverUrl(value.source);
  }
  return "";
}

/**
 * Resolve the first valid screenshot URL as fallback cover.
 * @param {Object} row - Game data with screenshots array
 * @returns {string} Screenshot URL or empty string
 */
export function resolveScreenshotCover(row) {
  if (!row || typeof row !== "object") return "";
  const screenshots = Array.isArray(row.screenshots) ? row.screenshots : [];
  for (const candidate of screenshots) {
    const url = normalizeCoverUrl(candidate);
    if (url) return url;
  }
  return "";
}

/**
 * Get the best cover URL for a game.
 * @param {Object} row - Game data
 * @param {string} [coverField='cover'] - Field name for cover
 * @returns {string} Cover URL or empty string
 */
export function resolveCoverUrl(row, coverField = "cover") {
  if (!row) return "";
  const direct = normalizeCoverUrl(row[coverField]);
  if (direct) return direct;
  return resolveScreenshotCover(row);
}

// === Status Helpers ===

/**
 * Status CSS class map.
 */
export const STATUS_CLASSES = {
  owned: "game-card-status--owned",
  wishlist: "game-card-status--wishlist",
  backlog: "game-card-status--backlog",
  trade: "game-card-status--trade",
};

/**
 * Status display labels.
 */
export const STATUS_DISPLAY_LABELS = {
  owned: "Owned",
  wishlist: "Wishlist",
  backlog: "Backlog",
  trade: "For Trade",
};

/**
 * Get game status from ownership maps.
 * @param {string} gameKey - Game key
 * @param {Object} owned - Owned games map
 * @param {Object} [statuses={}] - Status maps (wishlist, backlog, trade)
 * @returns {string|null} Status string or null
 */
export function getGameStatusFromMaps(gameKey, owned, statuses = {}) {
  if (!gameKey) return null;
  if (owned?.[gameKey]) return "owned";
  if (statuses?.wishlist?.[gameKey]) return "wishlist";
  if (statuses?.backlog?.[gameKey]) return "backlog";
  if (statuses?.trade?.[gameKey]) return "trade";
  return null;
}

/**
 * Get CSS class for a status.
 * @param {string|null} status - Status value
 * @returns {string} CSS class or empty string
 */
export function getStatusClass(status) {
  return STATUS_CLASSES[status] || "";
}

/**
 * Get display label for a status.
 * @param {string|null} status - Status value
 * @returns {string} Display label or empty string
 */
export function getStatusLabel(status) {
  return STATUS_DISPLAY_LABELS[status] || "";
}

// === Placeholder Helpers ===

/**
 * Generate placeholder text from game name (first 2 chars).
 * @param {string} name - Game name
 * @returns {string} 1-2 character placeholder
 */
export function generatePlaceholderText(name) {
  return String(name || "?")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Build placeholder markup for missing cover.
 * @param {string} name - Game name
 * @returns {string} HTML string
 */
export function buildPlaceholderMarkup(name) {
  const text = escapeHtml(generatePlaceholderText(name));
  return `<div class="card-placeholder">${text}</div>`;
}

/**
 * Build cover image markup.
 * @param {string} url - Cover URL
 * @param {string} alt - Alt text
 * @returns {string} HTML string
 */
export function buildCoverMarkup(url, alt) {
  const safeUrl = escapeHtml(url);
  const safeAlt = escapeHtml(alt || "Cover art");
  return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy">`;
}

/**
 * Build status badge markup.
 * @param {string|null} status - Status value
 * @returns {string} HTML string or empty
 */
export function buildStatusBadge(status) {
  if (!status) return "";
  const className = getStatusClass(status);
  const label = getStatusLabel(status);
  if (!className || !label) return "";
  return `<div class="game-card-status ${escapeHtml(status)}">${escapeHtml(label)}</div>`;
}

// === Empty State ===

/**
 * Build empty grid state markup.
 * @param {Object} [options={}] - Options
 * @param {string} [options.icon='🎮'] - Icon
 * @param {string} [options.title='No Games Found'] - Title
 * @param {string} [options.message] - Message text
 * @returns {string} HTML string
 */
export function buildEmptyGridMarkup(options = {}) {
  const {
    icon = "🎮",
    title = "No Games Found",
    message = "Try adjusting your filters or search to see more games.",
  } = options;

  return [
    '<div class="game-grid-empty">',
    `<div class="game-grid-empty-icon" aria-hidden="true">${escapeHtml(icon)}</div>`,
    `<h3 class="game-grid-empty-title">${escapeHtml(title)}</h3>`,
    `<p class="game-grid-empty-text">${escapeHtml(message)}</p>`,
    "</div>",
  ].join("");
}

// === Skeleton Loading ===

/**
 * Build skeleton card markup.
 * @param {number} [count=1] - Number of skeletons
 * @returns {string} HTML string
 */
export function buildSkeletonCards(count = 1) {
  const card =
    '<div class="game-card game-card-skeleton"><div class="game-card-cover"></div></div>';
  return Array(count).fill(card).join("");
}

// === Animation Helpers ===

/**
 * Calculate stagger delay for card animation.
 * @param {number} index - Card index
 * @param {number} [baseDelay=50] - Base delay in ms
 * @param {number} [maxDelay=500] - Maximum delay in ms
 * @returns {number} Delay in ms
 */
export function calculateStaggerDelay(index, baseDelay = 50, maxDelay = 500) {
  const calculated = index * baseDelay;
  return Math.min(calculated, maxDelay);
}

/**
 * Determine if a card should be featured.
 * @param {Object} game - Game data
 * @param {number} index - Card index
 * @param {string|null} status - Game status
 * @param {Object} [options={}] - Options
 * @param {number} [options.ratingThreshold=9.0] - Min rating for featured
 * @param {number} [options.modulo=7] - Feature every Nth high-rated card
 * @returns {boolean}
 */
export function shouldBeFeatured(game, index, status, options = {}) {
  const { ratingThreshold = 9.0, modulo = 7 } = options;
  const rating = parseFloat(game?.rating);
  const isFeaturedRating = Number.isFinite(rating) && rating >= ratingThreshold;
  const isOwned = status === "owned";
  return (isFeaturedRating || isOwned) && index % modulo === 0;
}

// === Quick Actions ===

/**
 * Build quick action button markup.
 * @param {string} action - Action type (own, wishlist, etc.)
 * @param {string} gameKey - Game key
 * @param {string} label - Button label
 * @returns {string} HTML string
 */
export function buildQuickActionButton(action, gameKey, label) {
  const safeKey = escapeHtml(gameKey);
  const safeAction = escapeHtml(action);
  const safeLabel = escapeHtml(label);
  return `<button type="button" class="game-card-action" data-action="${safeAction}" data-game-key="${safeKey}">${safeLabel}</button>`;
}

/**
 * Build quick actions for a card.
 * @param {string} gameKey - Game key
 * @param {string|null} currentStatus - Current status
 * @returns {string} HTML string
 */
export function buildQuickActionsMarkup(gameKey, currentStatus) {
  const actions = [];
  if (currentStatus !== "owned") {
    actions.push(buildQuickActionButton("own", gameKey, "Own"));
  }
  if (currentStatus !== "wishlist") {
    actions.push(buildQuickActionButton("wishlist", gameKey, "Want"));
  }
  return actions.join("");
}

/**
 * Render game grid with masonry layout
 * @param {Array} games - Games to display
 * @param {Object} owned - Owned games object
 * @param {Object} statuses - Game statuses
 */
export function renderGrid(games, owned = {}, statuses = {}) {
  const gridElement = document.getElementById("gameGrid");
  if (!gridElement) return;

  // Clear loading state
  gridElement.innerHTML = "";

  if (games.length === 0) {
    renderEmptyState(gridElement);
    return;
  }

  // Render game cards
  games.forEach((game, index) => {
    const gameKey = generateGameKey(game.game_name, game.platform);
    const card = createGameCard(game, gameKey, owned, statuses, index);
    gridElement.appendChild(card);
  });

  // Add stagger animation
  animateCards();
}

/**
 * Create a game card element
 */
function createGameCard(game, gameKey, owned, statuses, index) {
  const card = document.createElement("article");
  card.className = "game-card";
  card.setAttribute("role", "listitem");
  card.setAttribute("data-game-key", gameKey);
  card.tabIndex = 0;

  // Determine status using exported helper
  const status = getGameStatusFromMaps(gameKey, owned, statuses);

  // Determine if featured using exported helper
  if (shouldBeFeatured(game, index, status)) {
    card.classList.add("featured");
  }

  // Get cover URL
  const coverUrl = resolveCoverUrl(game);
  const coverHtml = coverUrl
    ? buildCoverMarkup(coverUrl, `${game.game_name} cover art`)
    : buildPlaceholderMarkup(game.game_name);

  // Build card HTML using exported helpers
  card.innerHTML = `
    <div class="game-card-cover">
      ${coverHtml}
      ${buildStatusBadge(status)}
    </div>
    <div class="game-card-overlay">
      <h3 class="game-card-title">${escapeHtml(game.game_name || "Untitled")}</h3>
      <div class="game-card-meta">
        <span class="game-card-platform">${escapeHtml(game.platform || "")}</span>
        ${game.rating ? `<span class="game-card-rating">★ ${formatRating(game.rating)}</span>` : ""}
        ${game.genre ? `<span class="game-card-genre">${escapeHtml(game.genre.split(",")[0])}</span>` : ""}
      </div>
      <div class="game-card-actions">
        ${buildQuickActionsMarkup(gameKey, status)}
      </div>
    </div>
  `;

  // Add click handler
  card.addEventListener("click", (e) => {
    if (!e.target.closest(".game-card-action")) {
      openGameModal(game, gameKey);
    }
  });

  // Add keyboard handler
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openGameModal(game, gameKey);
    }
  });

  return card;
}

/**
 * Open game detail modal
 */
function openGameModal(game, gameKey) {
  window.dispatchEvent(
    new CustomEvent("openGameModal", {
      detail: { game, gameKey },
    })
  );
}

/**
 * Render empty state
 */
function renderEmptyState(gridElement) {
  gridElement.innerHTML = buildEmptyGridMarkup();
}

/**
 * Animate cards with stagger effect
 */
function animateCards() {
  const cards = document.querySelectorAll(".game-card");
  cards.forEach((card, index) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";

    const delay = calculateStaggerDelay(index);
    setTimeout(() => {
      card.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, delay);
  });
}

/**
 * Update card status badge
 */
export function updateCardStatus(gameKey, newStatus) {
  const card = document.querySelector(`[data-game-key="${gameKey}"]`);
  if (!card) return;

  // Update status badge
  const existingBadge = card.querySelector(".game-card-status");
  if (existingBadge) {
    existingBadge.remove();
  }

  if (newStatus) {
    const coverDiv = card.querySelector(".game-card-cover");
    if (coverDiv) {
      coverDiv.insertAdjacentHTML("beforeend", buildStatusBadge(newStatus));
    }
  }

  // Update quick actions using exported helper
  const actionsContainer = card.querySelector(".game-card-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = buildQuickActionsMarkup(gameKey, newStatus);
  }
}

/**
 * Show loading skeletons
 */
export function showLoadingSkeletons(count = 12) {
  const gridElement = document.getElementById("gameGrid");
  if (!gridElement) return;

  gridElement.innerHTML = buildSkeletonCards(count);
}

/**
 * Handle quick actions from grid
 */
export function setupQuickActions() {
  document.getElementById("gameGrid")?.addEventListener("click", (e) => {
    const actionBtn = e.target.closest(".game-card-action");
    if (!actionBtn) return;

    e.stopPropagation();

    const action = actionBtn.dataset.action;
    const gameKey = actionBtn.dataset.gameKey;

    window.dispatchEvent(
      new CustomEvent("gameStatusChange", {
        detail: { gameKey, action },
      })
    );
  });
}
