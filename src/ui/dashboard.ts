/**
 * Dashboard Component
 * Renders collection statistics
 */

import type { ComponentContext } from "./components";
import { mount } from "./components";
import { collectionStats, isLoading } from "../state/store";
import { effect } from "../core/signals";

/**
 * Initialize the dashboard
 */
export function initDashboard(ctx: ComponentContext): void {
  const { cleanup } = ctx;

  const unsub = effect(() => {
    const stats = collectionStats.get();
    const loading = isLoading.get();

    if (loading) return;

    updateOwnedCard(stats.ownedCount, stats.totalGames, stats.platformBreakdown);
    updateValueCard(stats.totalValue);
    updateWishlistCard(stats.wishlistCount);
    updateBacklogCard(stats.backlogCount);
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
function updateWishlistCard(count: number): void {
  const countEl = document.getElementById("wishlistCount");
  if (countEl) {
    countEl.textContent = formatNumber(count);
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
