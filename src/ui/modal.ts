/**
 * Modal Component
 * Beautiful game detail modal with guides integration
 */

import type {
  GameWithKey,
  CollectionStatus,
  ExternalLinks,
  PriceData,
  PricingSource,
  PriceAlert,
} from "../core/types";
import type { ComponentContext } from "./components";
import { mount, escapeHtml, sanitizeUrl } from "./components";
import {
  modalGame,
  closeGameModal,
  setGameStatus,
  getGameStatus,
  getGameNotes,
  setGameNotes,
  prices,
  priceMeta,
  getPriceAlert,
  setPriceAlert,
  removePriceAlert,
} from "../state/store";
import { effect } from "../core/signals";
import { buildGuideIndex, type GuideMetadata } from "../data/guides";
import { formatCurrency, formatRelativeDate, formatAbsoluteDate } from "../utils/format";
import { submitEditSuggestion } from "../data/suggestions";
import { fetchPriceHistory, type PriceHistoryPoint } from "../data/pricing-provider";

// Platform name mapping for guide matching
const PLATFORM_TO_GUIDE: Record<string, string> = {
  "Atari 2600": "Atari 2600/7800",
  "Atari 7800": "Atari 2600/7800",
  Dreamcast: "Dreamcast",
  "Game Boy": "Game Boy",
  "Game Boy Color": "Game Boy",
  "Game Boy Advance": "Game Boy",
  GameCube: "GameCube",
  "Sega Genesis": "Genesis",
  Genesis: "Genesis",
  "Mega Drive": "Genesis",
  "Master System": "Master System",
  "Sega Master System": "Master System",
  "Nintendo 64": "Nintendo 64",
  N64: "Nintendo 64",
  "Neo Geo": "Neo Geo",
  "Neo Geo AES": "Neo Geo",
  "Neo Geo CD": "Neo Geo",
  NES: "NES",
  "Nintendo Entertainment System": "NES",
  PlayStation: "PlayStation",
  PS1: "PlayStation",
  PSX: "PlayStation",
  "PlayStation 2": "PlayStation 2",
  PS2: "PlayStation 2",
  PSP: "PSP",
  "PlayStation Portable": "PSP",
  Saturn: "Saturn",
  "Sega Saturn": "Saturn",
  SNES: "SNES",
  "Super Nintendo": "SNES",
  "Super Famicom": "SNES",
  "TurboGrafx-16": "TurboGrafx-16",
  "PC Engine": "TurboGrafx-16",
  Wii: "Wii",
  "Nintendo Wii": "Wii",
};

// Genre mapping for guide matching
const GENRE_TO_GUIDE: Record<string, string> = {
  RPG: "RPG",
  "Role-Playing": "RPG",
  JRPG: "RPG",
  "Action RPG": "RPG",
  Platformer: "Platformer",
  Platform: "Platformer",
  "Action Platformer": "Platformer",
};

let guideIndex: GuideMetadata[] = [];

/**
 * Initialize the modal
 */
export function initModal(ctx: ComponentContext): void {
  const { element, cleanup } = ctx;

  // Build guide index once
  guideIndex = buildGuideIndex();

  // Subscribe to modal game
  const unsub = effect(() => {
    const game = modalGame.get();

    if (game) {
      renderModal(element, game);
      // Remove hidden attribute and update aria for accessibility
      element.removeAttribute("hidden");
      element.setAttribute("aria-hidden", "false");
      element.classList.add("open");
      document.body.style.overflow = "hidden";
      trapFocus(element);

      // Load price history chart asynchronously
      loadPriceChart(game.key);
    } else {
      // Add hidden attribute and update aria for accessibility
      element.setAttribute("hidden", "");
      element.setAttribute("aria-hidden", "true");
      element.classList.remove("open");
      document.body.style.overflow = "";
    }
  });
  cleanup.push(unsub);

  // Close on backdrop click
  element.addEventListener("click", (e) => {
    if (e.target === element) {
      closeGameModal();
    }
  });

  // Close on escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && modalGame.get()) {
      closeGameModal();
    }
  };
  document.addEventListener("keydown", escHandler);
  cleanup.push(() => document.removeEventListener("keydown", escHandler));
}

/**
 * Get relevant guides for a game
 */
function getRelevantGuides(game: GameWithKey): GuideMetadata[] {
  const guides: GuideMetadata[] = [];

  // Find platform guide
  const guidePlatform = PLATFORM_TO_GUIDE[game.platform];
  if (guidePlatform) {
    const platformGuides = guideIndex.filter(
      (g) => g.platform === guidePlatform && g.category === "console"
    );
    guides.push(...platformGuides);
  }

  // Find genre guide
  if (game.genre) {
    const guideGenre = GENRE_TO_GUIDE[game.genre];
    if (guideGenre) {
      const genreGuides = guideIndex.filter(
        (g) => g.genre === guideGenre && g.category === "genre"
      );
      guides.push(...genreGuides);
    }
  }

  return guides;
}

/**
 * Get status icon and color
 */
