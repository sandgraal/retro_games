/**
 * Modal UI helpers extracted from archive/app-legacy.js.
 * Functions for building modal content and gallery navigation.
 * @module ui/modal
 */

import { escapeHtml } from "../utils/dom.js";
import { formatFieldLabel, formatCurrency } from "../utils/format.js";

// === Metadata Card Building ===

/**
 * @typedef {Object} MetadataItem
 * @property {string} label - Display label
 * @property {*} value - Display value
 */

/**
 * Build a metadata card HTML section.
 * @param {string} title - Card title
 * @param {MetadataItem[]} items - Metadata items
 * @param {Object} [options]
 * @param {string} [options.layout='grid'] - Layout: 'grid' or 'stacked'
 * @param {string} [options.footerHtml=''] - Additional footer HTML
 * @returns {string} HTML string
 */
export function buildMetadataCard(title, items, options = {}) {
  const { layout = "grid", footerHtml = "" } = options;

  const safeTitle = title ? escapeHtml(title) : "";
  const hasItems = Array.isArray(items) && items.length > 0;
  const containerClass = layout === "stacked" ? "metadata-list" : "metadata-grid";
  const itemClass = layout === "stacked" ? "metadata-item stacked" : "metadata-item";

  const body = hasItems
    ? items
        .map((item) => {
          const label = escapeHtml(item.label || "");
          const value = escapeHtml(String(item.value ?? ""));
          return `<div class="${itemClass}">
            <p class="metadata-label">${label}</p>
            <p class="metadata-value">${value}</p>
          </div>`;
        })
        .join("")
    : "";

  if (!hasItems && !footerHtml) return "";

  return `<article class="modal-section">
    ${safeTitle ? `<h3>${safeTitle}</h3>` : ""}
    ${hasItems ? `<div class="${containerClass}">${body}</div>` : ""}
    ${footerHtml || ""}
  </article>`;
}

/**
 * Build fallback metadata card for unconsumed fields.
 * @param {Object} game - Game data object
 * @param {Set<string>} consumed - Set of already-consumed field names
 * @returns {string} HTML string
 */
export function buildFallbackMetadata(game, consumed) {
  if (!game || typeof game !== "object") return "";
  const consumedSet = consumed instanceof Set ? consumed : new Set();

  const items = Object.keys(game)
    .filter((key) => {
      if (consumedSet.has(key)) return false;
      const value = game[key];
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    })
    .map((key) => ({
      label: formatFieldLabel(key),
      value: game[key],
    }));

  if (!items.length) return "";
  return buildMetadataCard("Additional Details", items, { layout: "stacked" });
}

/**
 * Mark a field as consumed for metadata building.
 * @param {Set<string>} consumed - Set to update
 * @param {string} field - Field name to mark
 */
export function markFieldConsumed(consumed, field) {
  if (consumed instanceof Set && field) {
    consumed.add(field);
  }
}

// === Gallery Navigation ===

/**
 * Calculate bounded gallery index.
 * @param {number} index - Current index (may be negative or > length)
 * @param {number} length - Total number of items
 * @returns {number} Bounded index (0 to length-1)
 */
