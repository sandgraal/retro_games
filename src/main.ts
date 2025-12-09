/**
 * Dragon's Hoard Atlas
 * Main Application Entry Point
 *
 * A modern, type-safe retro game collection tracker
 */

import { loadGames, loadPrices } from "./data";
import {
  setGames,
  setPrices,
  setLoading,
  setError,
  setDataSource,
  setGameStatus,
  setGameNotes,
  loadPersistedState,
} from "./state";
import {
  mountGameGrid,
  mountDashboard,
  mountFilters,
  mountModal,
  mountSettingsModal,
  openSettings,
} from "./ui";
import {
  exportCollectionToCSV,
  createBackup,
  createShareCode,
  parseShareCode,
  parseBackup,
  downloadFile,
  copyToClipboard,
  getExportStats,
} from "./features";

/**
 * Register service worker for offline support
 */
async function registerServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("📦 Service worker registered:", registration.scope);
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  }
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log("🎮 Dragon's Hoard Atlas initializing...");

  // Register service worker for offline support
  registerServiceWorker();

  const cleanupFunctions: (() => void)[] = [];

  try {
    // Load persisted user state (collection, preferences)
    loadPersistedState();

    // Mount UI components
    cleanupFunctions.push(
      mountDashboard("#dashboardGrid"),
      mountGameGrid("#gameGrid"),
      mountFilters("#filtersSidebar"),
      mountModal("#gameModal"),
      mountSettingsModal()
    );

    // Load game data
    setLoading(true);

    const [gamesResult, priceData] = await Promise.all([loadGames(), loadPrices()]);

    setGames(gamesResult.games);
    setPrices(priceData);
    setDataSource(gamesResult.source);
    setLoading(false);

    console.log(`✅ Loaded ${gamesResult.games.length} games from ${gamesResult.source}`);

    // Show status if using sample data
    if (gamesResult.source === "sample") {
      showStatus("Showing sample dataset. Configure Supabase for cloud sync.", "info");
    }

    // Check for share code in URL
    checkUrlShareCode();
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    setError(error instanceof Error ? error.message : "Unknown error");
    setLoading(false);
    showStatus("Failed to load game data. Please try refreshing.", "error");
  }

  // Setup mobile navigation
  setupMobileNav();

  // Setup header actions
  setupHeaderActions();

  // Setup dashboard quick actions
  setupDashboardActions();
}

/**
 * Show a status message
 */
function showStatus(message: string, type: "info" | "error" | "success"): void {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
    statusEl.style.display = "block";
  }
}

/**
 * Setup mobile navigation
 */
function setupMobileNav(): void {
  const toggle = document.getElementById("filtersToggle");
  const sidebar = document.getElementById("filtersSidebar");
  const backdrop = document.getElementById("filtersBackdrop");

  if (toggle && sidebar && backdrop) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("visible");
    });

    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("visible");
    });
  }
}

/**
 * Setup header action buttons
 */
function setupHeaderActions(): void {
  const exportBtn = document.getElementById("exportBtn");
  const shareBtn = document.getElementById("shareBtn");
  const settingsBtn = document.getElementById("settingsBtn");

  exportBtn?.addEventListener("click", handleExport);
  shareBtn?.addEventListener("click", handleShare);
  settingsBtn?.addEventListener("click", handleSettings);
}

/**
 * Setup dashboard quick action buttons
 */
function setupDashboardActions(): void {
  const importBtn = document.getElementById("importBtn");
  const backupBtn = document.getElementById("backupBtn");
  const contributeBtn = document.getElementById("contributeBtn");

  importBtn?.addEventListener("click", handleImport);
  backupBtn?.addEventListener("click", handleBackup);
  contributeBtn?.addEventListener("click", handleContribute);
}

/**
 * Handle import action (file upload)
 */
function handleImport(): void {
  // Create a file input and trigger it
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.csv";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const content = await file.text();

      if (file.name.endsWith(".json")) {
        // Try to parse as backup
        const backup = parseBackup(content);
        if (backup) {
          const total = Object.keys(backup.collection).length;
          if (confirm(`Import ${total} games from backup?`)) {
            importBackup(backup);
            showStatus(`Imported ${total} games!`, "success");
          }
        } else {
          showStatus("Invalid backup file format.", "error");
        }
      } else {
        showStatus("CSV import coming soon!", "info");
      }
    } catch (error) {
      showStatus("Failed to read file.", "error");
    }
  };
  input.click();
}

