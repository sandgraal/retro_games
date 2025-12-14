/**
 * Curated Home Sections
 * Featured, trending, and staff picks for the homepage
 */

import { gamesSignal, collection, prices, openGameModal } from "../state/store";
import { effect } from "../core/signals";
import { escapeHtml } from "./components";
import type { GameWithKey } from "../core/types";

interface CuratedSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  games: GameWithKey[];
}

/**
 * Get top-rated games
 */
function getTopRated(games: GameWithKey[], limit: number = 12): GameWithKey[] {
  return [...games]
    .filter((g) => {
      const rating = parseFloat(String(g.rating));
      return !isNaN(rating) && rating >= 7;
    })
    .sort((a, b) => {
      const ratingA = parseFloat(String(a.rating)) || 0;
      const ratingB = parseFloat(String(b.rating)) || 0;
      return ratingB - ratingA;
    })
    .slice(0, limit);
}

/**
 * Get recently released games
 */
function getRecentReleases(games: GameWithKey[], limit: number = 12): GameWithKey[] {
  const currentYear = new Date().getFullYear();
  return [...games]
    .filter((g) => {
      const year = parseInt(String(g.release_year), 10);
      return !isNaN(year) && year >= currentYear - 3;
    })
    .sort((a, b) => {
      const yearA = parseInt(String(a.release_year), 10) || 0;
      const yearB = parseInt(String(b.release_year), 10) || 0;
      return yearB - yearA;
    })
    .slice(0, limit);
}

/**
 * Get best value games (high rating, low price)
 */
function getBestValue(
  games: GameWithKey[],
  priceMap: Map<string, { loose?: number }>
): GameWithKey[] {
  return [...games]
    .filter((g) => {
      const rating = parseFloat(String(g.rating)) || 0;
      const price = priceMap.get(g.key)?.loose ?? 0;
      return rating >= 7 && price > 0 && price <= 30;
    })
    .sort((a, b) => {
      // Score = rating / price (higher is better value)
      const priceA = priceMap.get(a.key)?.loose ?? 100;
      const priceB = priceMap.get(b.key)?.loose ?? 100;
      const ratingA = parseFloat(String(a.rating)) || 0;
      const ratingB = parseFloat(String(b.rating)) || 0;
      const valueA = ratingA / (priceA || 1);
      const valueB = ratingB / (priceB || 1);
      return valueB - valueA;
    })
    .slice(0, 12);
}

/**
 * Get classic essentials (retro games with high ratings)
 */
function getClassicEssentials(games: GameWithKey[], limit: number = 12): GameWithKey[] {
  const retroPlatforms = new Set([
    "NES",
    "SNES",
    "N64",
    "Genesis",
    "Master System",
    "Saturn",
    "Dreamcast",
    "Game Boy",
    "Game Boy Color",
    "Game Gear",
    "TurboGrafx-16",
    "Neo Geo",
    "Atari 2600",
    "Atari 5200",
    "Atari 7800",
    "PS1",
    "Famicom",
    "Super Famicom",
  ]);

  return [...games]
    .filter((g) => {
      const rating = parseFloat(String(g.rating)) || 0;
      const year = parseInt(String(g.release_year), 10);
      return retroPlatforms.has(g.platform) && rating >= 8 && year < 2000;
    })
    .sort((a, b) => {
      const ratingA = parseFloat(String(a.rating)) || 0;
      const ratingB = parseFloat(String(b.rating)) || 0;
      return ratingB - ratingA;
    })
    .slice(0, limit);
}

/**
 * Get hidden gems (less popular but highly rated)
 */
function getHiddenGems(games: GameWithKey[], limit: number = 12): GameWithKey[] {
  // Games with high ratings that aren't from top franchises
  const popularFranchises = new Set([
    "mario",
    "zelda",
    "pokemon",
    "final fantasy",
    "sonic",
    "metroid",
    "mega man",
    "castlevania",
    "resident evil",
    "metal gear",
    "halo",
    "god of war",
    "grand theft auto",
    "call of duty",
  ]);

  return [...games]
    .filter((g) => {
      const rating = parseFloat(String(g.rating)) || 0;
      const nameLower = g.game_name.toLowerCase();
      const isPopular = Array.from(popularFranchises).some((f) => nameLower.includes(f));
      return rating >= 8 && !isPopular;
    })
    .sort((a, b) => {
      const ratingA = parseFloat(String(a.rating)) || 0;
      const ratingB = parseFloat(String(b.rating)) || 0;
      return ratingB - ratingA;
    })
    .slice(0, limit);
}

/**
 * Get games from user's wishlist
 */
function getWishlistGames(
  games: GameWithKey[],
  collectionMap: Map<string, { status: string }>
): GameWithKey[] {
  return games
    .filter((g) => collectionMap.get(g.key)?.status === "wishlist")
    .slice(0, 12);
}

/**
 * Generate curated sections
 */
