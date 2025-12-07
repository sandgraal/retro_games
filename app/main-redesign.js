/**
 * Main Application Entry Point - Redesign Integration
 * Self-contained bootstrap that loads data directly without depending on app.js
 */

import { updateDashboard, calculateStats } from "./ui/dashboard-new.js";
import { renderGrid, setupQuickActions, showLoadingSkeletons } from "./ui/grid-new.js";

// Show loading state immediately
showLoadingSkeletons();

// Bootstrap the new UI with fresh data load
async function bootstrapNewUI() {
  try {
    console.log("🎮 Bootstrapping new UI...");

    // Load owned games and other statuses from localStorage
    const owned = JSON.parse(localStorage.getItem("roms_owned") || "{}");
    const notes = JSON.parse(localStorage.getItem("rom_notes") || "{}");
    const statuses = {
      wishlist: JSON.parse(localStorage.getItem("roms_wishlist") || "{}"),
      backlog: JSON.parse(localStorage.getItem("roms_backlog") || "{}"),
      trade: JSON.parse(localStorage.getItem("roms_trade") || "{}"),
    };

    // Try to load from Supabase first
    let games = [];
    let dataSource = "sample";

    const supabaseConfig = window.__SUPABASE_CONFIG__;
    if (supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const { createClient } = window.supabase;
        const client = createClient(supabaseConfig.url, supabaseConfig.anonKey);
        const { data, error } = await client
          .from("games")
          .select("*")
          .order("game_name", { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          games = data;
          dataSource = "supabase";
          console.log(`✅ Loaded ${games.length} games from Supabase`);
        }
      } catch (err) {
        console.warn(
          "⚠️ Supabase load failed, falling back to sample data:",
          err.message
        );
      }
    }

    // Fallback to sample data
    if (games.length === 0) {
      const response = await fetch("./data/sample-games.json");
      const json = await response.json();
      games = json.games || json || [];
      console.log(`✅ Loaded ${games.length} games from sample data`);
    }

    if (!games.length) {
      throw new Error("No games available to display!");
    }

    // Store globally for filter operations
    window.__GAMES_DATA__ = games;
    window.__OWNED_DATA__ = owned;
    window.__STATUSES_DATA__ = statuses;
    window.__NOTES_DATA__ = notes;

    // Calculate dashboard stats and render
    const stats = calculateStats(games, owned, statuses);
    updateDashboard(stats);

    // Setup filters with game data
    setupFilters(games);

    // Render grid with all games initially
    renderGrid(games, owned, statuses);

    // Setup event handlers
    setupQuickActions();
    setupFilterHandlers();
    setupMobileNavigation();

    // Show status message if using sample data
    if (dataSource === "sample") {
      showStatus("Showing sample dataset. Configure Supabase for cloud sync.", "info");
    }

    console.log("✅ New UI initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing new UI:", error);
    showError(`Failed to load game data: ${error.message}`);
  }
}

/**
 * Setup filters with platform and genre data from games
 */
function setupFilters(games) {
  // Platform filter
  const platformFilters = document.getElementById("platformFilters");
  if (platformFilters) {
    const platforms = [...new Set(games.map((g) => g.platform))].filter(Boolean).sort();
    platformFilters.innerHTML = platforms
      .map(
        (platform) => `
        <label class="filter-option">
          <input type="checkbox" value="${platform}" data-filter="platform" />
          <span class="filter-option-label">${platform}</span>
          <span class="filter-option-count">0</span>
        </label>
      `
      )
      .join("");
  }

  // Genre filter
  const genreFilters = document.getElementById("genreFilters");
  if (genreFilters) {
    const genres = [
      ...new Set(
        games.flatMap((g) => (g.genre ? g.genre.split(",").map((x) => x.trim()) : []))
      ),
    ]
      .filter(Boolean)
      .sort();
    genreFilters.innerHTML = genres
      .map(
        (genre) => `
        <label class="filter-option">
          <input type="checkbox" value="${genre}" data-filter="genre" />
          <span class="filter-option-label">${genre}</span>
          <span class="filter-option-count">0</span>
        </label>
      `
      )
      .join("");
  }

  // Initial filter count update
  updateFilterCounts(games);
}

