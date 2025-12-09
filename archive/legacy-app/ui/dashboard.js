/**
 * Dashboard UI Module
 * Handles hero dashboard statistics and cards
 * @module ui/dashboard
 */

import { escapeHtml } from "../utils/dom.js";
import { formatCurrency, formatNumber } from "../utils/format.js";
import { generateGameKey } from "../utils/keys.js";

// === Pure Calculation Helpers ===

/**
 * Calculate average rating from game data.
 * @param {Object[]} data - Array of game rows
 * @param {string} [ratingField='rating'] - Field name for rating
 * @returns {{average: number|null, count: number, total: number}}
 */
export function calculateAverageRating(data, ratingField = "rating") {
  if (!Array.isArray(data) || data.length === 0) {
    return { average: null, count: 0, total: 0 };
  }

  const ratings = data
    .map((row) => parseFloat(row?.[ratingField]))
    .filter((n) => Number.isFinite(n));

  if (ratings.length === 0) {
    return { average: null, count: 0, total: data.length };
  }

  const sum = ratings.reduce((a, b) => a + b, 0);
  const average = sum / ratings.length;

  return {
    average: Math.round(average * 100) / 100,
    count: ratings.length,
    total: data.length,
  };
}

/**
 * Count unique platforms in game data.
 * @param {Object[]} data - Array of game rows
 * @param {string} [platformField='platform'] - Field name for platform
 * @returns {{platforms: string[], count: number}}
 */
export function countPlatforms(data, platformField = "platform") {
  if (!Array.isArray(data)) {
    return { platforms: [], count: 0 };
  }

  const platforms = new Set(data.map((row) => row?.[platformField]).filter((v) => v));

  return {
    platforms: Array.from(platforms).sort(),
    count: platforms.size,
  };
}

/**
 * Calculate platform breakdown for owned games.
 * @param {Object[]} ownedGames - Array of owned game rows
 * @param {string} [platformField='platform'] - Field name for platform
 * @returns {Object} Map of platform to count
 */
export function calculatePlatformBreakdown(ownedGames, platformField = "platform") {
  if (!Array.isArray(ownedGames)) {
    return {};
  }

  const breakdown = {};
  ownedGames.forEach((game) => {
    const platform = game?.[platformField];
    if (platform) {
      breakdown[platform] = (breakdown[platform] || 0) + 1;
    }
  });

  return breakdown;
}

/**
 * Get top N platforms by count.
 * @param {Object} breakdown - Platform breakdown object
 * @param {number} [n=3] - Number of top platforms
 * @returns {Array<{platform: string, count: number, percentage: number}>}
 */