/**
 * Import a backup payload
 */
function importBackup(backup: ReturnType<typeof parseBackup>): void {
  if (!backup) return;

  Object.entries(backup.collection).forEach(([key, entry]) => {
    if (typeof entry === "object" && entry && "status" in entry) {
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
}

/**
 * Handle backup action
 */
function handleBackup(): void {
  const stats = getExportStats();

  if (stats.total === 0) {
    showStatus("No games in collection to backup.", "info");
    return;
  }

  const backup = createBackup();
  const filename = `dragons-hoard-backup-${formatDate()}.json`;
  downloadFile(JSON.stringify(backup, null, 2), filename, "application/json");
  showStatus(`Backup created: ${filename}`, "success");
}

/**
 * Handle contribute action
 */
function handleContribute(): void {
  // Open contribution guide or form
  window.open(
    "https://github.com/sandgraal/retro-games/blob/main/CONTRIBUTING.md",
    "_blank"
  );
}

/**
 * Handle export action
 */
function handleExport(): void {
  const stats = getExportStats();

  if (stats.total === 0) {
    showStatus("No games in collection to export.", "info");
    return;
  }

  // Show export options dialog
  const action = prompt(
    `Export Options:\n` +
      `1 - CSV (${stats.total} games)\n` +
      `2 - Full Backup (JSON)\n\n` +
      `Enter 1 or 2:`,
    "1"
  );

  if (action === "1") {
    const csv = exportCollectionToCSV();
    const filename = `dragons-hoard-collection-${formatDate()}.csv`;
    downloadFile(csv, filename, "text/csv");
    showStatus(`Exported ${stats.total} games to ${filename}`, "success");
  } else if (action === "2") {
    const backup = createBackup();
    const filename = `dragons-hoard-backup-${formatDate()}.json`;
    downloadFile(JSON.stringify(backup, null, 2), filename, "application/json");
    showStatus(`Backup created: ${filename}`, "success");
  }
}

/**
 * Handle share action
 */
async function handleShare(): Promise<void> {
  const stats = getExportStats();

  if (stats.total === 0) {
    showStatus("No games in collection to share.", "info");
    return;
  }

  const code = createShareCode();

  // Try native share if available
  if (navigator.share) {
    try {
      await navigator.share({
        title: "My Dragon's Hoard Collection",
        text: `Check out my retro game collection (${stats.owned} owned, ${stats.wishlist} wishlist)`,
        url: `${window.location.origin}?share=${encodeURIComponent(code)}`,
      });
      return;
    } catch {
      // User cancelled or share failed, fall through to clipboard
    }
  }

  // Fallback to clipboard
  const success = await copyToClipboard(code);
  if (success) {
    showStatus("Share code copied to clipboard!", "success");
  } else {
    showStatus("Failed to copy share code.", "error");
  }
}

/**
 * Handle settings action
 */
function handleSettings(): void {
  openSettings();
}

/**
 * Check URL for share code and import if present
 */
function checkUrlShareCode(): void {
  const params = new URLSearchParams(window.location.search);
  const shareCode = params.get("share");

  if (!shareCode) return;

  const data = parseShareCode(decodeURIComponent(shareCode));
  if (!data) {
    showStatus("Invalid share code in URL.", "error");
    return;
  }

  // Count games to import
  const total =
    data.owned.length + data.wishlist.length + data.backlog.length + data.trade.length;

  if (total === 0) {
    showStatus("Share code contains no games.", "info");
    return;
  }

  // Ask user if they want to import
  const confirm = window.confirm(
    `Import shared collection?\n\n` +
      `${data.owned.length} owned\n` +
      `${data.wishlist.length} wishlist\n` +
      `${data.backlog.length} backlog\n` +
      `${data.trade.length} for trade\n\n` +
      `This will merge with your existing collection.`
  );

  if (!confirm) return;

  // Import the collection
  data.owned.forEach((key) => setGameStatus(key, "owned"));
  data.wishlist.forEach((key) => setGameStatus(key, "wishlist"));
  data.backlog.forEach((key) => setGameStatus(key, "backlog"));
  data.trade.forEach((key) => setGameStatus(key, "trade"));

  // Clean up URL
  window.history.replaceState({}, "", window.location.pathname);

  showStatus(`Imported ${total} games from shared collection!`, "success");
}

/**
 * Format date for filenames
 */
function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Start the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
