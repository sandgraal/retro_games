/**
 * Modal Component
 * Game detail modal with full information
 */

import type { GameWithKey } from "../core/types";
import type { ComponentContext } from "./components";
import { mount, escapeHtml } from "./components";
import {
  modalGame,
  closeGameModal,
  setGameStatus,
  getGameStatus,
  getGameNotes,
  setGameNotes,
} from "../state/store";
import { effect } from "../core/signals";

/**
 * Initialize the modal
 */
export function initModal(ctx: ComponentContext): void {
  const { element, cleanup } = ctx;

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
 * Render modal content into existing HTML structure
 */
function renderModal(backdrop: HTMLElement, game: GameWithKey): void {
  const status = getGameStatus(game.key);
  const notes = getGameNotes(game.key);
  const rating = parseFloat(String(game.rating));

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
    } else {
      coverImg.style.display = "none";
    }
  }

  // Update details section
  const detailsEl = backdrop.querySelector("#gameModalDetails");
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="modal-meta">
        <span class="modal-platform">${escapeHtml(game.platform)}</span>
        ${!isNaN(rating) ? `<span class="modal-rating">⭐ ${rating.toFixed(1)}</span>` : ""}
        ${game.release_year ? `<span class="modal-year">${escapeHtml(String(game.release_year))}</span>` : ""}
      </div>
      
      ${game.genre ? `<p class="modal-genre">${escapeHtml(game.genre)}</p>` : ""}
      ${game.region ? `<p class="modal-region">Region: ${escapeHtml(game.region)}</p>` : ""}
      ${game.player_mode ? `<p class="modal-players">${escapeHtml(game.player_mode)}</p>` : ""}
      
      <div class="modal-status">
        <label for="statusSelect">Collection Status:</label>
        <select id="statusSelect" class="modal-status-select">
          <option value="none" ${status === "none" ? "selected" : ""}>Not in collection</option>
          <option value="owned" ${status === "owned" ? "selected" : ""}>Owned</option>
          <option value="wishlist" ${status === "wishlist" ? "selected" : ""}>Wishlist</option>
          <option value="backlog" ${status === "backlog" ? "selected" : ""}>Backlog</option>
          <option value="trade" ${status === "trade" ? "selected" : ""}>For Trade</option>
        </select>
      </div>
      
      <div class="modal-notes">
        <label for="notesInput">Notes:</label>
        <textarea id="notesInput" class="modal-notes-input" rows="3" placeholder="Add your notes...">${escapeHtml(notes)}</textarea>
      </div>
      
      ${
        game.Details
          ? `
        <a href="${escapeHtml(game.Details)}" target="_blank" rel="noopener noreferrer" class="modal-link">
          View on Wikipedia →
        </a>
      `
          : ""
      }
    `;

    // Setup status select
    const statusSelect = detailsEl.querySelector("#statusSelect") as HTMLSelectElement;
    statusSelect?.addEventListener("change", () => {
      setGameStatus(game.key, statusSelect.value as any);
    });

    // Setup notes input
    const notesInput = detailsEl.querySelector("#notesInput") as HTMLTextAreaElement;
    notesInput?.addEventListener("blur", () => {
      setGameNotes(game.key, notesInput.value);
    });
  }

  // Setup close button (might already have listener but re-add for safety)
  const closeBtn = backdrop.querySelector("#gameModalClose");
  closeBtn?.addEventListener("click", closeGameModal);
}

/**
 * Trap focus within modal
 */
function trapFocus(container: HTMLElement): void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  first.focus();

  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/**
 * Mount the modal component
 */
export function mountModal(selector: string | HTMLElement): () => void {
  return mount(selector, initModal);
}
