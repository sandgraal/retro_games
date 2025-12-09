/**
 * Component System v3.0
 * Web Components-based architecture with reactive bindings
 */

import { effect, type Computed, type Signal } from "../core/runtime";
import type { GameWithKey, CollectionStatus } from "../core/types.v3";
import { getGameStatus, selectGame } from "../state/store.v3.simple";

// === Base Component ===

export abstract class BaseComponent extends HTMLElement {
  protected shadow: ShadowRoot;
  protected cleanups: Array<() => void> = [];
  protected initialized = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    if (!this.initialized) {
      this.initialized = true;
      this.setup();
      this.render();
      this.bind();
    }
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  protected abstract setup(): void;
  protected abstract render(): void;
  protected abstract bind(): void;

  protected cleanup(): void {
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups = [];
  }

  protected watch<T>(
    signalOrComputed: Computed<T> | Signal<T>,
    callback: (value: T) => void
  ): void {
    const dispose = effect(() => {
      // Both Signal and Computed are callable functions in our runtime
      const value = signalOrComputed();
      callback(value);
    });
    this.cleanups.push(dispose);
  }

  protected emit<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }
}

// === Game Card Component ===

const GAME_CARD_STYLES = `
  :host {
    display: block;
    contain: layout style paint;
  }
  
  .card {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
  
  .card:focus-visible {
    outline: 2px solid var(--accent-primary, #00d4ff);
    outline-offset: 2px;
  }
  
  .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 3/4;
    overflow: hidden;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  
  .card:hover .cover img {
    transform: scale(1.05);
  }
  
  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.2);
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  
  .status-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    backdrop-filter: blur(8px);
    z-index: 1;
  }
  
  .status-owned { background: rgba(34, 197, 94, 0.9); }
  .status-wishlist { background: rgba(245, 158, 11, 0.9); }
  .status-backlog { background: rgba(59, 130, 246, 0.9); }
  .status-trade { background: rgba(139, 92, 246, 0.9); }
  
  .overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
  }
  
  .title {
    margin: 0 0 4px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .meta {
    display: flex;
    gap: 8px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .rating {
    color: #fbbf24;
  }
`;

const STATUS_LABELS: Record<CollectionStatus, string> = {
  none: "",
  owned: "✓ Owned",
  wishlist: "★ Wishlist",
  backlog: "📚 Backlog",
  trade: "↔ Trade",
};

export class GameCard extends BaseComponent {
  private game: GameWithKey | null = null;
  private status: CollectionStatus = "none";

  static get observedAttributes(): string[] {
    return ["game-key"];
  }

  setGame(game: GameWithKey): void {
    this.game = game;
    this.status = getGameStatus(game.key);
    this.render();
  }

  protected setup(): void {
    // Add styles
    const style = document.createElement("style");
    style.textContent = GAME_CARD_STYLES;
    this.shadow.appendChild(style);
  }

  protected render(): void {
    if (!this.game) return;

    const { game, status } = this;
    const rating = parseFloat(String(game.rating));
    const hasRating = !isNaN(rating);

    // Remove old content (keep styles)
    const existingCard = this.shadow.querySelector(".card");
    if (existingCard) existingCard.remove();

    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${game.game_name} for ${game.platform}`);

    card.innerHTML = `
      ${
        status !== "none"
          ? `
        <div class="status-badge status-${status}">${STATUS_LABELS[status]}</div>
      `
          : ""
      }
      <div class="cover">
        ${
          game.cover
            ? `
          <img 
            src="${this.escapeAttr(game.cover)}" 
            alt="${this.escapeAttr(game.game_name)} cover"
            loading="lazy"
          />
        `
            : `
          <div class="placeholder">${game.game_name.slice(0, 2).toUpperCase()}</div>
        `
        }
      </div>
      <div class="overlay">
        <h3 class="title">${this.escapeHtml(game.game_name)}</h3>
        <div class="meta">
          <span class="platform">${this.escapeHtml(game.platform)}</span>
          ${hasRating ? `<span class="rating">⭐ ${rating.toFixed(1)}</span>` : ""}
        </div>
      </div>
    `;

    this.shadow.appendChild(card);

    // Handle image errors
    const img = card.querySelector("img");
    if (img) {
      img.onerror = () => {
        img.style.display = "none";
        const cover = card.querySelector(".cover");
        if (cover && !cover.querySelector(".placeholder")) {
          const placeholder = document.createElement("div");
          placeholder.className = "placeholder";
          placeholder.textContent = game.game_name.slice(0, 2).toUpperCase();
          cover.appendChild(placeholder);
        }
      };
    }
  }

  protected bind(): void {
    const card = this.shadow.querySelector(".card");
    if (!card || !this.game) return;

    const handleClick = () => {
      if (this.game) {
        selectGame(this.game.key);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && this.game) {
        e.preventDefault();
        selectGame(this.game.key);
      }
    };

    card.addEventListener("click", handleClick);
    card.addEventListener("keydown", handleKeydown as EventListener);

    this.cleanups.push(() => {
      card.removeEventListener("click", handleClick);
      card.removeEventListener("keydown", handleKeydown as EventListener);
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
}

// === Register Components ===

export function registerComponents(): void {
  if (!customElements.get("game-card")) {
    customElements.define("game-card", GameCard);
  }
}

// === Helper Functions ===

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | undefined>,
  ...children: Array<string | Node>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue;
      if (value === true) {
        element.setAttribute(key, "");
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  for (const child of children) {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }

  return element;
}

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// === Mount Helpers ===

export type MountCleanup = () => void;
export type MountFunction = (element: HTMLElement) => MountCleanup;

export function mount(selector: string | HTMLElement, fn: MountFunction): MountCleanup {
  const element =
    typeof selector === "string"
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!element) {
    console.warn(`Mount target not found: ${selector}`);
    return () => {};
  }

  return fn(element);
}

// === Utility Components ===

export function renderSkeleton(count: number): DocumentFragment {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const skeleton = createElement("div", {
      class: "skeleton-card",
      "aria-hidden": "true",
    });
    skeleton.innerHTML = `
      <div class="skeleton-cover"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text skeleton-text--short"></div>
    `;
    fragment.appendChild(skeleton);
  }

  return fragment;
}

export function renderEmptyState(message: string, icon = "🎮"): HTMLElement {
  const container = createElement("div", { class: "empty-state" });
  container.innerHTML = `
    <div class="empty-state__icon">${icon}</div>
    <h3 class="empty-state__title">No Games Found</h3>
    <p class="empty-state__message">${escapeHtml(message)}</p>
  `;
  return container;
}

export function renderErrorState(error: string): HTMLElement {
  const container = createElement("div", { class: "error-state" });
  container.innerHTML = `
    <div class="error-state__icon">⚠️</div>
    <h3 class="error-state__title">Error</h3>
    <p class="error-state__message">${escapeHtml(error)}</p>
    <button class="error-state__retry" onclick="location.reload()">Retry</button>
  `;
  return container;
}
