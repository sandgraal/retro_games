/**
 * Settings Modal Component
 * Application preferences and data management
 */

import { createSignal, effect } from "../core/signals";
import {
  theme,
  viewMode,
  setTheme,
  setViewMode,
  resetCollection,
  collectionStats,
  setGameStatus,
  setGameNotes,
} from "../state/store";
import { parseBackup, createBackup, downloadFile, getExportStats } from "../features";
import type { Theme, ViewMode } from "../core/types";

// Settings modal visibility state
const settingsOpenSignal = createSignal(false);

/**
 * Open the settings modal
 */
export function openSettings(): void {
  settingsOpenSignal.set(true);
}

/**
 * Close the settings modal
 */
export function closeSettings(): void {
  settingsOpenSignal.set(false);
}

/**
 * Initialize and mount the settings modal
 */
export function mountSettingsModal(): () => void {
  // Create modal container if it doesn't exist
  let container = document.getElementById("settingsModal");
  if (!container) {
    container = document.createElement("div");
    container.id = "settingsModal";
    container.className = "modal-overlay settings-modal";
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("aria-labelledby", "settingsTitle");
    container.setAttribute("hidden", "");
    document.body.appendChild(container);
  }

  // Subscribe to visibility changes
  const unsubOpen = effect(() => {
    const isOpen = settingsOpenSignal.get();

    if (isOpen) {
      renderSettings(container!);
      container!.removeAttribute("hidden");
      container!.classList.add("open");
      document.body.style.overflow = "hidden";
      trapFocus(container!);
    } else {
      container!.setAttribute("hidden", "");
      container!.classList.remove("open");
      document.body.style.overflow = "";
    }
  });

  // Close on backdrop click
  container.addEventListener("click", (e) => {
    if (e.target === container) {
      closeSettings();
    }
  });

  // Close on escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && settingsOpenSignal.get()) {
      closeSettings();
    }
  };
  document.addEventListener("keydown", escHandler);

  return () => {
    unsubOpen();
    document.removeEventListener("keydown", escHandler);
    container?.remove();
  };
}

/**
 * Render settings modal content
 */
function renderSettings(container: HTMLElement): void {
  const currentTheme = theme.get();
  const currentViewMode = viewMode.get();
  const stats = collectionStats.get();

  container.innerHTML = `
    <div class="modal__dialog settings-dialog" role="document">
      <button type="button" class="modal__close" aria-label="Close settings">×</button>
      
      <h2 id="settingsTitle" class="modal__title">⚙️ Settings</h2>
      
      <div class="settings-content">
        <!-- Appearance Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">Appearance</h3>
          
          <div class="settings-option">
            <label for="themeSelect">Theme</label>
            <select id="themeSelect" class="settings-select">
              <option value="dark" ${currentTheme === "dark" ? "selected" : ""}>🌙 Dark</option>
              <option value="light" ${currentTheme === "light" ? "selected" : ""}>☀️ Light</option>
              <option value="system" ${currentTheme === "system" ? "selected" : ""}>🖥️ System</option>
            </select>
          </div>
          
          <div class="settings-option">
            <label for="viewModeSelect">Default View</label>
            <select id="viewModeSelect" class="settings-select">
              <option value="grid" ${currentViewMode === "grid" ? "selected" : ""}>🔲 Grid</option>
              <option value="list" ${currentViewMode === "list" ? "selected" : ""}>📋 List</option>
              <option value="table" ${currentViewMode === "table" ? "selected" : ""}>📊 Table</option>
            </select>
          </div>
        </section>
        
        <!-- Data Management Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">Data Management</h3>
          
          <div class="settings-stats">
            <div class="settings-stat">
              <span class="settings-stat-value">${stats.ownedCount}</span>
              <span class="settings-stat-label">Owned</span>
            </div>
            <div class="settings-stat">
              <span class="settings-stat-value">${stats.wishlistCount}</span>
              <span class="settings-stat-label">Wishlist</span>
            </div>
            <div class="settings-stat">
              <span class="settings-stat-value">${stats.backlogCount}</span>
              <span class="settings-stat-label">Backlog</span>
            </div>
            <div class="settings-stat">
              <span class="settings-stat-value">${stats.tradeCount}</span>
              <span class="settings-stat-label">For Trade</span>
            </div>
          </div>
          
          <div class="settings-actions">
            <button type="button" class="settings-btn settings-btn--primary" id="backupSettingsBtn">
              📦 Create Backup
            </button>
            <button type="button" class="settings-btn" id="restoreBtn">
              📥 Restore Backup
            </button>
            <button type="button" class="settings-btn settings-btn--danger" id="clearDataBtn">
              🗑️ Clear Collection
            </button>
          </div>
          
          <input type="file" id="restoreFileInput" accept=".json" style="display: none" />
        </section>
        
        <!-- About Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">About</h3>
          <div class="settings-about">
            <p><strong>Dragon's Hoard Atlas</strong> v2.0</p>
            <p>A privacy-first retro game collection tracker.</p>
            <p class="settings-about-note">
              All data stored locally in your browser. No account required.
            </p>
          </div>
        </section>
      </div>
    </div>
  `;

  // Setup event handlers
  setupSettingsHandlers(container);
}

