/**
 * Game Card Component
 * Renders individual game cards in the grid
 */

import type { GameWithKey, CollectionStatus } from "../core/types";
import { createElement } from "./components";
import { getGameStatus, openGameModal } from "../state/store";

const STATUS_LABELS: Record<CollectionStatus, string> = {
  none: "",
  owned: "Owned",
  wishlist: "Wishlist",
  backlog: "Backlog",
  trade: "For Trade",
};

const STATUS_ICONS: Record<CollectionStatus, string> = {
  none: "",
  owned: "✓",
  wishlist: "★",
  backlog: "📚",
  trade: "↔",
};

/**
 * Create a game card element
 */
export function createGameCard(game: GameWithKey, index: number): HTMLElement {
  const status = getGameStatus(game.key);
  const card = createElement("article", {
    class: `game-card ${status !== "none" ? `game-card--${status}` : ""}`,
    "data-game-key": game.key,
    "data-index": index,
    role: "button",
    tabindex: 0,
    "aria-label": `${game.game_name} for ${game.platform}`,
  });

  // Cover image (uses kebab-case to match CSS)
  const cover = createElement("div", { class: "game-card-cover" });
  if (game.cover) {
    const img = createElement("img", {
      src: game.cover,
      alt: `${game.game_name} cover art`,
      loading: "lazy",
    });
    img.onerror = () => {
      img.style.display = "none";
      cover.appendChild(createPlaceholder(game.game_name));
    };
    cover.appendChild(img);
  } else {
    cover.appendChild(createPlaceholder(game.game_name));
  }
  card.appendChild(cover);

  // Status badge (CSS uses .game-card-status.owned pattern)
  if (status !== "none") {
    const badge = createElement(
      "div",
      {
        class: `game-card-status ${status}`,
      },
      `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`
    );
    card.appendChild(badge);
  }

  // Info overlay
  const overlay = createElement("div", { class: "game-card-overlay" });

  const title = createElement("h3", { class: "game-card-title" }, game.game_name);
  overlay.appendChild(title);

  const meta = createElement("div", { class: "game-card-meta" });
  meta.appendChild(createElement("span", { class: "game-card-platform" }, game.platform));

  if (game.rating) {
    const rating = parseFloat(String(game.rating));
    if (!isNaN(rating)) {
      meta.appendChild(
        createElement("span", { class: "game-card-rating" }, `⭐ ${rating.toFixed(1)}`)
      );
    }
  }
  overlay.appendChild(meta);

  if (game.genre) {
    const genre = createElement("p", { class: "game-card-genre" }, game.genre);
    overlay.appendChild(genre);
  }

  card.appendChild(overlay);

  // Click handler
  card.addEventListener("click", () => {
    openGameModal(game);
  });

  // Keyboard handler
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openGameModal(game);
    }
  });

  return card;
}

/**
 * Create a placeholder for missing cover art
 */
function createPlaceholder(name: string): HTMLElement {
  const placeholder = createElement("div", { class: "game-card-placeholder" });
  const text = name.slice(0, 2).toUpperCase();
  placeholder.textContent = text;
  return placeholder;
}

/**
 * Create a skeleton loading card
 */
export function createSkeletonCard(): HTMLElement {
  const card = createElement("div", { class: "game-card game-card-skeleton" });
  const cover = createElement("div", {
    class: "game-card-cover",
  });
  card.appendChild(cover);
  return card;
}

/**
 * Render multiple game cards
 */
export function renderGameCards(games: GameWithKey[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  games.forEach((game, index) => {
    fragment.appendChild(createGameCard(game, index));
  });
  return fragment;
}

/**
 * Render skeleton cards
 */
export function renderSkeletonCards(count: number): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    fragment.appendChild(createSkeletonCard());
  }
  return fragment;
}
