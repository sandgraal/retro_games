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
  loadPersistedState,
} from "./state";
import { mountGameGrid, mountDashboard, mountFilters, mountModal } from "./ui";

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
      mountModal("#gameModal")
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

  exportBtn?.addEventListener("click", () => {
    // TODO: Implement export
    console.log("Export clicked");
  });

  shareBtn?.addEventListener("click", () => {
    // TODO: Implement sharing
    console.log("Share clicked");
  });

  settingsBtn?.addEventListener("click", () => {
    // TODO: Implement settings
    console.log("Settings clicked");
  });
}

// Start the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