export function calculateGalleryIndex(index, length) {
  if (!Number.isFinite(index) || !Number.isFinite(length) || length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

/**
 * Get next gallery index.
 * @param {number} currentIndex
 * @param {number} length
 * @returns {number}
 */
export function nextGalleryIndex(currentIndex, length) {
  return calculateGalleryIndex(currentIndex + 1, length);
}

/**
 * Get previous gallery index.
 * @param {number} currentIndex
 * @param {number} length
 * @returns {number}
 */
export function prevGalleryIndex(currentIndex, length) {
  return calculateGalleryIndex(currentIndex - 1, length);
}

/**
 * Build gallery counter text.
 * @param {number} index - Current index (0-based)
 * @param {number} total - Total items
 * @returns {string} Counter text like "1 / 5"
 */
export function buildGalleryCounter(index, total) {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
    return "0 / 0";
  }
  const displayIndex = calculateGalleryIndex(index, total) + 1;
  return `${displayIndex} / ${total}`;
}

// === Modal State Helpers ===

/**
 * Check if modal should trap focus.
 * @param {HTMLElement|null} modal
 * @returns {boolean}
 */
export function isModalOpen(modal) {
  if (!modal) return false;
  return !modal.hidden && modal.style.display !== "none";
}

/**
 * Get focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return [];
  }
  const selector = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  return Array.from(container.querySelectorAll(selector));
}

/**
 * Build focus trap handlers for modal.
 * @param {HTMLElement} container
 * @returns {{handleKeyDown: Function}|null}
 */
export function createFocusTrap(container) {
  if (!container) return null;

  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(container);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { handleKeyDown };
}

// === Modal ARIA Helpers ===

/**
 * Build ARIA attributes for modal dialog.
 * @param {Object} options
 * @param {string} [options.labelledBy] - ID of title element
 * @param {string} [options.describedBy] - ID of description element
 * @param {boolean} [options.isOpen=false] - Whether modal is open
 * @returns {Object} Attribute map
 */
export function buildModalAriaAttrs(options = {}) {
  const { labelledBy, describedBy, isOpen = false } = options;
  const attrs = {
    role: "dialog",
    "aria-modal": "true",
    "aria-hidden": isOpen ? "false" : "true",
  };

  if (labelledBy) attrs["aria-labelledby"] = labelledBy;
  if (describedBy) attrs["aria-describedby"] = describedBy;

  return attrs;
}

/**
 * Build close button ARIA attributes.
 * @param {string} [label='Close modal']
 * @returns {Object} Attribute map
 */
export function buildCloseButtonAttrs(label = "Close modal") {
  return {
    type: "button",
    "aria-label": label,
  };
}

// === Modal DOM Operations ===

/**
 * Build status action buttons for the modal.
 * @param {string} gameKey - Game key
 * @param {string|null} currentStatus - Current status (owned/wishlist/backlog/trade)
 * @returns {string} HTML string
 */
export function buildModalStatusButtons(gameKey, currentStatus) {
  const safeKey = escapeHtml(gameKey);
  const statuses = ["owned", "wishlist", "backlog", "trade"];
  const labels = {
    owned: "Own It",
    wishlist: "Wishlist",
    backlog: "Backlog",
    trade: "For Trade",
  };
  const icons = { owned: "✓", wishlist: "⭐", backlog: "📚", trade: "🔄" };

  return statuses
    .map((status) => {
      const isActive = currentStatus === status;
      const activeClass = isActive ? status : "";
      return `<button type="button" class="modal-status-btn ${activeClass}" data-action="${status}" data-game-key="${safeKey}">
        <span aria-hidden="true">${icons[status]}</span>
        ${labels[status]}
      </button>`;
    })
    .join("");
}

/**
 * Build price section HTML for the modal.
 * @param {Object|null} priceData - Price data with loose/cib/new cents values
 * @returns {string} HTML string
 */
export function buildPriceSection(priceData) {
  if (!priceData) return "";

  const hasLoose = priceData.loose && priceData.loose > 0;
  const hasCib = priceData.cib && priceData.cib > 0;
  const hasNew = priceData.new && priceData.new > 0;

  if (!hasLoose && !hasCib && !hasNew) return "";

  const items = [];
  if (hasLoose) {
    items.push(`<div class="price-item">
      <span class="price-label">Loose</span>
      <span class="price-value">${formatCurrency(priceData.loose / 100)}</span>
    </div>`);
  }
  if (hasCib) {
    items.push(`<div class="price-item">
      <span class="price-label">Complete</span>
      <span class="price-value price-value--cib">${formatCurrency(priceData.cib / 100)}</span>
    </div>`);
  }
  if (hasNew) {
    items.push(`<div class="price-item">
      <span class="price-label">New</span>
      <span class="price-value price-value--new">${formatCurrency(priceData.new / 100)}</span>
    </div>`);
  }

  const sourceText = priceData.snapshotDate
    ? `<span class="price-source">via PriceCharting • ${priceData.snapshotDate}</span>`
    : "";

  return `
    <div class="modal-section modal-prices">
      <h3 class="modal-section-title">Market Prices</h3>
      <div class="price-grid">
        ${items.join("")}
      </div>
      ${sourceText}
    </div>
  `;
}

/**
 * Build game details HTML for the modal.
 * @param {Object} game - Game data object
 * @returns {string} HTML string
 */
export function buildGameDetailsHtml(game) {
  if (!game) return "";

  const consumed = new Set();
  const sections = [];

  // Meta bar with platform, rating, year
  const metaItems = [];
  if (game.platform) {
    metaItems.push(`<span class="modal-meta-item">${escapeHtml(game.platform)}</span>`);
    consumed.add("platform");
  }
  if (game.release_year) {
    metaItems.push(
      `<span class="modal-meta-item">${escapeHtml(String(game.release_year))}</span>`
    );
    consumed.add("release_year");
  }
  if (game.rating) {
    const rating = parseFloat(game.rating);
    if (Number.isFinite(rating)) {
      metaItems.push(`<span class="modal-rating">★ ${rating.toFixed(1)}</span>`);
    }
    consumed.add("rating");
  }
  consumed.add("game_name");
  consumed.add("cover");

  if (metaItems.length) {
    sections.push(
      `<div class="modal-meta">${metaItems.join('<span class="modal-meta-separator">•</span>')}</div>`
    );
  }

  // Genre section
  if (game.genre) {
    const genreItems = [{ label: "Genre", value: game.genre }];
    sections.push(buildMetadataCard("Genre", genreItems, { layout: "stacked" }));
    consumed.add("genre");
  }

  // Release & Rating section
  const releaseItems = [];
  if (game.rating_category) {
    releaseItems.push({ label: "Rating Tier", value: game.rating_category });
    consumed.add("rating_category");
  }
  if (game.developer) {
    releaseItems.push({ label: "Developer", value: game.developer });
    consumed.add("developer");
  }
  if (game.publisher) {
    releaseItems.push({ label: "Publisher", value: game.publisher });
    consumed.add("publisher");
  }
  if (releaseItems.length) {
    sections.push(
      buildMetadataCard("Release & Rating", releaseItems, { layout: "grid" })
    );
  }

  // Gameplay section
  const gameplayItems = [];
  if (game.player_mode) {
    gameplayItems.push({ label: "Mode", value: game.player_mode });
    consumed.add("player_mode");
  }
  if (game.player_count) {
    gameplayItems.push({ label: "Players", value: game.player_count });
    consumed.add("player_count");
  }
  if (game.players) {
    gameplayItems.push({ label: "Players", value: game.players });
    consumed.add("players");
  }
  if (gameplayItems.length) {
    sections.push(buildMetadataCard("Gameplay", gameplayItems, { layout: "grid" }));
  }

  // Regions & Versions section (enhanced for consolidated games)
  const regionItems = [];
  if (game.region) {
    regionItems.push({ label: "Region", value: game.region });
    consumed.add("region");
  }
  // Show available regional variants if present
  if (Array.isArray(game.available_regions) && game.available_regions.length > 0) {
    const regionLabels = {
      "NTSC-U": "🇺🇸 USA",
      "NTSC-J": "🇯🇵 Japan",
      PAL: "🇪🇺 Europe",
      "NTSC-K": "🇰🇷 Korea",
      "NTSC-C": "🇨🇳 China",
      WORLD: "🌍 Worldwide",
    };
    const regionDisplay = game.available_regions
      .map((r) => regionLabels[r] || r)
      .join(", ");
    regionItems.push({ label: "Available Regions", value: regionDisplay });
    consumed.add("available_regions");
  }
  if (game.variant_count && game.variant_count > 0) {
    regionItems.push({
      label: "Regional Variants",
      value: `${game.variant_count} version${game.variant_count > 1 ? "s" : ""}`,
    });
    consumed.add("variant_count");
  }
  if (game.version) {
    regionItems.push({ label: "Version", value: game.version });
    consumed.add("version");
  }
  if (regionItems.length) {
    sections.push(
      buildMetadataCard("Regions & Versions", regionItems, { layout: "grid" })
    );
  }

  // Notes section
  if (game.notes) {
    const notesHtml = `
      <div class="modal-section">
        <h3 class="modal-section-title">Notes</h3>
        <div class="modal-section-content modal-notes">
          ${escapeHtml(game.notes)}
        </div>
      </div>
    `;
    sections.push(notesHtml);
    consumed.add("notes");
  }

  // External links section
  const gameName = encodeURIComponent(game.game_name || "");
  const platform = encodeURIComponent(game.platform || "");
  const detailsLink = game.Details || game.details;
  const linksItems = [];
  if (detailsLink) {
    linksItems.push(
      `<a href="${escapeHtml(detailsLink)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
    );
    consumed.add("Details");
    consumed.add("details");
  }
  linksItems.push(
    `<a href="https://www.google.com/search?q=${gameName}+${platform}" target="_blank" rel="noopener noreferrer">Google</a>`
  );
  linksItems.push(
    `<a href="https://www.youtube.com/results?search_query=${gameName}+${platform}+gameplay" target="_blank" rel="noopener noreferrer">YouTube</a>`
  );
  linksItems.push(
    `<a href="https://gamefaqs.gamespot.com/search?game=${gameName}" target="_blank" rel="noopener noreferrer">GameFAQs</a>`
  );

  const linksHtml = `
    <div class="modal-section">
      <h3 class="modal-section-title">External Links</h3>
      <div class="modal-section-content modal-links">
        ${linksItems.join(" • ")}
      </div>
    </div>
  `;
  sections.push(linksHtml);

  // Mark screenshots as consumed (handled separately in gallery)
  consumed.add("screenshots");

  // Fallback for remaining fields
  sections.push(buildFallbackMetadata(game, consumed));

  return sections.join("");
}

/**
 * Open the game detail modal.
 * @param {Object} game - Game data object
 * @param {string} gameKey - Game key
 * @param {Object} owned - Owned games map
 * @param {Object} [statuses={}] - Status maps
 * @param {Object} [priceData=null] - Price data for this game
 */
export function openModal(game, gameKey, owned, statuses = {}, priceData = null) {
  const backdrop = document.getElementById("gameModalBackdrop");
  const titleEl = document.getElementById("gameModalTitle");
  const coverImg = document.getElementById("gameModalCoverImage");
  const actionsEl = document.getElementById("gameModalActions");
  const detailsEl = document.getElementById("gameModalDetails");

  if (!backdrop || !titleEl || !detailsEl) return;

  // Determine current status
  let currentStatus = null;
  if (owned?.[gameKey]) currentStatus = "owned";
  else if (statuses?.wishlist?.[gameKey]) currentStatus = "wishlist";
  else if (statuses?.backlog?.[gameKey]) currentStatus = "backlog";
  else if (statuses?.trade?.[gameKey]) currentStatus = "trade";

  // Set title
  titleEl.textContent = game?.game_name || "Game Details";

  // Set cover image
  if (coverImg) {
    const coverUrl = game?.cover || "";
    coverImg.src = coverUrl;
    coverImg.alt = coverUrl ? `${game.game_name} cover art` : "";
    coverImg.style.display = coverUrl ? "block" : "none";
  }

  // Set status buttons
  if (actionsEl) {
    actionsEl.innerHTML = buildModalStatusButtons(gameKey, currentStatus);
  }

  // Set details
  detailsEl.innerHTML = buildGameDetailsHtml(game) + buildPriceSection(priceData);

  // Store game key on modal for status button handlers
  backdrop.dataset.gameKey = gameKey;

  // Show modal
  backdrop.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");

  // Trap focus
  const closeBtn = document.getElementById("gameModalClose");
  if (closeBtn) closeBtn.focus();

  // Add keyboard handler for escape
  backdrop._escapeHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", backdrop._escapeHandler);
}

/**
 * Close the game detail modal.
 */
export function closeModal() {
  const backdrop = document.getElementById("gameModalBackdrop");
  if (!backdrop) return;

  backdrop.hidden = true;
  backdrop.setAttribute("aria-hidden", "true");

  // Remove escape handler
  if (backdrop._escapeHandler) {
    document.removeEventListener("keydown", backdrop._escapeHandler);
    backdrop._escapeHandler = null;
  }
}

/**
 * Setup modal event handlers.
 * Should be called once on app initialization.
 */
export function setupModalHandlers() {
  const backdrop = document.getElementById("gameModalBackdrop");
  const closeBtn = document.getElementById("gameModalClose");
  const actionsEl = document.getElementById("gameModalActions");

  // Close on button click
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  // Close on backdrop click
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  // Handle status button clicks
  if (actionsEl) {
    actionsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-status-btn");
      if (!btn) return;

      const action = btn.dataset.action;
      const gameKey = btn.dataset.gameKey;
      if (!action || !gameKey) return;

      // Dispatch status change event
      window.dispatchEvent(
        new CustomEvent("gameStatusChange", {
          detail: { gameKey, action },
        })
      );

      // Update button states
      actionsEl.querySelectorAll(".modal-status-btn").forEach((b) => {
        b.classList.remove("owned", "wishlist", "backlog", "trade");
      });
      btn.classList.add(action);
    });
  }
}
