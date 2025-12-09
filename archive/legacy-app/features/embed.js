/**
 * Embeddable Game Widget
 * Generates shareable HTML widgets for individual games that can be embedded on external sites.
 * Supports SEO backlinks and promotes the Retro Games collection.
 * @module features/embed
 */

import { escapeHtml } from "../utils/dom.js";
import { formatCurrency, formatRating } from "../utils/format.js";

// === Constants ===

/**
 * Default widget dimensions
 */
export const WIDGET_SIZES = {
  small: { width: 250, height: 150 },
  medium: { width: 350, height: 200 },
  large: { width: 450, height: 280 },
};

/**
 * Widget themes
 */
export const WIDGET_THEMES = {
  dark: {
    bg: "#0a0e14",
    bgSecondary: "#14181f",
    text: "#e4e7eb",
    textSecondary: "#8b929b",
    accent: "#00d4ff",
    border: "rgba(0, 212, 255, 0.2)",
  },
  light: {
    bg: "#ffffff",
    bgSecondary: "#f5f5f5",
    text: "#1a1f29",
    textSecondary: "#666666",
    accent: "#0066cc",
    border: "rgba(0, 0, 0, 0.1)",
  },
};

/**
 * Base URL for the widget source attribution
 */
export const WIDGET_SOURCE_URL = "https://retro-games.example.com";

// === Widget Builders ===

/**
 * Generate CSS styles for embed widget
 * @param {Object} theme - Theme colors object
 * @param {Object} size - Size dimensions object
 * @returns {string} CSS styles
 */
export function generateWidgetStyles(theme, size) {
  return `
    .rg-widget {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${theme.bg};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 16px;
      width: ${size.width}px;
      max-width: 100%;
      box-sizing: border-box;
      color: ${theme.text};
      display: flex;
      gap: 16px;
    }
    .rg-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    .rg-widget-cover {
      width: 80px;
      height: 110px;
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
      background: ${theme.bgSecondary};
    }
    .rg-widget-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .rg-widget-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .rg-widget-title {
      font-size: 14px;
      font-weight: 600;
      color: ${theme.text};
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .rg-widget-platform {
      font-size: 12px;
      color: ${theme.accent};
      font-weight: 500;
    }
    .rg-widget-meta {
      font-size: 11px;
      color: ${theme.textSecondary};
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .rg-widget-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .rg-widget-rating {
      color: #ffc107;
    }
    .rg-widget-price {
      margin-top: auto;
      font-size: 13px;
      font-weight: 600;
      color: ${theme.text};
    }
    .rg-widget-source {
      font-size: 10px;
      color: ${theme.textSecondary};
      text-decoration: none;
      margin-top: 4px;
      display: block;
    }
    .rg-widget-source:hover {
      color: ${theme.accent};
    }
  `;
}

/**
 * Build widget HTML for a game
 * @param {Object} game - Game data object
 * @param {Object} options - Widget options
 * @param {string} [options.size='medium'] - Widget size (small, medium, large)
 * @param {string} [options.theme='dark'] - Widget theme (dark, light)
 * @param {boolean} [options.showPrice=true] - Show price information
 * @param {boolean} [options.showRating=true] - Show rating
 * @param {string} [options.sourceUrl] - Attribution URL
 * @returns {string} Widget HTML
 */
export function buildGameWidget(game, options = {}) {
  const {
    size = "medium",
    theme = "dark",
    showPrice = true,
    showRating = true,
    sourceUrl = WIDGET_SOURCE_URL,
  } = options;

  const themeColors = WIDGET_THEMES[theme] || WIDGET_THEMES.dark;
  const sizeConfig = WIDGET_SIZES[size] || WIDGET_SIZES.medium;
  const styles = generateWidgetStyles(themeColors, sizeConfig);

  const gameName = escapeHtml(game.game_name || game.name || "Unknown Game");
  const platform = escapeHtml(game.platform || "");
  const genre = escapeHtml(game.genre || "");
  const year = game.release_year || game.year || "";
  const rating = parseFloat(game.rating) || 0;
  const cover = game.cover || "";
  const loosePrice = game.loose_price || game.price_loose || 0;
  const cibPrice = game.cib_price || game.price_cib || 0;

  const coverHtml = cover
    ? `<img src="${escapeHtml(cover)}" alt="${gameName} cover" loading="lazy">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${themeColors.textSecondary};font-size:10px;">No Cover</div>`;

  const ratingHtml =
    showRating && rating > 0
      ? `<span class="rg-widget-rating">★ ${formatRating(rating)}</span>`
      : "";

  const priceHtml =
    showPrice && (loosePrice > 0 || cibPrice > 0)
      ? `<div class="rg-widget-price">
           ${loosePrice > 0 ? `Loose: ${formatCurrency(loosePrice)}` : ""}
           ${loosePrice > 0 && cibPrice > 0 ? " · " : ""}
           ${cibPrice > 0 ? `CIB: ${formatCurrency(cibPrice)}` : ""}
         </div>`
      : "";

  return `
<style>${styles}</style>
<div class="rg-widget">
  <div class="rg-widget-cover">${coverHtml}</div>
  <div class="rg-widget-info">
    <div class="rg-widget-title">${gameName}</div>
    <div class="rg-widget-platform">${platform}</div>
    <div class="rg-widget-meta">
      ${year ? `<span>📅 ${year}</span>` : ""}
      ${genre ? `<span>🎮 ${genre}</span>` : ""}
      ${ratingHtml}
    </div>
    ${priceHtml}
    <a class="rg-widget-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">
      Powered by Retro Games Hub
    </a>
  </div>
</div>`.trim();
}

