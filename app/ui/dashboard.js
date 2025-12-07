/**
 * Dashboard UI Module
 * Handles hero dashboard statistics and cards
 */

import { formatCurrency, formatNumber } from "../utils/format.js";
import { generateGameKey } from "../utils/keys.js";

/**
 * Update dashboard statistics
 * @param {Object} stats - Collection statistics
 */
export function updateDashboard(stats) {
  updateOwnedCard(stats);
  updateValueCard(stats);
  updateRecentAdditionsCard(stats);
  updateWishlistCard(stats);
  updateBacklogCard(stats);
}

/**
 * Update owned games card
 */
function updateOwnedCard(stats) {
  const ownedCount = document.getElementById("ownedCount");
  const ownedPlatformBreakdown = document.getElementById("ownedPlatformBreakdown");
  const ownedProgressBar = document.getElementById("ownedProgressBar");

  if (ownedCount) {
    animateNumber(ownedCount, 0, stats.ownedCount, 1000);
  }

  if (ownedPlatformBreakdown && stats.platformBreakdown) {
    const topPlatforms = Object.entries(stats.platformBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([platform, count]) => {
        const percentage = Math.round((count / stats.ownedCount) * 100);
        return `${percentage}% ${platform}`;
      })
      .join(" • ");
    ownedPlatformBreakdown.textContent = topPlatforms || "No games yet";
  }

  if (ownedProgressBar && stats.totalGames) {
    const percentage = Math.round((stats.ownedCount / stats.totalGames) * 100);
    ownedProgressBar.style.width = `${percentage}%`;
  }
}

/**
 * Update collection value card
 */
function updateValueCard(stats) {
  const collectionValue = document.getElementById("collectionValue");
  const valueTrend = document.getElementById("valueTrend");

  if (collectionValue) {
    collectionValue.textContent = formatCurrency(stats.totalValue || 0);
  }

  if (valueTrend && stats.valueTrend) {
    const trendIcon = stats.valueTrend.direction === "up" ? "↗" : "↘";
    const trendClass = stats.valueTrend.direction === "up" ? "" : "down";
    valueTrend.className = `stat-card-trend ${trendClass}`;
    valueTrend.innerHTML = `
      <span aria-hidden="true">${trendIcon}</span>
      <span>${formatCurrency(Math.abs(stats.valueTrend.amount))} this month</span>
    `;
  }
}

/**
 * Update recent additions card
 */
function updateRecentAdditionsCard(stats) {
  const recentCount = document.getElementById("recentCount");
  const recentGamesCarousel = document.getElementById("recentGamesCarousel");

  if (recentCount) {
    recentCount.textContent = formatNumber(stats.recentAdditions?.length || 0);
  }

  if (recentGamesCarousel && stats.recentAdditions) {
    recentGamesCarousel.innerHTML = stats.recentAdditions
      .slice(0, 5)
      .map(
        (game) => `
        <div class="carousel-cover" role="button" tabindex="0" data-game-id="${game.id}">
          <img 
            src="${game.cover || "/placeholder.png"}" 
            alt="${game.name}"
            loading="lazy"
          />
        </div>
      `
      )
      .join("");

    // Add click handlers
    recentGamesCarousel.querySelectorAll(".carousel-cover").forEach((cover) => {
      cover.addEventListener("click", () => {
        const gameId = cover.dataset.gameId;
        window.dispatchEvent(new CustomEvent("openGameModal", { detail: { gameId } }));
      });
    });
  }
}

/**
 * Update wishlist card
 */
function updateWishlistCard(stats) {
  const wishlistCount = document.getElementById("wishlistCount");
  const wishlistValue = document.getElementById("wishlistValue");

  if (wishlistCount) {
    animateNumber(wishlistCount, 0, stats.wishlistCount || 0, 800);
  }

  if (wishlistValue) {
    wishlistValue.textContent = `Est. ${formatCurrency(stats.wishlistValue || 0)}`;
  }
}

/**
 * Update backlog card
 */
function updateBacklogCard(stats) {
  const backlogCount = document.getElementById("backlogCount");
  const backlogHours = document.getElementById("backlogHours");

  if (backlogCount) {
    animateNumber(backlogCount, 0, stats.backlogCount || 0, 800);
  }

  if (backlogHours && stats.backlogHours) {
    backlogHours.textContent = `~${formatNumber(stats.backlogHours)} hours`;
  }
}

/**
 * Animate number counter
 */
function animateNumber(element, start, end, duration) {
  const startTime = performance.now();
  const difference = end - start;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + difference * eased);

    element.textContent = formatNumber(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Calculate collection statistics
 * @param {Array} games - All games
 * @param {Object} owned - Owned games object
 * @param {Object} statuses - Game statuses (wishlist, backlog, etc.)
 * @returns {Object} Statistics object
 */
export function calculateStats(games, owned, statuses = {}) {
  const ownedGames = games.filter((game) => {
    const key = generateGameKey(game.game_name, game.platform);
    return key && owned[key];
  });

  const stats = {
    totalGames: games.length,
    ownedCount: ownedGames.length,
    totalValue: 0,
    wishlistCount: 0,
    wishlistValue: 0,
    backlogCount: 0,
    backlogHours: 0,
    platformBreakdown: {},
    recentAdditions: [],
  };

  // Calculate owned games stats
  ownedGames.forEach((game) => {
    // Platform breakdown
    if (!stats.platformBreakdown[game.platform]) {
      stats.platformBreakdown[game.platform] = 0;
    }
    stats.platformBreakdown[game.platform]++;

    // Total value (placeholder - needs price data)
    // stats.totalValue += game.price || 0;
  });

  // Recent additions (most recently added to owned)
  stats.recentAdditions = ownedGames.slice(-5).reverse();

  // Wishlist and backlog (from statuses object)
  if (statuses.wishlist) {
    stats.wishlistCount = Object.keys(statuses.wishlist).length;
    // stats.wishlistValue = calculated from prices
  }

  if (statuses.backlog) {
    stats.backlogCount = Object.keys(statuses.backlog).length;
    // stats.backlogHours = estimated play time
  }

  return stats;
}