export function getTopPlatforms(breakdown, n = 3) {
  if (!breakdown || typeof breakdown !== "object") {
    return [];
  }

  const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

/**
 * Format top platforms as display string.
 * @param {Object} breakdown - Platform breakdown object
 * @param {number} [n=2] - Number of platforms to show
 * @returns {string} Formatted string like "45% SNES • 30% NES"
 */
export function formatTopPlatformsDisplay(breakdown, n = 2) {
  const top = getTopPlatforms(breakdown, n);
  if (top.length === 0) return "No games yet";
  return top.map((p) => `${p.percentage}% ${p.platform}`).join(" • ");
}

/**
 * Calculate completion percentage.
 * @param {number} owned - Number owned
 * @param {number} total - Total number
 * @returns {number} Percentage (0-100)
 */
export function calculateCompletionPercentage(owned, total) {
  if (!total || total <= 0 || !Number.isFinite(owned)) return 0;
  return Math.round((owned / total) * 100);
}

/**
 * Compute status counts from status maps.
 * @param {Object} statusMaps - Object with owned, wishlist, backlog, trade maps
 * @returns {Object} Counts for each status
 */
export function computeStatusCounts(statusMaps) {
  const counts = {
    owned: 0,
    wishlist: 0,
    backlog: 0,
    trade: 0,
    total: 0,
  };

  if (!statusMaps || typeof statusMaps !== "object") {
    return counts;
  }

  counts.owned = Object.keys(statusMaps.owned || {}).filter(
    (k) => statusMaps.owned[k]
  ).length;
  counts.wishlist = Object.keys(statusMaps.wishlist || {}).filter(
    (k) => statusMaps.wishlist[k]
  ).length;
  counts.backlog = Object.keys(statusMaps.backlog || {}).filter(
    (k) => statusMaps.backlog[k]
  ).length;
  counts.trade = Object.keys(statusMaps.trade || {}).filter(
    (k) => statusMaps.trade[k]
  ).length;

  counts.total = counts.owned + counts.wishlist + counts.backlog + counts.trade;

  return counts;
}

/**
 * Calculate bar width for progress display.
 * @param {number} count - Current count
 * @param {number} total - Total count
 * @returns {string} CSS width value
 */
export function calculateBarWidth(count, total) {
  if (!total || total <= 0) return "0%";
  const percent = (count / total) * 100;
  if (count > 0 && percent < 1) return "1%";
  return `${Math.min(percent, 100).toFixed(1)}%`;
}

/**
 * Format status summary string.
 * @param {Object} counts - Status counts object
 * @returns {string} Formatted summary
 */
export function formatStatusSummary(counts) {
  if (!counts) return "";
  const parts = [];
  if (counts.owned > 0) parts.push(`Owned: ${counts.owned}`);
  if (counts.wishlist > 0) parts.push(`Wishlist: ${counts.wishlist}`);
  if (counts.backlog > 0) parts.push(`Backlog: ${counts.backlog}`);
  if (counts.trade > 0) parts.push(`Trade: ${counts.trade}`);
  return parts.join(" | ");
}

// === Stat Card Markup Builders ===

/**
 * Build stat card value markup.
 * @param {number|string} value - Display value
 * @param {string} [label] - Optional label
 * @returns {string} HTML string
 */
export function buildStatValue(value, label) {
  const displayValue = escapeHtml(String(value ?? "0"));
  const labelHtml = label ? `<span class="stat-label">${escapeHtml(label)}</span>` : "";
  return `<span class="stat-value">${displayValue}</span>${labelHtml}`;
}

/**
 * Build trend indicator markup.
 * @param {number} amount - Change amount
 * @param {'up'|'down'} direction - Trend direction
 * @param {string} [period='this month'] - Time period
 * @returns {string} HTML string
 */
export function buildTrendIndicator(amount, direction, period = "this month") {
  const icon = direction === "up" ? "↗" : "↘";
  const className = direction === "up" ? "" : "down";
  const formattedAmount = formatCurrency(Math.abs(amount));

  return [
    `<div class="stat-card-trend ${className}">`,
    `<span aria-hidden="true">${icon}</span>`,
    `<span>${formattedAmount} ${escapeHtml(period)}</span>`,
    "</div>",
  ].join("");
}

/**
 * Build progress bar markup.
 * @param {number} percentage - Completion percentage
 * @param {string} [id] - Optional ID for the bar
 * @returns {string} HTML string
 */
export function buildProgressBar(percentage, id) {
  const safePercent = Math.min(100, Math.max(0, percentage || 0));
  const idAttr = id ? `id="${escapeHtml(id)}"` : "";

  return [
    '<div class="stat-progress" role="progressbar"',
    ` aria-valuenow="${safePercent}" aria-valuemin="0" aria-valuemax="100">`,
    `<div class="stat-progress-fill" ${idAttr} style="width: ${safePercent}%"></div>`,
    "</div>",
  ].join("");
}

/**
 * Build carousel cover item markup.
 * @param {Object} game - Game data
 * @param {Object} [options={}] - Options
 * @returns {string} HTML string
 */
export function buildCarouselCover(game, options = {}) {
  const { coverField = "cover", nameField = "game_name", idField = "id" } = options;

  const cover = game?.[coverField] || "/placeholder.png";
  const name = game?.[nameField] || "Game";
  const id = game?.[idField] || "";

  return [
    `<div class="carousel-cover" role="button" tabindex="0" data-game-id="${escapeHtml(String(id))}">`,
    `<img src="${escapeHtml(cover)}" alt="${escapeHtml(name)}" loading="lazy" />`,
    "</div>",
  ].join("");
}

/**
 * Build recent additions carousel markup.
 * @param {Object[]} games - Array of recent games
 * @param {number} [limit=5] - Maximum games to show
 * @returns {string} HTML string
 */
export function buildRecentAdditionsCarousel(games, limit = 5) {
  if (!Array.isArray(games) || games.length === 0) {
    return '<span class="carousel-empty">No recent additions</span>';
  }

  return games
    .slice(0, limit)
    .map((game) => buildCarouselCover(game))
    .join("");
}

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
 * @param {Object} priceData - Price data keyed by game key
 * @returns {Object} Statistics object
 */
export function calculateStats(games, owned, statuses = {}, priceData = {}) {
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
    gamesWithPrices: 0,
  };

  // Calculate owned games stats
  ownedGames.forEach((game) => {
    // Platform breakdown
    if (!stats.platformBreakdown[game.platform]) {
      stats.platformBreakdown[game.platform] = 0;
    }
    stats.platformBreakdown[game.platform]++;

    // Calculate value from price data (use CIB price as default)
    const gameKey = generateGameKey(game.game_name, game.platform);
    const prices = priceData[gameKey];
    if (prices && prices.cib) {
      // Convert cents to dollars
      stats.totalValue += prices.cib / 100;
      stats.gamesWithPrices++;
    } else if (prices && prices.loose) {
      stats.totalValue += prices.loose / 100;
      stats.gamesWithPrices++;
    }
  });

  // Recent additions (most recently added to owned)
  stats.recentAdditions = ownedGames.slice(-5).reverse();

  // Wishlist and backlog (from statuses object)
  if (statuses.wishlist) {
    const wishlistKeys = Object.keys(statuses.wishlist).filter(
      (k) => statuses.wishlist[k]
    );
    stats.wishlistCount = wishlistKeys.length;
    // Calculate wishlist value (use new price for items you want to buy)
    wishlistKeys.forEach((gameKey) => {
      const prices = priceData[gameKey];
      if (prices) {
        const price = prices.new || prices.cib || prices.loose || 0;
        stats.wishlistValue += price / 100;
      }
    });
  }

  if (statuses.backlog) {
    stats.backlogCount = Object.keys(statuses.backlog).filter(
      (k) => statuses.backlog[k]
    ).length;
  }

  return stats;
}