/**
 * Build an iframe embed code for a game widget
 * @param {Object} game - Game data object
 * @param {Object} options - Widget options
 * @returns {string} Iframe HTML code
 */
export function buildIframeEmbed(game, options = {}) {
  const { size = "medium" } = options;
  const sizeConfig = WIDGET_SIZES[size] || WIDGET_SIZES.medium;
  const widgetHtml = buildGameWidget(game, options);

  // Base64 encode the widget HTML for data URI
  const encodedHtml = btoa(
    unescape(
      encodeURIComponent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;">${widgetHtml}</body></html>`
      )
    )
  );

  return `<iframe 
  src="data:text/html;base64,${encodedHtml}" 
  width="${sizeConfig.width + 20}" 
  height="${sizeConfig.height + 20}" 
  frameborder="0" 
  scrolling="no" 
  title="Retro Games Widget"
  style="border:none;max-width:100%;">
</iframe>`;
}

/**
 * Generate embed code for sharing (ready to copy)
 * @param {Object} game - Game data object
 * @param {Object} options - Widget options
 * @param {string} [options.format='html'] - Output format (html, iframe, markdown)
 * @returns {string} Embed code
 */
export function generateEmbedCode(game, options = {}) {
  const { format = "html", ...widgetOptions } = options;

  switch (format) {
    case "iframe":
      return buildIframeEmbed(game, widgetOptions);

    case "markdown": {
      const gameName = game.game_name || game.name || "Unknown Game";
      const platform = game.platform || "";
      const sourceUrl = widgetOptions.sourceUrl || WIDGET_SOURCE_URL;
      return `[![${gameName} (${platform})](${game.cover || ""})](${sourceUrl})`;
    }

    case "html":
    default:
      return buildGameWidget(game, widgetOptions);
  }
}

/**
 * Build a collection summary widget
 * @param {Object} stats - Collection statistics
 * @param {Object} options - Widget options
 * @returns {string} Widget HTML
 */
export function buildCollectionWidget(stats, options = {}) {
  const {
    theme = "dark",
    sourceUrl = WIDGET_SOURCE_URL,
    title = "My Retro Collection",
  } = options;

  const themeColors = WIDGET_THEMES[theme] || WIDGET_THEMES.dark;

  const styles = `
    .rg-collection-widget {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${themeColors.bg};
      border: 1px solid ${themeColors.border};
      border-radius: 12px;
      padding: 20px;
      width: 300px;
      max-width: 100%;
      box-sizing: border-box;
      color: ${themeColors.text};
    }
    .rg-collection-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    .rg-collection-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: ${themeColors.text};
    }
    .rg-collection-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .rg-collection-stat {
      text-align: center;
    }
    .rg-collection-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: ${themeColors.accent};
    }
    .rg-collection-stat-label {
      font-size: 11px;
      color: ${themeColors.textSecondary};
      margin-top: 4px;
    }
    .rg-collection-source {
      font-size: 10px;
      color: ${themeColors.textSecondary};
      text-decoration: none;
      margin-top: 16px;
      display: block;
      text-align: center;
    }
    .rg-collection-source:hover {
      color: ${themeColors.accent};
    }
  `;

  const totalGames = stats.ownedCount || stats.totalOwned || 0;
  const totalValue = stats.totalValue || 0;
  const platforms =
    stats.platformCount || Object.keys(stats.platformBreakdown || {}).length;
  const wishlist = stats.wishlistCount || 0;

  return `
<style>${styles}</style>
<div class="rg-collection-widget">
  <div class="rg-collection-title">${escapeHtml(title)}</div>
  <div class="rg-collection-stats">
    <div class="rg-collection-stat">
      <div class="rg-collection-stat-value">${totalGames}</div>
      <div class="rg-collection-stat-label">Games Owned</div>
    </div>
    <div class="rg-collection-stat">
      <div class="rg-collection-stat-value">${platforms}</div>
      <div class="rg-collection-stat-label">Platforms</div>
    </div>
    <div class="rg-collection-stat">
      <div class="rg-collection-stat-value">${formatCurrency(totalValue)}</div>
      <div class="rg-collection-stat-label">Est. Value</div>
    </div>
    <div class="rg-collection-stat">
      <div class="rg-collection-stat-value">${wishlist}</div>
      <div class="rg-collection-stat-label">Wishlist</div>
    </div>
  </div>
  <a class="rg-collection-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">
    Track your collection at Retro Games Hub
  </a>
</div>`.trim();
}
