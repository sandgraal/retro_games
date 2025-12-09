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
      element.classList.add("open");
      document.body.style.overflow = "hidden";
      trapFocus(element);
    } else {
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
 * Render modal content
 */
function renderModal(container: HTMLElement, game: GameWithKey): void {
  const status = getGameStatus(game.key);
  const notes = getGameNotes(game.key);
  const rating = parseFloat(String(game.rating));

  container.innerHTML = `
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button type="button" class="modal__close" aria-label="Close modal">×</button>
      
      <div class="modal__content">
        <div class="modal__cover">
          ${
            game.cover
              ? `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.game_name)} cover art" />`
              : `<div class="modal__cover-placeholder">${escapeHtml(game.game_name.slice(0, 2).toUpperCase())}</div>`
          }
        </div>
        
        <div class="modal__info">
          <h2 id="modalTitle" class="modal__title">${escapeHtml(game.game_name)}</h2>
          
          <div class="modal__meta">
            <span class="modal__platform">${escapeHtml(game.platform)}</span>
            ${!isNaN(rating) ? `<span class="modal__rating">⭐ ${rating.toFixed(1)}</span>` : ""}
            ${game.release_year ? `<span class="modal__year">${escapeHtml(String(game.release_year))}</span>` : ""}
          </div>
          
          ${game.genre ? `<p class="modal__genre">${escapeHtml(game.genre)}</p>` : ""}
          ${game.region ? `<p class="modal__region">Region: ${escapeHtml(game.region)}</p>` : ""}
          ${game.player_mode ? `<p class="modal__players">${escapeHtml(game.player_mode)}</p>` : ""}
          
          <div class="modal__status">
            <label for="statusSelect">Collection Status:</label>
            <select id="statusSelect" class="modal__status-select">
              <option value="none" ${status === "none" ? "selected" : ""}>Not in collection</option>
              <option value="owned" ${status === "owned" ? "selected" : ""}>Owned</option>
              <option value="wishlist" ${status === "wishlist" ? "selected" : ""}>Wishlist</option>
              <option value="backlog" ${status === "backlog" ? "selected" : ""}>Backlog</option>
              <option value="trade" ${status === "trade" ? "selected" : ""}>For Trade</option>
            </select>
          </div>
          
          <div class="modal__notes">
            <label for="notesInput">Notes:</label>
            <textarea id="notesInput" class="modal__notes-input" rows="3" placeholder="Add your notes...">${escapeHtml(notes)}</textarea>
          </div>
          
          ${
            game.Details
              ? `
            <a href="${escapeHtml(game.Details)}" target="_blank" rel="noopener noreferrer" class="modal__link">
              View on Wikipedia →
            </a>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;

  // Setup close button
  const closeBtn = container.querySelector(".modal__close");
  closeBtn?.addEventListener("click", closeGameModal);

  // Setup status select
  const statusSelect = container.querySelector("#statusSelect") as HTMLSelectElement;
  statusSelect?.addEventListener("change", () => {
    setGameStatus(game.key, statusSelect.value as any);
  });

  // Setup notes input
  const notesInput = container.querySelector("#notesInput") as HTMLTextAreaElement;
  notesInput?.addEventListener("blur", () => {
    setGameNotes(game.key, notesInput.value);
  });
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
