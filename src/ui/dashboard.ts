/**
 * Dashboard Component
 * Renders collection statistics
 */

import type { ComponentContext } from "./components";
import { mount, escapeHtml } from "./components";
import { collectionStats, isLoading, collection, prices, games } from "../state/store";
import { effect } from "../core/signals";
import type { GameWithKey, PriceData } from "../core/types";

/**
 * Initialize the dashboard
 */
export function initDashboard(ctx: ComponentContext): void {
  const { cleanup } = ctx;

  const unsub = effect(() => {
    const stats = collectionStats.get();
    const loading = isLoading.get();

    if (loading) return;

    const allGames = games.get();
    const collectionMap = collection.get();
    const priceMap = prices.get();

    updateOwnedCard(stats.ownedCount, stats.totalGames, stats.platformBreakdown);
    updateValueCard(stats.totalValue);
    updateWishlistCard(stats.wishlistCount, allGames, collectionMap, priceMap);
    updateBacklogCard(stats.backlogCount);
    updateRecentAdditionsCard(allGames, collectionMap);
  });

  cleanup.push(unsub);
}

/**
 * Update owned games card
 */
function updateOwnedCard(
  count: number,
  total: number,
  breakdown: Map<string, number>
): void {
  const countEl = document.getElementById("ownedCount");
  const breakdownEl = document.getElementById("ownedPlatformBreakdown");
  const progressBar = document.getElementById("ownedProgressBar");

  if (countEl) {
    countEl.textContent = formatNumber(count);
  }

  if (breakdownEl) {
    const top = getTopPlatforms(breakdown, 2);
    breakdownEl.textContent =
      top.length > 0
        ? top.map((p) => `${p.percentage}% ${p.platform}`).join(" • ")
        : "No games yet";
  }

  if (progressBar) {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
  }
}

/**
 * Update collection value card
 */
function updateValueCard(value: number): void {
  const valueEl = document.getElementById("collectionValue");
  const trendEl = document.getElementById("valueTrend");

  if (valueEl) {
    valueEl.textContent = formatCurrency(value / 100); // Convert cents to dollars
  }

  if (trendEl) {
    // For now, show static trend
    trendEl.innerHTML = `<span aria-hidden="true">↗</span><span>Updated today</span>`;
  }
}

/**
 * Update wishlist card
 */
function updateWishlistCard(
  count: number,
  _allGames: GameWithKey[],
  collectionMap: Map<string, { status: string }>,
  priceMap: Map<string, PriceData>
): void {
  const countEl = document.getElementById("wishlistCount");
  const valueEl = document.getElementById("wishlistValue");

  if (countEl) {
    countEl.textContent = formatNumber(count);
  }

  if (valueEl) {
    // Calculate total wishlist value
    let wishlistValue = 0;
    collectionMap.forEach((entry, key) => {
      if (entry.status === "wishlist") {
        const price = priceMap.get(key);
        if (price?.loose) {
          wishlistValue += price.loose;
        }
      }
    });
    valueEl.textContent = `Est. ${formatCurrency(wishlistValue / 100)}`;
  }
}

/**
 * Update backlog card
 */
function updateBacklogCard(count: number): void {
  const countEl = document.getElementById("backlogCount");
  const hoursEl = document.getElementById("backlogHours");

  if (countEl) {
    countEl.textContent = formatNumber(count);
  }

  if (hoursEl) {
    // Estimate ~20 hours per game
    const hours = count * 20;
    hoursEl.textContent = `~${formatNumber(hours)} hours`;
  }
}

/**
 * Update recent additions card
 */
function updateRecentAdditionsCard(
  allGames: GameWithKey[],
  collectionMap: Map<string, { status: string; addedAt?: number }>
): void {
  const countEl = document.getElementById("recentCount");
  const carouselEl = document.getElementById("recentGamesCarousel");

  // Get recently added games (last 30 days), sorted by addedAt
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentGames: Array<{ game: GameWithKey; addedAt: number }> = [];

  collectionMap.forEach((entry, key) => {
    if (entry.status === "owned" && entry.addedAt && entry.addedAt > thirtyDaysAgo) {
      const game = allGames.find((g) => g.key === key);
      if (game) {
        recentGames.push({ game, addedAt: entry.addedAt });
      }
    }
  });

  // Sort by most recent first
  recentGames.sort((a, b) => b.addedAt - a.addedAt);
  const recent = recentGames.slice(0, 5);

  if (countEl) {
    countEl.textContent = formatNumber(recent.length);
  }

  if (carouselEl) {
    if (recent.length === 0) {
      carouselEl.innerHTML =
        '<span class="carousel-empty">Add games to see them here</span>';
    } else {
      carouselEl.innerHTML = recent
        .map(
          ({ game }) => `
          <div class="carousel-item" title="${escapeHtml(game.game_name)}">
            ${
              game.cover
                ? `<img class="carousel-cover" src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.game_name)}" loading="lazy" />`
                : `<div class="carousel-placeholder">${escapeHtml(game.game_name.charAt(0))}</div>`
            }
          </div>
        `
        )
        .join("");
    }
  }
}

/**
 * Get top platforms from breakdown
 */
function getTopPlatforms(
  breakdown: Map<string, number>,
  n: number
): Array<{ platform: string; count: number; percentage: number }> {
  const total = Array.from(breakdown.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(breakdown.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

/**
 * Format number with commas
 */
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format currency
 */
function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Mount the dashboard component
 */
export function mountDashboard(selector: string | HTMLElement): () => void {
  return mount(selector, initDashboard);
}