function getStatusInfo(status: CollectionStatus): {
  icon: string;
  label: string;
  class: string;
} {
  const statusMap: Record<
    CollectionStatus,
    { icon: string; label: string; class: string }
  > = {
    none: { icon: "○", label: "Not in collection", class: "status-none" },
    owned: { icon: "✓", label: "Owned", class: "status-owned" },
    wishlist: { icon: "★", label: "Wishlist", class: "status-wishlist" },
    backlog: { icon: "📋", label: "Backlog", class: "status-backlog" },
    trade: { icon: "↔", label: "For Trade", class: "status-trade" },
  };
  return statusMap[status] || statusMap.none;
}

/**
 * Render modal content into existing HTML structure
 */
function renderModal(backdrop: HTMLElement, game: GameWithKey): void {
  const status = getGameStatus(game.key);
  const notes = getGameNotes(game.key);
  const rating = parseFloat(String(game.rating));
  const statusInfo = getStatusInfo(status);
  const relevantGuides = getRelevantGuides(game);
  const priceInfo = prices.get().get(game.key);
  const pricingInfo = priceMeta.get();

  // Update modal title
  const titleEl = backdrop.querySelector("#gameModalTitle");
  if (titleEl) {
    titleEl.textContent = game.game_name;
  }

  // Update cover image
  const coverImg = backdrop.querySelector("#gameModalCoverImage") as HTMLImageElement;
  if (coverImg) {
    if (game.cover) {
      coverImg.src = game.cover;
      coverImg.alt = `${game.game_name} cover art`;
      coverImg.style.display = "";
      coverImg.parentElement?.classList.remove("no-cover");
    } else {
      coverImg.style.display = "none";
      coverImg.parentElement?.classList.add("no-cover");
    }
  }

  // Update cover actions with beautiful status buttons
  const actionsEl = backdrop.querySelector("#gameModalActions");
  if (actionsEl) {
    actionsEl.innerHTML = `
      <div class="modal-status-buttons">
        <button type="button" class="modal-status-btn ${status === "owned" ? "active" : ""}" data-status="owned" title="Mark as Owned">
          <span class="status-icon" aria-hidden="true">✓</span>
          <span class="status-label">Owned</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "wishlist" ? "active" : ""}" data-status="wishlist" title="Add to Wishlist">
          <span class="status-icon" aria-hidden="true">★</span>
          <span class="status-label">Wishlist</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "backlog" ? "active" : ""}" data-status="backlog" title="Add to Backlog">
          <span class="status-icon" aria-hidden="true">📋</span>
          <span class="status-label">Backlog</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "trade" ? "active" : ""}" data-status="trade" title="Mark for Trade">
          <span class="status-icon" aria-hidden="true">↔</span>
          <span class="status-label">Trade</span>
        </button>
      </div>
    `;

    // Setup status buttons
    actionsEl.querySelectorAll<HTMLElement>(".modal-status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const newStatus = btn.dataset.status as CollectionStatus;
        const currentStatus = getGameStatus(game.key);
        // Toggle off if clicking same status
        const finalStatus = currentStatus === newStatus ? "none" : newStatus;
        setGameStatus(game.key, finalStatus);

        // Update UI
        actionsEl.querySelectorAll<HTMLElement>(".modal-status-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.status === finalStatus);
        });

        // Update status badge
        const badgeEl = backdrop.querySelector(".modal-status-badge");
        if (badgeEl) {
          const info = getStatusInfo(finalStatus);
          badgeEl.className = `modal-status-badge ${info.class}`;
          badgeEl.innerHTML = `<span>${info.icon}</span> ${info.label}`;
        }
      });
    });
  }

  // Update details section with enhanced layout
  const detailsEl = backdrop.querySelector("#gameModalDetails");
  if (detailsEl) {
    const pricingSection = buildPricingSection(
      priceInfo,
      pricingInfo,
      game.game_name,
      game.key,
      game.platform
    );
    const externalLinks = buildExternalLinks(game);
    const metadataPanel = buildExtendedMetadata(game);

    detailsEl.innerHTML = `
      <div class="modal-status-badge ${statusInfo.class}">
        <span>${statusInfo.icon}</span> ${statusInfo.label}
      </div>

      <div class="modal-info-grid">
        <div class="modal-info-item">
          <span class="modal-info-icon">🎮</span>
          <div class="modal-info-content">
            <span class="modal-info-label">Platform</span>
            <span class="modal-info-value">${escapeHtml(game.platform)}</span>
          </div>
        </div>
        
        ${
          game.genre
            ? `
        <div class="modal-info-item">
          <span class="modal-info-icon">🏷️</span>
          <div class="modal-info-content">
            <span class="modal-info-label">Genre</span>
            <span class="modal-info-value">${escapeHtml(game.genre)}</span>
          </div>
        </div>
        `
            : ""
        }
        
        ${
          game.release_year
            ? `
        <div class="modal-info-item">
          <span class="modal-info-icon">📅</span>
          <div class="modal-info-content">
            <span class="modal-info-label">Released</span>
            <span class="modal-info-value">${escapeHtml(String(game.release_year))}</span>
          </div>
        </div>
        `
            : ""
        }
        
        ${
          isNaN(rating)
            ? ""
            : `
                  <div class="modal-info-item">
                    <span class="modal-info-icon">⭐</span>
                    <div class="modal-info-content">
                      <span class="modal-info-label">Rating</span>
                      <span class="modal-info-value">${rating.toFixed(1)} / 10</span>
                    </div>
                  </div>
                  `
        }
        
        ${
          game.region
            ? `
        <div class="modal-info-item">
          <span class="modal-info-icon">🌍</span>
          <div class="modal-info-content">
            <span class="modal-info-label">Region</span>
            <span class="modal-info-value">${escapeHtml(game.region)}</span>
          </div>
        </div>
        `
            : ""
        }
        
        ${
          game.player_mode
            ? `
        <div class="modal-info-item">
          <span class="modal-info-icon">👥</span>
          <div class="modal-info-content">
            <span class="modal-info-label">Players</span>
            <span class="modal-info-value">${escapeHtml(game.player_mode)}</span>
          </div>
        </div>
        `
            : ""
        }
      </div>

      ${pricingSection}

      <div class="modal-notes">
        <label for="notesInput" class="modal-notes-label">
          <span class="modal-notes-icon">📝</span>
          Your Notes
        </label>
        <textarea id="notesInput" class="modal-notes-input" rows="3" placeholder="Add personal notes about this game...">${escapeHtml(notes)}</textarea>
      </div>

      ${externalLinks}
      ${metadataPanel}
      ${buildSuggestEditSection(game)}
    `;

    // Setup notes input with auto-save indicator
    const notesInput = detailsEl.querySelector("#notesInput") as HTMLTextAreaElement;
    if (notesInput) {
      let saveTimeout: ReturnType<typeof setTimeout>;
      notesInput.addEventListener("input", () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          setGameNotes(game.key, notesInput.value);
        }, 500);
      });
      notesInput.addEventListener("blur", () => {
        clearTimeout(saveTimeout);
        setGameNotes(game.key, notesInput.value);
      });
    }

    // Setup price alert handlers
    setupPriceAlertHandlers(detailsEl as HTMLElement, game.key);

    // Setup suggest edit form
    setupSuggestEditForm(detailsEl as HTMLElement, game);
  }

  // Update guides section
  const guidesEl = backdrop.querySelector("#gameModalGuides");
  if (guidesEl) {
    if (relevantGuides.length > 0) {
      guidesEl.innerHTML = `
        <div class="modal-guides-header">
          <span class="modal-guides-icon">📚</span>
          <span class="modal-guides-title">Related Guides</span>
        </div>
        <div class="modal-guides-list">
          ${relevantGuides
            .map(
              (guide) => `
            <a href="?guide=${guide.slug}" class="modal-guide-card" data-guide-slug="${guide.slug}">
              <div class="guide-card-icon">${guide.type === "reference" ? "📖" : "💎"}</div>
              <div class="guide-card-content">
                <span class="guide-card-title">${escapeHtml(guide.title)}</span>
                <span class="guide-card-type">${guide.type === "reference" ? "Reference" : "Collecting Guide"}</span>
              </div>
              <span class="guide-card-arrow">→</span>
            </a>
          `
            )
            .join("")}
        </div>
      `;

      // Handle guide navigation
      guidesEl.querySelectorAll<HTMLElement>(".modal-guide-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          e.preventDefault();
          const slug = card.dataset.guideSlug;
          if (slug) {
            closeGameModal();
            // Navigate to guide - dispatch custom event that main.ts handles
            window.dispatchEvent(
              new CustomEvent("navigateToGuide", { detail: { slug } })
            );
          }
        });
      });
    } else {
      guidesEl.innerHTML = "";
    }
  }

  // Setup close button (might already have listener but re-add for safety)
  const closeBtn = backdrop.querySelector("#gameModalClose");
  closeBtn?.addEventListener("click", closeGameModal);
}