/**
 * Setup event handlers for settings controls
 */
function setupSettingsHandlers(container: HTMLElement): void {
  // Close button
  const closeBtn = container.querySelector(".modal__close");
  closeBtn?.addEventListener("click", closeSettings);

  // Theme select
  const themeSelect = container.querySelector("#themeSelect") as HTMLSelectElement;
  themeSelect?.addEventListener("change", () => {
    setTheme(themeSelect.value as Theme);
    applyTheme(themeSelect.value as Theme);
  });

  // View mode select
  const viewModeSelect = container.querySelector("#viewModeSelect") as HTMLSelectElement;
  viewModeSelect?.addEventListener("change", () => {
    setViewMode(viewModeSelect.value as ViewMode);
  });

  // Backup button
  const backupBtn = container.querySelector("#backupSettingsBtn");
  backupBtn?.addEventListener("click", handleBackup);

  // Restore button + file input
  const restoreBtn = container.querySelector("#restoreBtn");
  const fileInput = container.querySelector("#restoreFileInput") as HTMLInputElement;
  restoreBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", handleRestore);

  // Clear data button
  const clearBtn = container.querySelector("#clearDataBtn");
  clearBtn?.addEventListener("click", handleClearData);
}

/**
 * Apply theme to document
 */
function applyTheme(newTheme: Theme): void {
  const root = document.documentElement;

  if (newTheme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", newTheme);
  }
}

/**
 * Handle backup creation
 */
function handleBackup(): void {
  const backup = createBackup();
  const filename = `dragons-hoard-backup-${formatDate()}.json`;
  downloadFile(JSON.stringify(backup, null, 2), filename, "application/json");
  showToast("Backup created successfully!", "success");
}

/**
 * Handle restore from backup
 */
function handleRestore(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    const backup = parseBackup(content);

    if (!backup) {
      showToast("Invalid backup file", "error");
      return;
    }

    // Count items to restore
    const total = Object.keys(backup.collection).length;

    if (
      !confirm(
        `Restore ${total} games from backup?\n\nThis will replace your current collection.`
      )
    ) {
      return;
    }

    // Clear and restore
    resetCollection();

    // Import the backup
    Object.entries(backup.collection).forEach(([key, entry]) => {
      if (typeof entry === "object" && entry.status) {
        setGameStatus(key, (entry as { status: string }).status as any);
      }
    });

    if (backup.notes) {
      Object.entries(backup.notes).forEach(([key, note]) => {
        if (typeof note === "string") {
          setGameNotes(key, note);
        }
      });
    }

    showToast(`Restored ${total} games!`, "success");
    closeSettings();
  };

  reader.readAsText(file);
  input.value = ""; // Reset for re-upload
}

/**
 * Handle clear collection data
 */
function handleClearData(): void {
  const stats = getExportStats();

  if (stats.total === 0) {
    showToast("Collection is already empty", "info");
    return;
  }

  if (
    !confirm(
      `Delete ${stats.total} games from your collection?\n\nThis action cannot be undone.`
    )
  ) {
    return;
  }

  resetCollection();
  renderSettings(document.getElementById("settingsModal")!);
  showToast("Collection cleared", "success");
}

/**
 * Show a toast notification
 */
function showToast(message: string, type: "info" | "success" | "error"): void {
  // Find or create toast container
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add("toast--exit");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", handler);
}

/**
 * Format date for filenames
 */
function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}
