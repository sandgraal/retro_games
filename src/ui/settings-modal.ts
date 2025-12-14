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
  // Apply initial theme on mount
  applyTheme(theme.get());

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

  const dialog = document.createElement("div");
  dialog.className = "modal__dialog settings-dialog";
  dialog.setAttribute("role", "document");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "modal__close";
  closeBtn.setAttribute("aria-label", "Close settings");
  closeBtn.textContent = "×";
  dialog.appendChild(closeBtn);

  const title = document.createElement("h2");
  title.id = "settingsTitle";
  title.className = "modal__title";
  title.textContent = "⚙️ Settings";
  dialog.appendChild(title);

  const content = document.createElement("div");
  content.className = "settings-content";

  const appearanceSection = document.createElement("section");
  appearanceSection.className = "settings-section";

  const appearanceTitle = document.createElement("h3");
  appearanceTitle.className = "settings-section-title";
  appearanceTitle.textContent = "Appearance";
  appearanceSection.appendChild(appearanceTitle);

  const themeOption = document.createElement("div");
  themeOption.className = "settings-option";

  const themeLabel = document.createElement("label");
  themeLabel.htmlFor = "themeSelect";
  themeLabel.textContent = "Theme";
  themeOption.appendChild(themeLabel);

  const themeSelect = document.createElement("select");
  themeSelect.id = "themeSelect";
  themeSelect.className = "settings-select";

  [
    { value: "dark", label: "🌙 Dark" },
    { value: "light", label: "☀️ Light" },
    { value: "system", label: "🖥️ System" },
  ].forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = currentTheme === value;
    themeSelect.appendChild(option);
  });

  themeOption.appendChild(themeSelect);
  appearanceSection.appendChild(themeOption);

  const viewOption = document.createElement("div");
  viewOption.className = "settings-option";

  const viewLabel = document.createElement("label");
  viewLabel.htmlFor = "viewModeSelect";
  viewLabel.textContent = "Default View";
  viewOption.appendChild(viewLabel);

  const viewSelect = document.createElement("select");
  viewSelect.id = "viewModeSelect";
  viewSelect.className = "settings-select";

  [
    { value: "grid", label: "🔲 Grid" },
    { value: "list", label: "📋 List" },
    { value: "table", label: "📊 Table" },
  ].forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = currentViewMode === value;
    viewSelect.appendChild(option);
  });

  viewOption.appendChild(viewSelect);
  appearanceSection.appendChild(viewOption);

  const dataSection = document.createElement("section");
  dataSection.className = "settings-section";

  const dataTitle = document.createElement("h3");
  dataTitle.className = "settings-section-title";
  dataTitle.textContent = "Data Management";
  dataSection.appendChild(dataTitle);

  const statsGrid = document.createElement("div");
  statsGrid.className = "settings-stats";

  const statEntries: Array<[number, string]> = [
    [stats.ownedCount, "Owned"],
    [stats.wishlistCount, "Wishlist"],
    [stats.backlogCount, "Backlog"],
    [stats.tradeCount, "For Trade"],
  ];

  statEntries.forEach(([value, label]) => {
    const stat = document.createElement("div");
    stat.className = "settings-stat";

    const statValue = document.createElement("span");
    statValue.className = "settings-stat-value";
    statValue.textContent = String(value);

    const statLabel = document.createElement("span");
    statLabel.className = "settings-stat-label";
    statLabel.textContent = label;

    stat.append(statValue, statLabel);
    statsGrid.appendChild(stat);
  });

  dataSection.appendChild(statsGrid);

  const actions = document.createElement("div");
  actions.className = "settings-actions";

  const backupBtn = document.createElement("button");
  backupBtn.type = "button";
  backupBtn.className = "settings-btn settings-btn--primary";
  backupBtn.id = "backupSettingsBtn";
  backupBtn.textContent = "📦 Create Backup";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "settings-btn";
  restoreBtn.id = "restoreBtn";
  restoreBtn.textContent = "📥 Restore Backup";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "settings-btn settings-btn--danger";
  clearBtn.id = "clearDataBtn";
  clearBtn.textContent = "🗑️ Clear Collection";

  actions.append(backupBtn, restoreBtn, clearBtn);
  dataSection.appendChild(actions);

  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.id = "restoreFileInput";
  restoreInput.accept = ".json";
  restoreInput.style.display = "none";
  dataSection.appendChild(restoreInput);

  const aboutSection = document.createElement("section");
  aboutSection.className = "settings-section";

  const aboutTitle = document.createElement("h3");
  aboutTitle.className = "settings-section-title";
  aboutTitle.textContent = "About";
  aboutSection.appendChild(aboutTitle);

  const aboutContent = document.createElement("div");
  aboutContent.className = "settings-about";

  const productLine = document.createElement("p");
  const productStrong = document.createElement("strong");
  productStrong.textContent = "Dragon's Hoard Atlas";
  productLine.append(productStrong, document.createTextNode(" v2.0"));

  const description = document.createElement("p");
  description.textContent =
    "A privacy-first video game collection tracker for all platforms.";

  const aboutNote = document.createElement("p");
  aboutNote.className = "settings-about-note";
  aboutNote.textContent = "All data stored locally in your browser. No account required.";

  const privacyLink = document.createElement("a");
  privacyLink.className = "settings-about-link";
  // Use base URL for GitHub Pages compatibility
  const basePath = import.meta.env.BASE_URL || "/";
  privacyLink.href = `${basePath}privacy-faq.html`;
  privacyLink.textContent = "Read the privacy & data FAQ";

  const privacyNote = document.createElement("p");
  privacyNote.className = "settings-about-note";
  privacyNote.appendChild(privacyLink);

  aboutContent.append(productLine, description, aboutNote, privacyNote);
  aboutSection.appendChild(aboutContent);

  content.append(appearanceSection, dataSection, aboutSection);
  dialog.appendChild(content);

  container.replaceChildren(dialog);

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

// Listen for system theme changes
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
systemThemeQuery.addEventListener("change", () => {
  // Only react if user has "system" theme selected
  if (theme.get() === "system") {
    applyTheme("system");
  }
});

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
      if (entry.status) {
        setGameStatus(key, entry.status);
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
export function showToast(message: string, type: "info" | "success" | "error"): void {
  // Find or create toast container
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("role", "status");
    toastContainer.setAttribute("aria-live", "polite");
    toastContainer.setAttribute("aria-atomic", "true");
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