/** Platforms that are primarily digital-only (no physical media pricing) */
const DIGITAL_ONLY_PLATFORMS = new Set([
  "PC",
  "Steam",
  "GOG",
  "Epic",
  "iOS",
  "Android",
  "Apple Arcade",
  "Quest",
  "Meta Quest",
  "SteamVR",
  "itch.io",
  "Linux",
  "Mac",
  "Windows",
  "Browser",
  "Web",
]);

/** Platforms where we have physical game pricing coverage */
const RETRO_PHYSICAL_PLATFORMS = new Set([
  "NES",
  "SNES",
  "N64",
  "GameCube",
  "Wii",
  "Game Boy",
  "Game Boy Color",
  "Game Boy Advance",
  "Nintendo DS",
  "PS1",
  "PS2",
  "PS3",
  "PSP",
  "Genesis",
  "Sega Genesis",
  "Dreamcast",
  "Saturn",
  "Master System",
  "Atari 2600",
  "Atari 7800",
  "Neo Geo",
  "TurboGrafx-16",
  "Xbox",
  "Xbox 360",
]);

/**
 * Build price lookup links for games without pricing data
 */
function buildPriceLookupLinks(gameName: string, platform: string): string {
  const encodedName = encodeURIComponent(gameName);
  const encodedSearch = encodeURIComponent(`${gameName} ${platform}`);

  const links: Array<{ label: string; url: string; icon: string }> = [];

  // Always offer eBay search for physical games
  if (!DIGITAL_ONLY_PLATFORMS.has(platform)) {
    links.push({
      label: "eBay",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodedSearch}&_sacat=139973`,
      icon: "🛒",
    });
    links.push({
      label: "PriceCharting",
      url: `https://www.pricecharting.com/search-products?q=${encodedSearch}`,
      icon: "📊",
    });
  }

  // Digital storefronts for PC/modern platforms
  if (
    platform === "PC" ||
    platform === "Steam" ||
    platform === "Windows" ||
    platform === "Mac" ||
    platform === "Linux"
  ) {
    links.push({
      label: "Steam",
      url: `https://store.steampowered.com/search/?term=${encodedName}`,
      icon: "🎮",
    });
    links.push({
      label: "GOG",
      url: `https://www.gog.com/games?query=${encodedName}`,
      icon: "🎁",
    });
    links.push({
      label: "IsThereAnyDeal",
      url: `https://isthereanydeal.com/search/?q=${encodedName}`,
      icon: "💰",
    });
  }

  // Console storefronts
  if (platform === "PS4" || platform === "PS5") {
    links.push({
      label: "PSN Store",
      url: `https://store.playstation.com/search/${encodedName}`,
      icon: "🎮",
    });
  }
  if (
    platform === "Xbox One" ||
    platform === "Xbox Series X/S" ||
    platform.startsWith("Xbox")
  ) {
    links.push({
      label: "Xbox Store",
      url: `https://www.xbox.com/games/all-games?query=${encodedName}`,
      icon: "🎮",
    });
  }
  if (platform === "Switch" || platform === "Nintendo Switch") {
    links.push({
      label: "Deku Deals",
      url: `https://www.dekudeals.com/search?q=${encodedName}`,
      icon: "💰",
    });
  }

  if (links.length === 0) return "";

  const linkItems = links
    .map(
      (link) => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="price-lookup-link">
        <span aria-hidden="true">${link.icon}</span>
        <span>${escapeHtml(link.label)}</span>
      </a>
    `
    )
    .join("");

  return `
    <div class="price-lookup-links">
      <span class="price-lookup-label">Check prices:</span>
      ${linkItems}
    </div>
  `;
}

/**
 * Get context-aware messaging for missing price data
 */
function getMissingPriceContext(platform: string): {
  message: string;
  suggestion: string;
} {
  if (DIGITAL_ONLY_PLATFORMS.has(platform)) {
    return {
      message: "Digital games have dynamic pricing across storefronts.",
      suggestion: "Use the links below to compare current prices.",
    };
  }

  if (RETRO_PHYSICAL_PLATFORMS.has(platform)) {
    return {
      message: "We're expanding our retro game pricing coverage.",
      suggestion: "Check eBay or PriceCharting for current market values.",
    };
  }

  // Modern physical platforms (PS4, PS5, Switch, Xbox One, etc.)
  return {
    message: "Physical and digital pricing varies by retailer.",
    suggestion: "Check storefronts or secondary market for current prices.",
  };
}

function buildPricingSection(
  price: PriceData | undefined,
  meta: { lastUpdated?: string; source: PricingSource; reason?: string },
  gameName: string,
  gameKey: string,
  platform?: string
): string {
  const updated = price?.lastUpdated ?? price?.snapshotDate ?? meta.lastUpdated;
  const updatedLabel = formatPricingTimestamp(updated);
  const fallbackLabel = updatedLabel ? `Updated ${escapeHtml(updatedLabel)}` : "";

  const header = `
    <div class="modal-pricing__header">
      <span class="modal-section-title" id="modalPricingHeading">Pricing</span>
      ${fallbackLabel ? `<span class="modal-pricing__timestamp" id="modalPricingUpdated">${fallbackLabel}</span>` : ""}
    </div>
  `;

  if (!price) {
    const platformName = platform ?? "";
    const context = getMissingPriceContext(platformName);
    const lookupLinks = buildPriceLookupLinks(gameName, platformName);

    return `
      <section class="modal-pricing modal-pricing--empty" aria-labelledby="modalPricingHeading">
        ${header}
        <div class="modal-pricing__empty-state">
          <p class="modal-pricing__empty-message">${escapeHtml(context.message)}</p>
          <p class="modal-pricing__empty-suggestion">${escapeHtml(context.suggestion)}</p>
          ${lookupLinks}
        </div>
      </section>
    `;
  }

  const priceBlocks = [
    price.loose !== undefined
      ? `<div class="price-item" role="listitem">
          <span class="price-label">Loose</span>
          <span class="price-value">${formatCurrency(price.loose, { fromCents: true })}</span>
        </div>`
      : "",
    price.cib !== undefined
      ? `<div class="price-item" role="listitem">
          <span class="price-label">Complete</span>
          <span class="price-value price-value--cib">${formatCurrency(price.cib, { fromCents: true })}</span>
        </div>`
      : "",
    price.new !== undefined
      ? `<div class="price-item" role="listitem">
          <span class="price-label">New</span>
          <span class="price-value price-value--new">${formatCurrency(price.new, { fromCents: true })}</span>
        </div>`
      : "",
  ].filter(Boolean);

  const offers = renderOffers(price.offers);

  // Build trend info if available
  const trendInfo = buildTrendInfo(price);

  // Build price alert UI
  const existingAlert = getPriceAlert(gameKey);
  const alertSection = buildPriceAlertSection(gameKey, price, existingAlert);

  return `
    <section class="modal-pricing" aria-labelledby="modalPricingHeading">
      ${header}
      <div class="modal-prices" role="group" aria-describedby="modalPricingUpdated">
        <div class="price-grid" role="list">
          ${priceBlocks.length > 0 ? priceBlocks.join("") : '<p class="modal-pricing__empty">No structured pricing found.</p>'}
        </div>
        ${trendInfo}
        <div class="price-chart-container" id="priceChartContainer" aria-label="Price history chart">
          <div class="price-chart-loading">Loading price history...</div>
        </div>
        ${alertSection}
        <p class="price-source">${escapeHtml(price.source ?? meta.source ?? "snapshot")}</p>
      </div>
      ${offers}
    </section>
  `;
}

/**
 * Build trend info showing all-time high/low and recent changes
 */
function buildTrendInfo(price: PriceData): string {
  const parts: string[] = [];

  if (price.allTimeLow !== undefined) {
    parts.push(
      `<span class="trend-stat trend-stat--low">All-Time Low: ${formatCurrency(price.allTimeLow, { fromCents: true })}</span>`
    );
  }
  if (price.allTimeHigh !== undefined) {
    parts.push(
      `<span class="trend-stat trend-stat--high">All-Time High: ${formatCurrency(price.allTimeHigh, { fromCents: true })}</span>`
    );
  }

  if (price.weekChangePct !== undefined) {
    const weekClass =
      price.weekChangePct > 0 ? "trend-up" : price.weekChangePct < 0 ? "trend-down" : "";
    const weekSign = price.weekChangePct > 0 ? "+" : "";
    parts.push(
      `<span class="trend-stat ${weekClass}">Week: ${weekSign}${price.weekChangePct.toFixed(1)}%</span>`
    );
  }

  if (price.monthChangePct !== undefined) {
    const monthClass =
      price.monthChangePct > 0
        ? "trend-up"
        : price.monthChangePct < 0
          ? "trend-down"
          : "";
    const monthSign = price.monthChangePct > 0 ? "+" : "";
    parts.push(
      `<span class="trend-stat ${monthClass}">Month: ${monthSign}${price.monthChangePct.toFixed(1)}%</span>`
    );
  }

  if (parts.length === 0) return "";

  return `<div class="price-trends">${parts.join("")}</div>`;
}

/**
 * Build price alert section for modal
 */
function buildPriceAlertSection(
  gameKey: string,
  price: PriceData,
  existingAlert: PriceAlert | undefined
): string {
  const currentLoose = price.loose
    ? formatCurrency(price.loose, { fromCents: true })
    : "N/A";

  if (existingAlert) {
    const targetPrice = formatCurrency(existingAlert.targetPriceCents, {
      fromCents: true,
    });
    const status = existingAlert.triggered
      ? `<span class="alert-triggered">🔔 Triggered!</span>`
      : `<span class="alert-active">⏳ Watching...</span>`;

    return `
      <div class="price-alert-section" data-game-key="${escapeHtml(gameKey)}">
        <div class="price-alert-header">
          <span class="price-alert-icon">🔔</span>
          <span class="price-alert-title">Price Alert Active</span>
        </div>
        <div class="price-alert-info">
          <span>Alert when ${existingAlert.condition} ≤ ${targetPrice}</span>
          ${status}
        </div>
        <button type="button" class="price-alert-remove" id="removeAlertBtn">
          Remove Alert
        </button>
      </div>
    `;
  }

  // No alert set - show form to create one
  const suggestedPrice = price.loose ? Math.round(price.loose * 0.8) : 0; // 20% below current

  return `
    <div class="price-alert-section" data-game-key="${escapeHtml(gameKey)}">
      <div class="price-alert-header">
        <span class="price-alert-icon">🔔</span>
        <span class="price-alert-title">Set Price Alert</span>
      </div>
      <div class="price-alert-form">
        <span class="price-alert-current">Current: ${currentLoose}</span>
        <label for="alertPriceInput" class="sr-only">Target price</label>
        <div class="price-alert-input-group">
          <span class="price-alert-currency">$</span>
          <input 
            type="number" 
            id="alertPriceInput" 
            class="price-alert-input" 
            placeholder="${(suggestedPrice / 100).toFixed(0)}"
            min="0"
            step="1"
            aria-label="Target price in dollars"
          />
        </div>
        <select id="alertConditionSelect" class="price-alert-condition" aria-label="Condition type">
          <option value="loose">Loose</option>
          <option value="cib">Complete</option>
          <option value="new">New</option>
        </select>
        <button type="button" class="price-alert-set" id="setAlertBtn">
          Set Alert
        </button>
      </div>
    </div>
  `;
}

/**
 * Setup event handlers for price alert UI
 */
function setupPriceAlertHandlers(container: HTMLElement, gameKey: string): void {
  const setBtn = container.querySelector("#setAlertBtn");
  const removeBtn = container.querySelector("#removeAlertBtn");

  if (setBtn) {
    setBtn.addEventListener("click", () => {
      const priceInput = container.querySelector("#alertPriceInput") as HTMLInputElement;
      const conditionSelect = container.querySelector(
        "#alertConditionSelect"
      ) as HTMLSelectElement;

      if (!priceInput?.value) return;

      const targetDollars = parseFloat(priceInput.value);
      if (isNaN(targetDollars) || targetDollars <= 0) return;

      const targetCents = Math.round(targetDollars * 100);
      const condition = (conditionSelect?.value as "loose" | "cib" | "new") || "loose";

      setPriceAlert(gameKey, targetCents, condition);

      // Update UI to show active alert
      const alertSection = container.querySelector(".price-alert-section");
      if (alertSection) {
        alertSection.innerHTML = `
          <div class="price-alert-header">
            <span class="price-alert-icon">🔔</span>
            <span class="price-alert-title">Price Alert Active</span>
          </div>
          <div class="price-alert-info">
            <span>Alert when ${condition} ≤ $${targetDollars.toFixed(0)}</span>
            <span class="alert-active">⏳ Watching...</span>
          </div>
          <button type="button" class="price-alert-remove" id="removeAlertBtn">
            Remove Alert
          </button>
        `;

        // Re-setup remove handler
        setupPriceAlertHandlers(container, gameKey);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      removePriceAlert(gameKey);

      // Update UI to show form
      const alertSection = container.querySelector(".price-alert-section");
      if (alertSection) {
        alertSection.innerHTML = `
          <div class="price-alert-header">
            <span class="price-alert-icon">🔔</span>
            <span class="price-alert-title">Set Price Alert</span>
          </div>
          <div class="price-alert-form">
            <span class="price-alert-current">Alert removed</span>
            <div class="price-alert-input-group">
              <span class="price-alert-currency">$</span>
              <input type="number" id="alertPriceInput" class="price-alert-input" placeholder="0" min="0" step="1" aria-label="Alert price in dollars" />
            </div>
            <select id="alertConditionSelect" class="price-alert-condition" aria-label="Condition type">
              <option value="loose">Loose</option>
              <option value="cib">Complete</option>
              <option value="new">New</option>
            </select>
            <button type="button" class="price-alert-set" id="setAlertBtn">
              Set Alert
            </button>
          </div>
        `;

        // Re-setup set handler
        setupPriceAlertHandlers(container, gameKey);
      }
    });
  }
}

function renderOffers(offers?: PriceData["offers"]): string {
  if (!offers) return "";

  const offerRows = Object.entries(offers)
    .flatMap(([region, regionOffers]) =>
      regionOffers.map((offer) => {
        const label = offer.label ?? "Offer";
        const updatedLabel = formatPricingTimestamp(offer.lastUpdated);
        const retailerText = offer.retailer ? ` • ${escapeHtml(offer.retailer)}` : "";
        const updatedText = updatedLabel ? ` (Updated ${escapeHtml(updatedLabel)})` : "";
        const sanitizedUrl = offer.url ? sanitizeUrl(offer.url) : "";
        const link = sanitizedUrl
          ? `<a class="modal-offers__cta" href="${escapeHtml(sanitizedUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(label)} offer link">View</a>`
          : "";
        return `
          <div class="modal-offers__row" role="listitem">
            <span class="modal-offers__region">${escapeHtml(region)}</span>
            <span class="modal-offers__label">${escapeHtml(label)}${retailerText}</span>
            <span class="modal-offers__price">${formatCurrency(offer.amountCents, {
              fromCents: true,
            })}${updatedText}</span>
            ${link}
          </div>
        `;
      })
    )
    .join("");

  if (!offerRows) return "";

  return `
    <div class="modal-offers" aria-label="Regional offers" role="list">
      ${offerRows}
    </div>
  `;
}

function formatPricingTimestamp(updated?: string): string {
  if (!updated) return "";
  const relative = formatRelativeDate(updated);
  const absolute = formatAbsoluteDate(updated);
  if (relative && absolute) return `${relative} (${absolute})`;
  return relative || absolute;
}

function buildExternalLinks(game: GameWithKey): string {
  const links = normalizeLinks(game);
  if (links.length === 0) return "";

  const chips = links
    .map((link) => ({ ...link, sanitizedUrl: sanitizeUrl(link.url) }))
    .filter((link) => link.sanitizedUrl !== "") // Filter out unsafe URLs
    .map((link) => {
      return `
        <a
          class="modal-link-chip"
          href="${link.sanitizedUrl}"
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
          aria-label="${escapeHtml(link.ariaLabel)}"
        >
          <span aria-hidden="true">${link.icon}</span>
          <span class="modal-link-chip__label">${escapeHtml(link.label)}</span>
        </a>
      `;
    })
    .filter((chip) => chip !== "") // Remove invalid URLs
    .join("");

  return `
    <div class="modal-links" aria-label="External resources">
      <div class="modal-link-chip-list" role="list">
        ${chips}
      </div>
    </div>
  `;
}

function normalizeLinks(game: GameWithKey): Array<{
  label: string;
  url: string;
  icon: string;
  ariaLabel: string;
}> {
  const links: Array<{ label: string; url: string; icon: string; ariaLabel: string }> =
    [];
  const externalLinks: ExternalLinks | undefined = game.external_links;

  const wikiLinks = toArray(externalLinks?.wiki ?? game.Details ?? "");
  wikiLinks.filter(Boolean).forEach((url) =>
    links.push({
      label: buildLinkLabel(url, "Wiki"),
      url,
      icon: "📖",
      ariaLabel: `Open wiki entry for ${game.game_name}`,
    })
  );

  toArray(externalLinks?.store)
    .filter(Boolean)
    .forEach((url) =>
      links.push({
        label: buildLinkLabel(url, "Store"),
        url,
        icon: "🛒",
        ariaLabel: `Open store listing for ${game.game_name}`,
      })
    );

  toArray(externalLinks?.community)
    .filter(Boolean)
    .forEach((url) =>
      links.push({
        label: buildLinkLabel(url, "Community"),
        url,
        icon: "👥",
        ariaLabel: `Open community link for ${game.game_name}`,
      })
    );

  return links;
}

function buildLinkLabel(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

function toArray(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildExtendedMetadata(game: GameWithKey): string {
  const description = game.description
    ? `<p class="modal-metadata__description">${escapeHtml(game.description)}</p>`
    : "";

  const rows = (
    [
      { label: "Developer", value: game.developer },
      { label: "Publisher", value: game.publisher },
      { label: "ESRB", value: game.esrb_rating },
      { label: "Metacritic", value: game.metacritic_score },
      { label: "Updated", value: formatAbsoluteDate(game.updated_at) },
    ] as const
  )
    .filter((entry) => entry.value)
    .map(
      (entry) => `
        <dt class="modal-metadata__row">${escapeHtml(entry.label)}</dt>
        <dd class="modal-metadata__row">${escapeHtml(String(entry.value))}</dd>
      `
    )
    .join("");

  if (!description && !rows) return "";

  return `
    <details class="modal-metadata" aria-labelledby="modalMetadataSummary">
      <summary class="modal-metadata__summary" id="modalMetadataSummary">Extended metadata</summary>
      <div class="modal-metadata__body" id="modalMetadataBody">
        ${description}
        ${rows ? `<dl class="modal-metadata__list">${rows}</dl>` : ""}
      </div>
    </details>
  `;
}

/**
 * Build the "Suggest Edit" section for community contributions
 */
function buildSuggestEditSection(game: GameWithKey): string {
  return `
    <details class="modal-suggest-edit" aria-labelledby="suggestEditSummary">
      <summary class="modal-suggest-edit__summary" id="suggestEditSummary">
        <span class="modal-suggest-edit__icon">✏️</span>
        Suggest an edit
      </summary>
      <div class="modal-suggest-edit__body">
        <p class="modal-suggest-edit__description">
          Help improve our catalog! Your suggestions will be reviewed by moderators.
        </p>
        <form class="modal-suggest-edit__form" id="suggestEditForm" data-game-key="${escapeHtml(game.key)}">
          <div class="form-row">
            <label for="suggestGenre">Genre</label>
            <input type="text" id="suggestGenre" name="genre" value="${escapeHtml(game.genre || "")}" placeholder="e.g., Action RPG" />
          </div>
          <div class="form-row">
            <label for="suggestYear">Release Year</label>
            <input type="number" id="suggestYear" name="release_year" value="${game.release_year || ""}" min="1970" max="2030" />
          </div>
          <div class="form-row">
            <label for="suggestRegion">Region</label>
            <input type="text" id="suggestRegion" name="region" value="${escapeHtml(game.region || "")}" placeholder="e.g., NTSC-U, PAL" />
          </div>
          <div class="form-row">
            <label for="suggestDeveloper">Developer</label>
            <input type="text" id="suggestDeveloper" name="developer" value="${escapeHtml(game.developer || "")}" placeholder="e.g., Capcom" />
          </div>
          <div class="form-row">
            <label for="suggestPublisher">Publisher</label>
            <input type="text" id="suggestPublisher" name="publisher" value="${escapeHtml(game.publisher || "")}" placeholder="e.g., Nintendo" />
          </div>
          <div class="form-row">
            <label for="suggestDescription">Description</label>
            <textarea id="suggestDescription" name="description" rows="3" placeholder="Brief game description...">${escapeHtml(game.description || "")}</textarea>
          </div>
          <div class="form-row">
            <label for="suggestNotes">Your Notes (optional)</label>
            <textarea id="suggestNotes" name="notes" rows="2" placeholder="Why are you suggesting this change?"></textarea>
          </div>
          <div class="form-row form-actions">
            <button type="submit" class="btn btn-primary" id="submitSuggestionBtn">
              Submit Suggestion
            </button>
            <span class="suggest-status" id="suggestStatus" role="status"></span>
          </div>
        </form>
      </div>
    </details>
  `;
}

/**
 * Setup the suggest edit form handlers
 */
function setupSuggestEditForm(container: HTMLElement, game: GameWithKey): void {
  const form = container.querySelector("#suggestEditForm") as HTMLFormElement | null;
  if (!form) return;

  const statusEl = container.querySelector("#suggestStatus") as HTMLElement | null;
  const submitBtn = container.querySelector(
    "#submitSuggestionBtn"
  ) as HTMLButtonElement | null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!submitBtn || !statusEl) return;

    // Collect changed fields
    const formData = new FormData(form);
    const delta: Record<string, unknown> = {};
    const originalValues: Record<string, unknown> = {
      genre: game.genre || "",
      release_year: game.release_year || "",
      region: game.region || "",
      developer: game.developer || "",
      publisher: game.publisher || "",
      description: game.description || "",
    };

    for (const [key, value] of formData.entries()) {
      if (key === "notes") continue; // Notes are separate
      const strValue = String(value).trim();
      const originalValue = String(originalValues[key] || "").trim();
      if (strValue && strValue !== originalValue) {
        delta[key] =
          key === "release_year" ? parseInt(strValue, 10) || strValue : strValue;
      }
    }

    if (Object.keys(delta).length === 0) {
      statusEl.textContent = "No changes detected";
      statusEl.className = "suggest-status suggest-status--warning";
      return;
    }

    const notes = formData.get("notes") as string | null;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    statusEl.textContent = "";
    statusEl.className = "suggest-status";

    try {
      await submitEditSuggestion(game.key, delta, notes || undefined);
      statusEl.textContent = "✓ Suggestion submitted! Thanks for contributing.";
      statusEl.className = "suggest-status suggest-status--success";
      submitBtn.textContent = "Submitted!";

      // Reset form after success
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Suggestion";
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit";
      statusEl.textContent = `✗ ${message}`;
      statusEl.className = "suggest-status suggest-status--error";
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Suggestion";
    }
  });
}

// Store reference to current focus trap handler for cleanup
let currentFocusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Trap focus within modal
 */
function trapFocus(container: HTMLElement): void {
  // Remove previous handler if exists
  if (currentFocusTrapHandler) {
    container.removeEventListener("keydown", currentFocusTrapHandler);
  }

  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  first.focus();

  currentFocusTrapHandler = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", currentFocusTrapHandler);
}

/**
 * Load and render price history chart
 */
async function loadPriceChart(gameKey: string): Promise<void> {
  const container = document.getElementById("priceChartContainer");
  if (!container) return;

  try {
    const history = await fetchPriceHistory(gameKey, 90);

    if (history.length < 2) {
      container.innerHTML =
        '<p class="price-chart-empty">Not enough history for chart</p>';
      return;
    }

    // Render SVG sparkline chart
    container.innerHTML = renderPriceSparkline(history);
  } catch {
    container.innerHTML = '<p class="price-chart-empty">Failed to load price history</p>';
  }
}

/**
 * Render a simple SVG sparkline chart for price history
 */
function renderPriceSparkline(history: PriceHistoryPoint[]): string {
  const width = 320;
  const height = 80;
  const padding = 8;

  // Get loose prices (most common condition tracked)
  const prices = history.map((h) => h.loose).filter((p): p is number => p !== null);
  if (prices.length < 2) {
    return '<p class="price-chart-empty">Not enough loose price data</p>';
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  // Build path
  const points = prices.map((price, i) => {
    const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
    const y = height - padding - ((price - minPrice) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Determine trend color
  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  const trendColor =
    endPrice > startPrice
      ? "var(--color-error)"
      : endPrice < startPrice
        ? "var(--color-success)"
        : "var(--accent-primary)";

  // Format dates for labels
  const startDate = history[0].date.slice(5); // MM-DD
  const endDate = history[history.length - 1].date.slice(5);

  return `
    <div class="price-chart">
      <svg viewBox="0 0 ${width} ${height}" class="price-sparkline" aria-label="Price trend over ${history.length} days">
        <defs>
          <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${trendColor}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path 
          d="${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z" 
          fill="url(#priceGradient)"
        />
        <path 
          d="${pathD}" 
          fill="none" 
          stroke="${trendColor}" 
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="${points[0].split(",")[0]}" cy="${points[0].split(",")[1]}" r="3" fill="${trendColor}"/>
        <circle cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="3" fill="${trendColor}"/>
      </svg>
      <div class="price-chart-labels">
        <span class="price-chart-date">${startDate}</span>
        <span class="price-chart-range">$${(minPrice / 100).toFixed(0)} - $${(maxPrice / 100).toFixed(0)}</span>
        <span class="price-chart-date">${endDate}</span>
      </div>
    </div>
  `;
}

/**
 * Mount the modal component
 */
export function mountModal(selector: string | HTMLElement): () => void {
  return mount(selector, initModal);
}
