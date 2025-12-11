/**
 * Dragon's Hoard Atlas
 * Main Application Entry Point
 *
 * A modern, type-safe retro game collection tracker
 */

import { loadGames, loadPrices } from "./data";
import {
  getAuthSession,
  signInWithGitHub,
  signOut,
  onAuthStateChange,
  type AuthSession,
} from "./data/auth";
import {
  setGames,
  setPrices,
  setPriceMeta,
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
  mountGuides,
  showGuidesView,
  hideGuidesView,
  navigateToGuide,
  mountModerationPanel,
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
      // Use relative path to work with Vite base path on GitHub Pages
      const registration = await navigator.serviceWorker.register("./sw.js");
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

    // Resolve auth session (Supabase or anonymous) early
    const authSessionPromise = getAuthSession();

    // Mount UI components
    cleanupFunctions.push(
      mountDashboard("#dashboardGrid"),
      mountGameGrid("#gameGrid"),
      mountFilters("#filtersSidebar"),
      mountModal("#gameModalBackdrop"),
      mountSettingsModal(),
      mountGuides("#guidesContainer")
    );

    // Load game data
    setLoading(true);

    const [gamesResult, priceData, authSession] = await Promise.all([
      loadGames(),
      loadPrices(),
      authSessionPromise,
    ]);

    setGames(gamesResult.games);
    setPrices(priceData.prices);
    setPriceMeta({
      lastUpdated: priceData.lastUpdated,
      source: priceData.source,
      reason: priceData.reason,
    });
    setDataSource(gamesResult.source);
    setLoading(false);

    console.log(`✅ Loaded ${gamesResult.games.length} games from ${gamesResult.source}`);

    // Show status if using sample data
    if (gamesResult.source === "sample") {
      const fallbackDetails = gamesResult.reason ? `${gamesResult.reason}. ` : "";
      showStatus(
        `${fallbackDetails}Showing sample dataset. Configure Supabase for cloud sync.`,
        "info"
      );
    }

    // Check for share code in URL
    checkUrlShareCode();

    // Check for guides view in URL
    checkUrlGuidesView();

    // Moderation UI (hidden for non-moderators by default)
    const shouldShowModeration = ["moderator", "admin"].includes(authSession.role);
    if (shouldShowModeration) {
      cleanupFunctions.push(mountModerationPanel("#moderationPanel"));
      // Show moderation button in header
      const moderationBtn = document.getElementById("moderationBtn");
      if (moderationBtn) moderationBtn.hidden = false;
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

  // Setup auth state listener
  setupAuthListener();

  // Initialize auth UI
  const initialSession = await getAuthSession();
  updateAuthUI(initialSession);

  // Setup dashboard quick actions
  setupDashboardActions();

  // Setup guide navigation from modal
  setupGuideNavigation();
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

  // Setup main navigation tabs
  const navItems = document.querySelectorAll<HTMLElement>(".mobile-nav-item[data-nav]");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const { nav } = item.dataset;
      if (nav === "guides") {
        switchToView("guides");
      } else if (nav === "collection") {
        switchToView("collection");
      }

      // Update active state
      navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

/**
 * Track current view state
 */
let currentAppView: "collection" | "guides" | "moderation" = "collection";

/**
 * Switch between main views
 */
function switchToView(view: "collection" | "guides" | "moderation"): void {
  const heroDashboard = document.querySelector<HTMLElement>(".hero-dashboard");
  const collectionSection = document.querySelector<HTMLElement>(".collection-container");
  const guidesContainer = document.getElementById("guidesContainer");
  const moderationPanel = document.getElementById("moderationPanel");

  // Hide all views first
  if (heroDashboard) heroDashboard.hidden = true;
  if (collectionSection) collectionSection.hidden = true;
  if (guidesContainer) {
    guidesContainer.hidden = true;
    hideGuidesView();
  }
  if (moderationPanel) moderationPanel.hidden = true;

  if (view === "guides") {
    // Show guides
    if (guidesContainer) {
      guidesContainer.hidden = false;
      showGuidesView();
    }
    currentAppView = "guides";
  } else if (view === "moderation") {
    // Show moderation panel
    if (moderationPanel) {
      moderationPanel.hidden = false;
    }
    currentAppView = "moderation";
  } else {
    // Show collection view
    if (heroDashboard) heroDashboard.hidden = false;
    if (collectionSection) collectionSection.hidden = false;
    currentAppView = "collection";
  }

  // Scroll to top when switching views
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Update header button state
  const guidesBtn = document.getElementById("guidesBtn");
  const moderationBtn = document.getElementById("moderationBtn");
  if (guidesBtn) {
    guidesBtn.classList.toggle("active", view === "guides");
  }
  if (moderationBtn) {
    moderationBtn.classList.toggle("active", view === "moderation");
  }
}

/**
 * Handle guides toggle from header button
 */
function handleGuidesToggle(): void {
  if (currentAppView === "guides") {
    switchToView("collection");
  } else {
    switchToView("guides");
  }

  // Update mobile nav active state
  const navItems = document.querySelectorAll<HTMLElement>(".mobile-nav-item[data-nav]");
  navItems.forEach((item) => {
    const isActive =
      (currentAppView === "guides" && item.dataset.nav === "guides") ||
      (currentAppView === "collection" && item.dataset.nav === "collection");
    item.classList.toggle("active", isActive);
  });
}

/**
 * Setup header action buttons
 */
function setupHeaderActions(): void {
  const homeBtn = document.getElementById("homeBtn");
  const guidesBtn = document.getElementById("guidesBtn");
  const moderationBtn = document.getElementById("moderationBtn");
  const exportBtn = document.getElementById("exportBtn");
  const shareBtn = document.getElementById("shareBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const authBtn = document.getElementById("authBtn");

  homeBtn?.addEventListener("click", () => {
    switchToView("collection");
    // Clear URL params
    window.history.pushState({}, "", window.location.pathname);
  });
  guidesBtn?.addEventListener("click", handleGuidesToggle);
  moderationBtn?.addEventListener("click", () => {
    if (currentAppView === "moderation") {
      switchToView("collection");
      window.history.pushState({}, "", window.location.pathname);
    } else {
      switchToView("moderation");
      window.history.pushState({}, "", "?view=moderation");
    }
  });
  exportBtn?.addEventListener("click", handleExport);
  shareBtn?.addEventListener("click", handleShare);
  settingsBtn?.addEventListener("click", handleSettings);
  authBtn?.addEventListener("click", handleAuth);
}

/**
 * Handle auth button click - sign in or show user menu
 */
async function handleAuth(): Promise<void> {
  const session = await getAuthSession();
  const authBtn = document.getElementById("authBtn");

  if (session.isAuthenticated) {
    // Show sign out confirmation
    const confirmSignOut = window.confirm(
      `Signed in as ${session.email || "User"}\n\nSign out?`
    );
    if (confirmSignOut) {
      await signOut();
      updateAuthUI(await getAuthSession());
      showStatus("Signed out successfully", "success");
    }
  } else {
    // Sign in with GitHub
    try {
      if (authBtn) {
        authBtn.textContent = "⏳";
        authBtn.setAttribute("disabled", "");
      }
      await signInWithGitHub();
      // Will redirect to GitHub, then back
    } catch (error) {
      showStatus(
        `Sign in failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
      if (authBtn) {
        authBtn.innerHTML = '<span aria-hidden="true">👤</span>';
        authBtn.removeAttribute("disabled");
      }
    }
  }
}

/**
 * Update auth button UI based on session
 */
function updateAuthUI(session: AuthSession): void {
  const authBtn = document.getElementById("authBtn");
  if (!authBtn) return;

  if (session.isAuthenticated) {
    authBtn.innerHTML = '<span aria-hidden="true">✓</span>';
    authBtn.title = `Signed in as ${session.email || "User"} - Click to sign out`;
    authBtn.classList.add("authenticated");
  } else {
    authBtn.innerHTML = '<span aria-hidden="true">👤</span>';
    authBtn.title = "Sign in with GitHub";
    authBtn.classList.remove("authenticated");
  }

  // Show/hide moderation button based on role
  const moderationBtn = document.getElementById("moderationBtn");
  if (moderationBtn) {
    moderationBtn.hidden = !["moderator", "admin"].includes(session.role);
  }
}

/**
 * Setup auth state listener
 */
function setupAuthListener(): void {
  onAuthStateChange((session) => {
    updateAuthUI(session);
    // Refresh moderation panel if role changed
    if (["moderator", "admin"].includes(session.role)) {
      const moderationPanel = document.getElementById("moderationPanel");
      if (moderationPanel && !moderationPanel.hidden) {
        // Panel is already visible, no action needed
      }
    }
  });
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
 * Setup guide navigation from modal
 */
function setupGuideNavigation(): void {
  window.addEventListener("navigateToGuide", ((event: CustomEvent<{ slug: string }>) => {
    const { slug } = event.detail;
    switchToView("guides");
    navigateToGuide(slug);
  }) as EventListener);
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
    } catch {
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
 * Check URL for guides view and switch if present
 */
function checkUrlGuidesView(): void {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const guideParam = params.get("guide");

  if (viewParam === "moderation") {
    switchToView("moderation");
    // Update mobile nav active state
    const navItems = document.querySelectorAll<HTMLElement>(".mobile-nav-item[data-nav]");
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.nav === "moderation");
    });
    return;
  }

  if (viewParam === "guides" || guideParam) {
    switchToView("guides");
    // Update mobile nav active state
    const navItems = document.querySelectorAll<HTMLElement>(".mobile-nav-item[data-nav]");
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.nav === "guides");
    });
  }
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