/**
 * Setup filter handlers for the new sidebar
 */
function setupFilterHandlers() {
  // Listen for filter changes
  document.addEventListener("change", (e) => {
    if (e.target.dataset.filter) {
      applyFilters();
    }
  });

  // Search filter
  const filterSearch = document.getElementById("filterSearch");
  const headerSearch = document.getElementById("headerSearch");

  [filterSearch, headerSearch].forEach((input) => {
    if (input) {
      input.addEventListener("input", debounce(applyFilters, 300));
    }
  });

  // Sort options
  document.getElementById("sortOptions")?.addEventListener("click", (e) => {
    const sortBtn = e.target.closest(".sort-option");
    if (sortBtn) {
      document
        .querySelectorAll(".sort-option")
        .forEach((btn) => btn.classList.remove("active"));
      sortBtn.classList.add("active");
      applyFilters();
    }
  });

  // Clear filters
  document.getElementById("clearFilters")?.addEventListener("click", () => {
    document
      .querySelectorAll("input[data-filter]")
      .forEach((input) => (input.checked = false));
    if (filterSearch) filterSearch.value = "";
    if (headerSearch) headerSearch.value = "";
    applyFilters();
  });
}

/**
 * Apply filters and re-render grid
 */
function applyFilters() {
  const games = window.__GAMES_DATA__ || [];
  if (!games.length) return;

  let filtered = [...games];

  // Get active filters
  const platformFilters = Array.from(
    document.querySelectorAll('input[data-filter="platform"]:checked')
  ).map((cb) => cb.value);
  const genreFilters = Array.from(
    document.querySelectorAll('input[data-filter="genre"]:checked')
  ).map((cb) => cb.value);
  const statusFilters = Array.from(
    document.querySelectorAll("#statusFilters input:checked")
  ).map((cb) => cb.value);

  // Apply platform filter
  if (platformFilters.length > 0) {
    filtered = filtered.filter((game) => platformFilters.includes(game.platform));
  }

  // Apply genre filter
  if (genreFilters.length > 0) {
    filtered = filtered.filter((game) =>
      genreFilters.some((genre) => game.genre?.includes(genre))
    );
  }

  // Apply search filter
  const searchTerm = (
    document.getElementById("filterSearch")?.value ||
    document.getElementById("headerSearch")?.value ||
    ""
  )
    .toLowerCase()
    .trim();
  if (searchTerm) {
    filtered = filtered.filter((game) =>
      Object.values(game).some((val) =>
        String(val || "")
          .toLowerCase()
          .includes(searchTerm)
      )
    );
  }

  // Apply status filter
  if (statusFilters.length > 0) {
    const owned = window.__OWNED_DATA__ || {};
    const statuses = window.__STATUSES_DATA__ || {};
    filtered = filtered.filter((game) => {
      const gameKey = `${game.game_name}___${game.platform}`;
      if (statusFilters.includes("owned") && owned[gameKey]) return true;
      if (statusFilters.includes("wishlist") && statuses.wishlist[gameKey]) return true;
      if (statusFilters.includes("backlog") && statuses.backlog[gameKey]) return true;
      if (statusFilters.includes("trade") && statuses.trade[gameKey]) return true;
      return false;
    });
  }

  // Apply sort
  const activeSort =
    document.querySelector(".sort-option.active")?.dataset.sort || "name";
  filtered = sortGames(filtered, activeSort);

  // Update filter counts
  updateFilterCounts(filtered);

  // Re-render grid
  renderGrid(filtered, window.__OWNED_DATA__ || {}, window.__STATUSES_DATA__ || {});

  // Update clear button state
  const hasActiveFilters =
    platformFilters.length > 0 ||
    genreFilters.length > 0 ||
    searchTerm ||
    statusFilters.length > 0;
  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn) {
    clearBtn.disabled = !hasActiveFilters;
  }
}

