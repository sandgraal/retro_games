/**
 * Grid UI Module (New Design)
 * Masonry-style game cover grid with enhanced interactions
 */

import { formatRating } from "../utils/format.js";
import { generateGameKey } from "../utils/keys.js";

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

  // Determine status
  const status = getGameStatus(gameKey, owned, statuses);

  // Determine if featured (high rating or owned)
  const isFeatured =
    (game.rating && parseFloat(game.rating) >= 9.0) || status === "owned";
  if (isFeatured && index % 7 === 0) {
    card.classList.add("featured");
  }

  // Build card HTML
  card.innerHTML = `
    <div class="game-card-cover">
      <img 
        src="${game.cover || "/placeholder.png"}" 
        alt="${game.game_name} cover art"
        loading="lazy"
      />
      ${status ? `<div class="game-card-status ${status}">${status}</div>` : ""}
    </div>
    <div class="game-card-overlay">
      <h3 class="game-card-title">${game.game_name}</h3>
      <div class="game-card-meta">
        <span class="game-card-platform">${game.platform}</span>
        ${game.rating ? `<span class="game-card-rating">★ ${formatRating(game.rating)}</span>` : ""}
        ${game.genre ? `<span class="game-card-genre">${game.genre.split(",")[0]}</span>` : ""}
      </div>
      <div class="game-card-actions">
        ${renderQuickActions(gameKey, status)}
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
 * Get game status
 */
function getGameStatus(gameKey, owned, statuses) {
  if (owned[gameKey]) return "owned";
  if (statuses.wishlist?.[gameKey]) return "wishlist";
  if (statuses.backlog?.[gameKey]) return "backlog";
  if (statuses.trade?.[gameKey]) return "trade";
  return null;
}

/**
 * Render quick action buttons
 */
function renderQuickActions(gameKey, currentStatus) {
  const actions = [];

  if (currentStatus !== "owned") {
    actions.push(
      `<button type="button" class="game-card-action" data-action="own" data-game-key="${gameKey}">
        Own
      </button>`
    );
  }

  if (currentStatus !== "wishlist") {
    actions.push(
      `<button type="button" class="game-card-action" data-action="wishlist" data-game-key="${gameKey}">
        Want
      </button>`
    );
  }

  return actions.join("");
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
  gridElement.innerHTML = `
    <div class="game-grid-empty">
      <div class="game-grid-empty-icon" aria-hidden="true">🎮</div>
      <h3 class="game-grid-empty-title">No Games Found</h3>
      <p class="game-grid-empty-text">
        Try adjusting your filters or search to see more games.
      </p>
    </div>
  `;
}

/**
 * Animate cards with stagger effect
 */
function animateCards() {
  const cards = document.querySelectorAll(".game-card");
  cards.forEach((card, index) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";

    setTimeout(() => {
      card.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, index * 50); // Stagger by 50ms
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
    const badge = document.createElement("div");
    badge.className = `game-card-status ${newStatus}`;
    badge.textContent = newStatus;
    coverDiv.appendChild(badge);
  }

  // Update quick actions
  const actionsContainer = card.querySelector(".game-card-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = renderQuickActions(gameKey, newStatus);
  }
}

/**
 * Show loading skeletons
 */
export function showLoadingSkeletons(count = 12) {
  const gridElement = document.getElementById("gameGrid");
  if (!gridElement) return;

  gridElement.innerHTML = Array(count)
    .fill(0)
    .map(
      () => `
      <div class="game-card game-card-skeleton">
        <div class="game-card-cover"></div>
      </div>
    `
    )
    .join("");
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
