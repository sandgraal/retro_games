/**
 * Modal UI helpers extracted from archive/app-legacy.js.
 * Functions for building modal content and gallery navigation.
 * @module ui/modal
 */

import { escapeHtml } from "../utils/dom.js";
import { formatFieldLabel } from "../utils/format.js";

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
