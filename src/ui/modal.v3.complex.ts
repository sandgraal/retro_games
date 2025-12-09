/**
 * Modal System v3.0
 * Accessible, focus-trapped modal with game details
 */

import { effect, computed, type Signal } from "../core/runtime";
import type {
  GameWithKey,
  CollectionStatus,
  CollectionEntry,
  GameNotes,
} from "../core/types.v3";
import {
  gamesLookup,
  selectedGameKey,
  clearSelectedGame,
  getGameStatus,
  setGameStatus,
  getGameNotes,
  setGameNotes,
  collectionSignal,
} from "../state/store.v3";
import { escapeHtml, escapeAttr } from "./components.v3";

const MODAL_STYLES = `
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
  }
  
  .modal-backdrop.open {
    opacity: 1;
    visibility: visible;
  }
  
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    width: min(90vw, 800px);
    max-height: 90vh;
    background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    z-index: 1001;
    opacity: 0;
    visibility: hidden;
    transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
    display: flex;
    flex-direction: column;
  }
  
  .modal.open {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, -50%) scale(1);
  }
  
  .modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 24px 24px 0;
  }
  
  .modal__close {
    background: none;
    border: none;
    font-size: 24px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 8px;
    margin: -8px -8px 0 0;
    border-radius: 8px;
    transition: background 0.2s, color 0.2s;
  }
  
  .modal__close:hover,
  .modal__close:focus-visible {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .modal__content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  
  .game-detail {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 24px;
  }
  
  @media (max-width: 600px) {
    .game-detail {
      grid-template-columns: 1fr;
    }
    
    .game-detail__cover {
      max-width: 200px;
      margin: 0 auto;
    }
  }
  
  .game-detail__cover {
    aspect-ratio: 3/4;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
  }
  
  .game-detail__cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .game-detail__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 4rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.2);
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  
  .game-detail__info h2 {
    margin: 0 0 8px;
    font-size: 1.75rem;
    font-weight: 700;
    color: white;
  }
  
  .game-detail__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .meta-item__icon {
    opacity: 0.7;
  }
  
  .status-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 20px 0;
  }
  
  .status-btn {
    padding: 10px 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .status-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .status-btn:focus-visible {
    outline: 2px solid var(--accent-primary, #00d4ff);
    outline-offset: 2px;
  }
  
  .status-btn.active {
    border-color: transparent;
  }
  
  .status-btn.active.owned { background: rgba(34, 197, 94, 0.3); color: #22c55e; }
  .status-btn.active.wishlist { background: rgba(245, 158, 11, 0.3); color: #f59e0b; }
  .status-btn.active.backlog { background: rgba(59, 130, 246, 0.3); color: #3b82f6; }
  .status-btn.active.trade { background: rgba(139, 92, 246, 0.3); color: #8b5cf6; }
  
  .notes-section {
    margin-top: 20px;
  }
  
  .notes-section h4 {
    margin: 0 0 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .notes-textarea {
    width: 100%;
    min-height: 100px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    font-family: inherit;
    font-size: 0.875rem;
    resize: vertical;
  }
  
  .notes-textarea:focus {
    outline: none;
    border-color: var(--accent-primary, #00d4ff);
  }
  
  .notes-textarea::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
`;

interface ModalElements {
  backdrop: HTMLDivElement;
  modal: HTMLDivElement;
  closeBtn: HTMLButtonElement;
  content: HTMLDivElement;
}

type FocusableElement =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLAnchorElement;

const STATUS_OPTIONS: Array<{ value: CollectionStatus; label: string; icon: string }> = [
  { value: "none", label: "Not in Collection", icon: "✕" },
  { value: "owned", label: "Owned", icon: "✓" },
  { value: "wishlist", label: "Wishlist", icon: "★" },
  { value: "backlog", label: "Backlog", icon: "📚" },
  { value: "trade", label: "For Trade", icon: "↔" },
];

class GameModal {
  private elements: ModalElements | null = null;
  private previousFocus: Element | null = null;
  private cleanups: Array<() => void> = [];

  init(container: HTMLElement): () => void {
    this.createElements(container);
    this.bindEvents();
    this.bindState();

    return () => this.destroy();
  }

  private createElements(container: HTMLElement): void {
    // Inject styles
    const styleEl = document.createElement("style");
    styleEl.textContent = MODAL_STYLES;
    document.head.appendChild(styleEl);
    this.cleanups.push(() => styleEl.remove());

    // Create backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("aria-hidden", "true");

    // Create modal
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");

    modal.innerHTML = `
      <div class="modal__header">
        <div></div>
        <button class="modal__close" aria-label="Close modal">×</button>
      </div>
      <div class="modal__content"></div>
    `;

    container.appendChild(backdrop);
    container.appendChild(modal);

    this.elements = {
      backdrop,
      modal,
      closeBtn: modal.querySelector(".modal__close")!,
      content: modal.querySelector(".modal__content")!,
    };

    this.cleanups.push(() => {
      backdrop.remove();
      modal.remove();
    });
  }

