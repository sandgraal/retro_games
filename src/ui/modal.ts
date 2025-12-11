/**
 * Modal Component
 * Beautiful game detail modal with guides integration
 */

import type { GameWithKey, CollectionStatus } from "../core/types";
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
import { buildGuideIndex, type GuideMetadata } from "../data/guides";

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
          <span class="status-icon">✓</span>
          <span class="status-label">Owned</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "wishlist" ? "active" : ""}" data-status="wishlist" title="Add to Wishlist">
          <span class="status-icon">★</span>
          <span class="status-label">Wishlist</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "backlog" ? "active" : ""}" data-status="backlog" title="Add to Backlog">
          <span class="status-icon">📋</span>
          <span class="status-label">Backlog</span>
        </button>
        <button type="button" class="modal-status-btn ${status === "trade" ? "active" : ""}" data-status="trade" title="Mark for Trade">
          <span class="status-icon">↔</span>
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
      
      <div class="modal-notes">
        <label for="notesInput" class="modal-notes-label">
          <span class="modal-notes-icon">📝</span>
          Your Notes
        </label>
        <textarea id="notesInput" class="modal-notes-input" rows="3" placeholder="Add personal notes about this game...">${escapeHtml(notes)}</textarea>
      </div>
      
      ${
        game.Details
          ? `
      <div class="modal-links">
        <a href="${escapeHtml(game.Details)}" target="_blank" rel="noopener noreferrer" class="modal-external-link">
          <span class="link-icon">📖</span>
          <span class="link-text">View on Wikipedia</span>
          <span class="link-arrow">→</span>
        </a>
      </div>
      `
          : ""
      }
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