export function generateCuratedSections(): CuratedSection[] {
  const games = gamesSignal.get();
  const priceMap = prices.get();
  const collectionMap = collection.get();

  const sections: CuratedSection[] = [];

  // Top Rated
  const topRated = getTopRated(games);
  if (topRated.length > 0) {
    sections.push({
      id: "top-rated",
      title: "Top Rated",
      icon: "⭐",
      description: "Highest rated games in the catalog",
      games: topRated,
    });
  }

  // Classic Essentials
  const classics = getClassicEssentials(games);
  if (classics.length > 0) {
    sections.push({
      id: "classics",
      title: "Classic Essentials",
      icon: "🏛️",
      description: "Must-play retro games",
      games: classics,
    });
  }

  // Best Value
  const bestValue = getBestValue(games, priceMap);
  if (bestValue.length > 0) {
    sections.push({
      id: "best-value",
      title: "Best Value",
      icon: "💎",
      description: "Great games at great prices",
      games: bestValue,
    });
  }

  // Hidden Gems
  const gems = getHiddenGems(games);
  if (gems.length > 0) {
    sections.push({
      id: "hidden-gems",
      title: "Hidden Gems",
      icon: "🔮",
      description: "Underrated treasures worth discovering",
      games: gems,
    });
  }

  // Recent Releases
  const recent = getRecentReleases(games);
  if (recent.length > 0) {
    sections.push({
      id: "recent",
      title: "Recent Releases",
      icon: "✨",
      description: "Latest additions to the catalog",
      games: recent,
    });
  }

  // Your Wishlist (if not empty)
  const wishlist = getWishlistGames(games, collectionMap);
  if (wishlist.length > 0) {
    sections.push({
      id: "wishlist",
      title: "Your Wishlist",
      icon: "💫",
      description: "Games you want to add to your collection",
      games: wishlist,
    });
  }

  return sections;
}

/**
 * Render a horizontal game carousel
 */
function renderGameCarousel(games: GameWithKey[], sectionId: string): string {
  return `
    <div class="curated-carousel" data-section="${sectionId}">
      <div class="curated-carousel-track">
        ${games
          .map(
            (game) => `
          <button 
            type="button" 
            class="curated-card" 
            data-game-key="${escapeHtml(game.key)}"
            title="${escapeHtml(game.game_name)}"
          >
            <div class="curated-card-cover">
              ${
                game.cover
                  ? `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.game_name)}" loading="lazy" decoding="async" />`
                  : `<div class="curated-card-placeholder">🎮</div>`
              }
            </div>
            <div class="curated-card-info">
              <span class="curated-card-title">${escapeHtml(game.game_name)}</span>
              <span class="curated-card-platform">${escapeHtml(game.platform)}</span>
            </div>
            ${
              game.rating
                ? `<span class="curated-card-rating">${parseFloat(String(game.rating)).toFixed(1)}</span>`
                : ""
            }
          </button>
        `
          )
          .join("")}
      </div>
      <button type="button" class="curated-carousel-nav curated-carousel-nav--prev" aria-label="Previous">‹</button>
      <button type="button" class="curated-carousel-nav curated-carousel-nav--next" aria-label="Next">›</button>
    </div>
  `;
}

/**
 * Render curated sections
 */
function renderCuratedSections(sections: CuratedSection[]): string {
  if (sections.length === 0) return "";

  return `
    <div class="curated-sections">
      ${sections
        .map(
          (section) => `
        <section class="curated-section" data-section-id="${section.id}">
          <div class="curated-section-header">
            <span class="curated-section-icon">${section.icon}</span>
            <div class="curated-section-text">
              <h3 class="curated-section-title">${escapeHtml(section.title)}</h3>
              <p class="curated-section-description">${escapeHtml(section.description)}</p>
            </div>
          </div>
          ${renderGameCarousel(section.games, section.id)}
        </section>
      `
        )
        .join("")}
    </div>
  `;
}

/**
 * Setup carousel navigation
 */
function setupCarouselNavigation(container: HTMLElement): void {
  container.querySelectorAll(".curated-carousel").forEach((carousel) => {
    const track = carousel.querySelector(".curated-carousel-track") as HTMLElement;
    const prevBtn = carousel.querySelector(
      ".curated-carousel-nav--prev"
    ) as HTMLButtonElement;
    const nextBtn = carousel.querySelector(
      ".curated-carousel-nav--next"
    ) as HTMLButtonElement;

    if (!track || !prevBtn || !nextBtn) return;

    const scrollAmount = 300;

    prevBtn.addEventListener("click", () => {
      track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      track.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });

    // Update button visibility based on scroll position
    const updateButtons = () => {
      prevBtn.disabled = track.scrollLeft <= 0;
      nextBtn.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 10;
    };

    track.addEventListener("scroll", updateButtons);
    updateButtons();
  });

  // Handle card clicks
  container.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".curated-card");
    if (card) {
      const gameKey = card.getAttribute("data-game-key");
      if (gameKey) {
        const games = gamesSignal.get();
        const game = games.find((g) => g.key === gameKey);
        if (game) {
          openGameModal(game);
        }
      }
    }
  });
}

/**
 * Initialize curated home sections
 */
export function initCuratedSections(containerId: string): () => void {
  const container = document.getElementById(containerId);
  if (!container) return () => {};

  // Initial render
  const sections = generateCuratedSections();
  container.innerHTML = renderCuratedSections(sections);
  setupCarouselNavigation(container);

  // Re-render when data changes
  return effect(() => {
    // Subscribe to relevant signals
    gamesSignal.get();
    collection.get();
    prices.get();

    // Re-render
    const newSections = generateCuratedSections();
    container.innerHTML = renderCuratedSections(newSections);
    setupCarouselNavigation(container);
  });
}