  private bindEvents(): void {
    if (!this.elements) return;

    const { backdrop, modal, closeBtn } = this.elements;

    // Close handlers
    const handleClose = () => this.close();
    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === backdrop) handleClose();
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "Tab") this.trapFocus(e);
    };

    closeBtn.addEventListener("click", handleClose);
    backdrop.addEventListener("click", handleBackdropClick);
    document.addEventListener("keydown", handleKeydown);

    this.cleanups.push(() => {
      closeBtn.removeEventListener("click", handleClose);
      backdrop.removeEventListener("click", handleBackdropClick);
      document.removeEventListener("keydown", handleKeydown);
    });
  }

  private bindState(): void {
    const dispose = effect(() => {
      const key = selectedGameKey();

      if (!key) {
        this.close();
        return;
      }

      const lookup = gamesLookup();
      const game = lookup.get(key);

      if (game) {
        this.open(game);
      } else {
        this.close();
      }
    });

    this.cleanups.push(dispose);
  }

  private open(game: GameWithKey): void {
    if (!this.elements) return;

    const { backdrop, modal, content } = this.elements;

    // Save current focus
    this.previousFocus = document.activeElement;

    // Render game details
    this.renderGame(game);

    // Open modal
    backdrop.classList.add("open");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Focus first focusable element
    requestAnimationFrame(() => {
      const firstFocusable = modal.querySelector<FocusableElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });
  }

  private close(): void {
    if (!this.elements) return;

    const { backdrop, modal } = this.elements;

    backdrop.classList.remove("open");
    modal.classList.remove("open");
    document.body.style.overflow = "";

    // Restore focus
    if (this.previousFocus instanceof HTMLElement) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;

    // Clear selection if still selected
    if (selectedGameKey()) {
      clearSelectedGame();
    }
  }

  private renderGame(game: GameWithKey): void {
    if (!this.elements) return;

    const { content } = this.elements;
    const status = getGameStatus(game.key);
    const notes = getGameNotes(game.key);

    const rating = parseFloat(String(game.rating));
    const hasRating = !isNaN(rating);

    content.innerHTML = `
      <div class="game-detail">
        <div class="game-detail__cover">
          ${
            game.cover
              ? `<img src="${escapeAttr(game.cover)}" alt="${escapeAttr(game.game_name)} cover" />`
              : `<div class="game-detail__placeholder">${escapeHtml(game.game_name.slice(0, 2).toUpperCase())}</div>`
          }
        </div>
        <div class="game-detail__info">
          <h2 id="modal-title">${escapeHtml(game.game_name)}</h2>
          <div class="game-detail__meta">
            <span class="meta-item">
              <span class="meta-item__icon">🎮</span>
              ${escapeHtml(game.platform)}
            </span>
            ${
              game.genre
                ? `
              <span class="meta-item">
                <span class="meta-item__icon">📂</span>
                ${escapeHtml(game.genre)}
              </span>
            `
                : ""
            }
            ${
              game.release_year
                ? `
              <span class="meta-item">
                <span class="meta-item__icon">📅</span>
                ${escapeHtml(String(game.release_year))}
              </span>
            `
                : ""
            }
            ${
              hasRating
                ? `
              <span class="meta-item">
                <span class="meta-item__icon">⭐</span>
                ${rating.toFixed(1)}
              </span>
            `
                : ""
            }
            ${
              game.region
                ? `
              <span class="meta-item">
                <span class="meta-item__icon">🌍</span>
                ${escapeHtml(game.region)}
              </span>
            `
                : ""
            }
          </div>
          
          <div class="status-selector">
            ${STATUS_OPTIONS.map(
              (opt) => `
              <button 
                class="status-btn ${opt.value} ${status === opt.value ? "active" : ""}"
                data-status="${opt.value}"
                aria-pressed="${status === opt.value}"
              >
                ${opt.icon} ${opt.label}
              </button>
            `
            ).join("")}
          </div>
          
          <div class="notes-section">
            <h4>Notes</h4>
            <textarea 
              class="notes-textarea" 
              placeholder="Add personal notes about this game..."
              data-game-key="${escapeAttr(game.key)}"
            >${escapeHtml(notes || "")}</textarea>
          </div>
        </div>
      </div>
    `;

    // Bind status buttons
    content.querySelectorAll<HTMLButtonElement>(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const newStatus = btn.dataset.status as CollectionStatus;
        setGameStatus(game.key, newStatus);

        // Update active state
        content.querySelectorAll<HTMLButtonElement>(".status-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.status === newStatus);
          b.setAttribute("aria-pressed", String(b.dataset.status === newStatus));
        });
      });
    });

    // Bind notes textarea with debounce
    let notesTimeout: ReturnType<typeof setTimeout>;
    const textarea = content.querySelector<HTMLTextAreaElement>(".notes-textarea");
    if (textarea) {
      textarea.addEventListener("input", () => {
        clearTimeout(notesTimeout);
        notesTimeout = setTimeout(() => {
          setGameNotes(game.key, textarea.value || undefined);
        }, 500);
      });
    }

    // Handle image load error
    const img = content.querySelector<HTMLImageElement>(".game-detail__cover img");
    if (img) {
      img.onerror = () => {
        const cover = img.parentElement;
        if (cover) {
          cover.innerHTML = `<div class="game-detail__placeholder">${escapeHtml(game.game_name.slice(0, 2).toUpperCase())}</div>`;
        }
      };
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    if (!this.elements) return;

    const { modal } = this.elements;
    if (!modal.classList.contains("open")) return;

    const focusableElements = modal.querySelectorAll<FocusableElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  private destroy(): void {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
    this.elements = null;
  }
}

// Singleton instance
export const gameModal = new GameModal();

export function initModal(container: HTMLElement = document.body): () => void {
  return gameModal.init(container);
}
