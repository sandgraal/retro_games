/**
 * Dashboard Component v3.0
 * Collection statistics with worker-computed metrics
 */

import { effect, computed } from "../core/runtime";
import {
  collectionStats,
  gamesSignal,
  filteredGames,
  collectionSignal,
} from "../state/store.v3";
import { escapeHtml } from "./components.v3";
import type { CollectionStats, GameWithKey } from "../core/types.v3";

const DASHBOARD_STYLES = `
  .dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
  }
  
  .stat-card {
    position: relative;
    padding: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
  }
  
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--stat-color, var(--accent-primary, #00d4ff));
  }
  
  .stat-card--owned { --stat-color: #22c55e; }
  .stat-card--wishlist { --stat-color: #f59e0b; }
  .stat-card--backlog { --stat-color: #3b82f6; }
  .stat-card--trade { --stat-color: #8b5cf6; }
  .stat-card--total { --stat-color: #00d4ff; }
  
  .stat-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .stat-card__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-card__icon {
    font-size: 1.25rem;
  }
  
  .stat-card__value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--stat-color);
    line-height: 1;
    margin-bottom: 4px;
  }
  
  .stat-card__subtitle {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }
  
  .stat-card__chart {
    margin-top: 16px;
    height: 60px;
  }
  
  .stat-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    margin-top: 16px;
  }
  
  .stat-bar__segment {
    height: 100%;
    transition: width 0.3s ease;
  }
  
  .stat-bar__segment--owned { background: #22c55e; }
  .stat-bar__segment--wishlist { background: #f59e0b; }
  .stat-bar__segment--backlog { background: #3b82f6; }
  .stat-bar__segment--trade { background: #8b5cf6; }
  
  .stat-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
  }
  
  .stat-legend__item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .stat-legend__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .stat-legend__dot--owned { background: #22c55e; }
  .stat-legend__dot--wishlist { background: #f59e0b; }
  .stat-legend__dot--backlog { background: #3b82f6; }
  .stat-legend__dot--trade { background: #8b5cf6; }
  
  .platform-breakdown {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  
  .platform-item {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    text-align: center;
  }
  
  .platform-item__name {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 4px;
  }
  
  .platform-item__count {
    font-size: 1rem;
    font-weight: 600;
    color: white;
  }
  
  .recent-additions {
    margin-top: 16px;
  }
  
  .recent-additions__title {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  
  .recent-additions__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .recent-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .recent-item__platform {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.4);
  }
`;

interface DashboardStats extends CollectionStats {
  recentlyAdded: GameWithKey[];
  platformBreakdown: Map<string, number>;
}