/**
 * Sort games array
 */
function sortGames(games, sortBy) {
  const sorted = [...games];
  switch (sortBy) {
    case "name":
      return sorted.sort((a, b) => (a.game_name || "").localeCompare(b.game_name || ""));
    case "rating":
      return sorted.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    case "year":
      return sorted.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
    case "value":
      // Placeholder - needs price data
      return sorted;
    default:
      return sorted;
  }
}

/**
 * Update filter counts
 */
function updateFilterCounts(filteredGames) {
  // Update platform counts
  const platformCounts = {};
  filteredGames.forEach((game) => {
    platformCounts[game.platform] = (platformCounts[game.platform] || 0) + 1;
  });
  document.querySelectorAll('input[data-filter="platform"]').forEach((input) => {
    const count = platformCounts[input.value] || 0;
    const label = input.parentElement?.querySelector(".filter-option-count");
    if (label) label.textContent = count;
  });

  // Update genre counts
  const genreCounts = {};
  filteredGames.forEach((game) => {
    (game.genre || "")
      .split(",")
      .map((g) => g.trim())
      .forEach((genre) => {
        if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
  });
  document.querySelectorAll('input[data-filter="genre"]').forEach((input) => {
    const count = genreCounts[input.value] || 0;
    const label = input.parentElement?.querySelector(".filter-option-count");
    if (label) label.textContent = count;
  });
}

/**
 * Setup mobile navigation
 */
function setupMobileNavigation() {
  // Filter toggle for mobile
  const filtersToggle = document.getElementById("filtersToggle");
  const filtersSidebar = document.getElementById("filtersSidebar");
  const filtersBackdrop = document.getElementById("filtersBackdrop");

  if (filtersToggle && filtersSidebar && filtersBackdrop) {
    filtersToggle.addEventListener("click", () => {
      filtersSidebar.classList.toggle("open");
      filtersBackdrop.classList.toggle("visible");
    });

    filtersBackdrop.addEventListener("click", () => {
      filtersSidebar.classList.remove("open");
      filtersBackdrop.classList.remove("visible");
    });
  }

  // Mobile nav items
  document.querySelectorAll(".mobile-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".mobile-nav-item")
        .forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

/**
 * Show status message
 */
function showStatus(message, type = "info") {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
    statusEl.style.display = "block";
  }
}

/**
 * Show error message
 */
function showError(message) {
  const gridElement = document.getElementById("gameGrid");
  if (gridElement) {
    gridElement.innerHTML = `
      <div class="error">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h3 class="error-title">Error</h3>
        <p class="error-message">${message}</p>
      </div>
    `;
  }
}

/**
 * Debounce helper
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Listen for game status changes from quick actions
window.addEventListener("gameStatusChange", (e) => {
  const { gameKey, action } = e.detail;

  if (action === "own") {
    const owned = window.__OWNED_DATA__ || {};
    owned[gameKey] = true;
    localStorage.setItem("roms_owned", JSON.stringify(owned));
    window.__OWNED_DATA__ = owned;
  }

  // Recalculate stats and update dashboard
  const games = window.__GAMES_DATA__ || [];
  const owned = window.__OWNED_DATA__ || {};
  const statuses = window.__STATUSES_DATA__ || {};
  const stats = calculateStats(games, owned, statuses);
  updateDashboard(stats);

  // Re-render grid to update visual state
  applyFilters();
});

// Listen for modal open requests
window.addEventListener("openGameModal", (e) => {
  const { game, gameKey } = e.detail;
  console.log("Open modal for:", game?.game_name || gameKey);
  // TODO: Implement modal using existing modal.js or create new modal
});

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapNewUI);
} else {
  bootstrapNewUI();
}

console.log("🎮 Redesign integration module loaded");