export function initDashboard(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  // Inject styles
  const style = document.createElement("style");
  style.textContent = DASHBOARD_STYLES;
  document.head.appendChild(style);
  cleanups.push(() => style.remove());

  // Create dashboard container
  const dashboardEl = document.createElement("section");
  dashboardEl.className = "dashboard";
  dashboardEl.setAttribute("aria-label", "Collection Statistics");

  container.appendChild(dashboardEl);
  cleanups.push(() => dashboardEl.remove());

  // Compute extended stats
  const extendedStats = computed((): DashboardStats => {
    const stats = collectionStats();
    const games = gamesSignal();
    const collection = collectionSignal();

    // Get recently added (from owned collection)
    const ownedGames: GameWithKey[] = [];
    for (const game of games) {
      if (collection.get(game.key)?.status === "owned") {
        ownedGames.push(game);
      }
    }
    const recentlyAdded = ownedGames.slice(0, 5);

    // Platform breakdown for owned games
    const platformBreakdown = new Map<string, number>();
    for (const game of ownedGames) {
      const count = platformBreakdown.get(game.platform) || 0;
      platformBreakdown.set(game.platform, count + 1);
    }

    return {
      ...stats,
      recentlyAdded,
      platformBreakdown,
    };
  });

  function render(): void {
    const stats = extendedStats();
    const totalInCollection = stats.owned + stats.wishlist + stats.backlog + stats.trade;

    // Calculate percentages
    const getPercent = (value: number) =>
      totalInCollection > 0 ? ((value / totalInCollection) * 100).toFixed(1) : "0";

    dashboardEl.innerHTML = `
      <div class="stat-card stat-card--total">
        <div class="stat-card__header">
          <span class="stat-card__title">
            <span class="stat-card__icon">🎮</span>
            Total Games
          </span>
        </div>
        <div class="stat-card__value">${stats.total.toLocaleString()}</div>
        <div class="stat-card__subtitle">in database</div>
        
        <div class="stat-bar">
          <div class="stat-bar__segment stat-bar__segment--owned" 
               style="width: ${getPercent(stats.owned)}%"
               title="Owned: ${stats.owned}"></div>
          <div class="stat-bar__segment stat-bar__segment--wishlist" 
               style="width: ${getPercent(stats.wishlist)}%"
               title="Wishlist: ${stats.wishlist}"></div>
          <div class="stat-bar__segment stat-bar__segment--backlog" 
               style="width: ${getPercent(stats.backlog)}%"
               title="Backlog: ${stats.backlog}"></div>
          <div class="stat-bar__segment stat-bar__segment--trade" 
               style="width: ${getPercent(stats.trade)}%"
               title="For Trade: ${stats.trade}"></div>
        </div>
        
        <div class="stat-legend">
          <span class="stat-legend__item">
            <span class="stat-legend__dot stat-legend__dot--owned"></span>
            Owned (${stats.owned})
          </span>
          <span class="stat-legend__item">
            <span class="stat-legend__dot stat-legend__dot--wishlist"></span>
            Wishlist (${stats.wishlist})
          </span>
          <span class="stat-legend__item">
            <span class="stat-legend__dot stat-legend__dot--backlog"></span>
            Backlog (${stats.backlog})
          </span>
          <span class="stat-legend__item">
            <span class="stat-legend__dot stat-legend__dot--trade"></span>
            Trade (${stats.trade})
          </span>
        </div>
      </div>
      
      <div class="stat-card stat-card--owned">
        <div class="stat-card__header">
          <span class="stat-card__title">
            <span class="stat-card__icon">✓</span>
            Owned
          </span>
        </div>
        <div class="stat-card__value">${stats.owned.toLocaleString()}</div>
        <div class="stat-card__subtitle">games in your collection</div>
        
        ${
          stats.owned > 0 && stats.platformBreakdown.size > 0
            ? `
          <div class="platform-breakdown">
            ${Array.from(stats.platformBreakdown.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(
                ([platform, count]) => `
                <div class="platform-item">
                  <div class="platform-item__name">${escapeHtml(platform)}</div>
                  <div class="platform-item__count">${count}</div>
                </div>
              `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
      
      <div class="stat-card stat-card--wishlist">
        <div class="stat-card__header">
          <span class="stat-card__title">
            <span class="stat-card__icon">★</span>
            Wishlist
          </span>
        </div>
        <div class="stat-card__value">${stats.wishlist.toLocaleString()}</div>
        <div class="stat-card__subtitle">games you want</div>
      </div>
      
      <div class="stat-card stat-card--backlog">
        <div class="stat-card__header">
          <span class="stat-card__title">
            <span class="stat-card__icon">📚</span>
            Backlog
          </span>
        </div>
        <div class="stat-card__value">${stats.backlog.toLocaleString()}</div>
        <div class="stat-card__subtitle">games to play</div>
      </div>
      
      ${
        stats.recentlyAdded.length > 0
          ? `
        <div class="stat-card">
          <div class="stat-card__header">
            <span class="stat-card__title">
              <span class="stat-card__icon">🕐</span>
              Recent Additions
            </span>
          </div>
          <div class="recent-additions__list">
            ${stats.recentlyAdded
              .map(
                (game) => `
              <div class="recent-item">
                <span>${escapeHtml(game.game_name)}</span>
                <span class="recent-item__platform">${escapeHtml(game.platform)}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    `;
  }

  // Watch for state changes
  const disposeEffect = effect(() => {
    extendedStats(); // Subscribe
    render();
  });
  cleanups.push(disposeEffect);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// === Quick Stats Component (minimal version) ===

export function initQuickStats(container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  const statsEl = document.createElement("div");
  statsEl.className = "quick-stats";
  statsEl.innerHTML = `
    <style>
      .quick-stats {
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        font-size: 0.875rem;
      }
      
      .quick-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        color: rgba(255, 255, 255, 0.7);
      }
      
      .quick-stat__value {
        font-weight: 600;
        color: white;
      }
    </style>
    <div class="quick-stat">
      <span>Total:</span>
      <span class="quick-stat__value" data-stat="total">0</span>
    </div>
    <div class="quick-stat">
      <span>Owned:</span>
      <span class="quick-stat__value" data-stat="owned">0</span>
    </div>
    <div class="quick-stat">
      <span>Wishlist:</span>
      <span class="quick-stat__value" data-stat="wishlist">0</span>
    </div>
  `;

  container.appendChild(statsEl);
  cleanups.push(() => statsEl.remove());

  const disposeEffect = effect(() => {
    const stats = collectionStats();

    const totalEl = statsEl.querySelector('[data-stat="total"]');
    const ownedEl = statsEl.querySelector('[data-stat="owned"]');
    const wishlistEl = statsEl.querySelector('[data-stat="wishlist"]');

    if (totalEl) totalEl.textContent = stats.total.toLocaleString();
    if (ownedEl) ownedEl.textContent = stats.owned.toLocaleString();
    if (wishlistEl) wishlistEl.textContent = stats.wishlist.toLocaleString();
  });
  cleanups.push(disposeEffect);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
