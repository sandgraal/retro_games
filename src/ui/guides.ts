/**
 * Guides UI Components
 * Index view and guide viewer with collection integration
 * Features: TOC navigation, search, collection progress, reading indicator
 */

import { el, escapeHtml } from "./components";
import {
  buildGuideIndex,
  loadGuide,
  type GuideMetadata,
  type Guide,
} from "../data/guides";
import { games, collection, setGameStatus, openGameModal } from "../state";
import type { CollectionStatus, GameWithKey } from "../core/types";

// === State ===

type ViewState = { view: "index" } | { view: "guide"; slug: string };

let currentView: ViewState = { view: "index" };
let currentGuide: Guide | null = null;
let guideIndex: GuideMetadata[] = [];
let filterCategory: "all" | "console" | "genre" = "all";
let filterPlatform = "all";
let containerElement: HTMLElement | null = null;

// Interactive features state
let readingProgress = 0;
let tocActiveId = "";
let scrollListener: (() => void) | null = null;

// === Guide Index Component ===

function renderGuideIndex(): HTMLElement {
  const container = el.div({ class: "guides-container" });

  // Header
  const header = el.div({ class: "guides-header" });
  header.innerHTML = `
    <h1 class="guides-title">Collector's Guides</h1>
    <p class="guides-subtitle">Expert guides for building your retro game collection</p>
  `;
  container.appendChild(header);

  // Filters
  const filters = el.div({ class: "guides-filters" });
  filters.innerHTML = `
    <div class="guides-filter-group">
      <label class="guides-filter-label">Category</label>
      <select class="guides-filter-select" id="guideCategoryFilter">
        <option value="all">All Guides</option>
        <option value="console">Console Guides</option>
        <option value="genre">Genre Guides</option>
      </select>
    </div>
    <div class="guides-filter-group">
      <label class="guides-filter-label">Platform</label>
      <select class="guides-filter-select" id="guidePlatformFilter">
        <option value="all">All Platforms</option>
      </select>
    </div>
  `;
  container.appendChild(filters);

  // Populate platform filter
  const platformSelect = filters.querySelector(
    "#guidePlatformFilter"
  ) as HTMLSelectElement;
  const platforms = [
    ...new Set(guideIndex.filter((g) => g.platform).map((g) => g.platform!)),
  ].sort();
  platforms.forEach((platform) => {
    const option = document.createElement("option");
    option.value = platform;
    option.textContent = platform;
    platformSelect.appendChild(option);
  });

  // Filter event listeners
  const categorySelect = filters.querySelector(
    "#guideCategoryFilter"
  ) as HTMLSelectElement;
  categorySelect.value = filterCategory;
  categorySelect.addEventListener("change", () => {
    filterCategory = categorySelect.value as typeof filterCategory;
    updateGuideGrid();
  });

  platformSelect.value = filterPlatform;
  platformSelect.addEventListener("change", () => {
    filterPlatform = platformSelect.value;
    updateGuideGrid();
  });

  // Guide grid
  const grid = el.div({ class: "guides-grid", id: "guidesGrid" });
  container.appendChild(grid);

  // Render initial grid
  renderGuideCards(grid);

  return container;
}

function renderGuideCards(grid: HTMLElement): void {
  grid.innerHTML = "";

  const filteredGuides = guideIndex.filter((guide) => {
    if (filterCategory !== "all" && guide.category !== filterCategory) return false;
    if (filterPlatform !== "all" && guide.platform !== filterPlatform) return false;
    return true;
  });

  // Group by category then by platform/genre
  const consoleGuides = filteredGuides.filter((g) => g.category === "console");
  const genreGuides = filteredGuides.filter((g) => g.category === "genre");

  if (
    consoleGuides.length > 0 &&
    (filterCategory === "all" || filterCategory === "console")
  ) {
    const section = el.div({ class: "guides-section" });
    section.innerHTML = `<h2 class="guides-section-title">Console Guides</h2>`;
    const cards = el.div({ class: "guides-cards" });

    // Group by platform
    const byPlatform = new Map<string, GuideMetadata[]>();
    consoleGuides.forEach((g) => {
      const platform = g.platform || "Other";
      if (!byPlatform.has(platform)) byPlatform.set(platform, []);
      byPlatform.get(platform)!.push(g);
    });

    byPlatform.forEach((platformGuides, platform) => {
      const card = createGuideCard(platform, platformGuides);
      cards.appendChild(card);
    });

    section.appendChild(cards);
    grid.appendChild(section);
  }

  if (
    genreGuides.length > 0 &&
    (filterCategory === "all" || filterCategory === "genre")
  ) {
    const section = el.div({ class: "guides-section" });
    section.innerHTML = `<h2 class="guides-section-title">Genre Guides</h2>`;
    const cards = el.div({ class: "guides-cards" });

    genreGuides.forEach((guide) => {
      const card = createSingleGuideCard(guide);
      cards.appendChild(card);
    });

    section.appendChild(cards);
    grid.appendChild(section);
  }

  if (filteredGuides.length === 0) {
    grid.innerHTML = `<div class="guides-empty">No guides match your filters</div>`;
  }
}

function createGuideCard(platform: string, platformGuides: GuideMetadata[]): HTMLElement {
  const card = el.div({ class: "guide-card" });

  const platformIcon = getPlatformIcon(platform);
  const reference = platformGuides.find((g) => g.type === "reference");
  const collecting = platformGuides.find((g) => g.type === "collecting-guide");

  card.innerHTML = `
    <div class="guide-card-header">
      <span class="guide-card-icon">${platformIcon}</span>
      <h3 class="guide-card-title">${escapeHtml(platform)}</h3>
    </div>
    <div class="guide-card-links">
      ${reference ? `<button class="guide-card-link" data-slug="${reference.slug}">📖 Reference</button>` : ""}
      ${collecting ? `<button class="guide-card-link guide-card-link-primary" data-slug="${collecting.slug}">💎 Collecting Guide</button>` : ""}
    </div>
  `;

  // Event listeners
  card.querySelectorAll<HTMLElement>(".guide-card-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-slug");
      if (slug) navigateToGuide(slug);
    });
  });

  return card;
}

function createSingleGuideCard(guide: GuideMetadata): HTMLElement {
  const card = el.div({ class: "guide-card" });

  const icon = guide.genre === "RPG" ? "⚔️" : "🎮";

  card.innerHTML = `
    <div class="guide-card-header">
      <span class="guide-card-icon">${icon}</span>
      <h3 class="guide-card-title">${escapeHtml(guide.genre || guide.title)}</h3>
    </div>
    <p class="guide-card-desc">${escapeHtml(guide.description)}</p>
    <div class="guide-card-links">
      <button class="guide-card-link guide-card-link-primary" data-slug="${guide.slug}">💎 Collecting Guide</button>
    </div>
  `;

  card.querySelector(".guide-card-link")?.addEventListener("click", () => {
    navigateToGuide(guide.slug);
  });

  return card;
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    "Atari 2600/7800": "🕹️",
    Dreamcast: "💿",
    "Game Boy": "🎮",
    GameCube: "🟣",
    Genesis: "🔵",
    "Master System": "🔴",
    "Nintendo 64": "🎯",
    "Neo Geo": "🏆",
    NES: "🎮",
    PlayStation: "⚪",
    "PlayStation 2": "🔷",
    PSP: "📱",
    Saturn: "🪐",
    SNES: "🟢",
    "TurboGrafx-16": "🟠",
    Wii: "🎳",
  };
  return icons[platform] || "🎮";
}

function updateGuideGrid(): void {
  const grid = document.getElementById("guidesGrid");
  if (grid) renderGuideCards(grid);
}

// === Table of Contents ===

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractTableOfContents(content: HTMLElement): TocItem[] {
  const headings = content.querySelectorAll("h1, h2, h3");
  const toc: TocItem[] = [];

  headings.forEach((heading, index) => {
    const text = heading.textContent?.trim() || "";
    const level = parseInt(heading.tagName.charAt(1));
    const id = `toc-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    // Add id to heading for scroll targeting
    heading.id = id;

    toc.push({ id, text, level });
  });

  return toc;
}

function renderTableOfContents(toc: TocItem[]): HTMLElement {
  const tocContainer = el.div({ class: "guide-toc" });

  tocContainer.innerHTML = `
    <div class="guide-toc-header">
      <span class="guide-toc-icon">📑</span>
      <span class="guide-toc-title">Contents</span>
    </div>
    <nav class="guide-toc-nav">
      ${toc
        .map(
          (item) => `
        <a href="#${item.id}" 
           class="guide-toc-link guide-toc-level-${item.level}" 
           data-toc-id="${item.id}">
          ${escapeHtml(item.text)}
        </a>
      `
        )
        .join("")}
    </nav>
  `;

  // Smooth scroll on click
  tocContainer.querySelectorAll<HTMLElement>(".guide-toc-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("data-toc-id");
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          // Update URL without scroll
          history.replaceState(null, "", `#${targetId}`);
        }
      }
    });
  });

  return tocContainer;
}

function updateTocHighlight(toc: TocItem[]): void {
  const headings = toc.map((item) => ({
    id: item.id,
    element: document.getElementById(item.id),
  }));

  let currentId = toc[0]?.id || "";

  for (const { id, element } of headings) {
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top <= 150) {
        currentId = id;
      }
    }
  }

  if (currentId !== tocActiveId) {
    tocActiveId = currentId;

    // Update active state
    document.querySelectorAll(".guide-toc-link").forEach((link) => {
      link.classList.toggle("active", link.getAttribute("data-toc-id") === currentId);
    });
  }
}

// === Reading Progress ===

function updateReadingProgress(): void {
  const content = document.querySelector(".guide-content");
  const progressBar = document.querySelector(".guide-progress-bar") as HTMLElement;

  if (!content || !progressBar) return;

  const rect = content.getBoundingClientRect();
  const contentTop = rect.top;
  const contentHeight = rect.height;
  const windowHeight = window.innerHeight;

  // Calculate progress (0-100)
  const scrolled = Math.max(0, -contentTop + 100);
  const total = contentHeight - windowHeight + 200;
  readingProgress = Math.min(100, Math.max(0, (scrolled / total) * 100));

  progressBar.style.width = `${readingProgress}%`;

  // Update percentage display
  const progressText = document.querySelector(".guide-progress-text");
  if (progressText) {
    progressText.textContent = `${Math.round(readingProgress)}%`;
  }
}

// === Search Within Guide ===

function createSearchHighlighter(content: HTMLElement): (query: string) => number {
  // Store original HTML
  const originalHTML = content.innerHTML;

  return (query: string): number => {
    // Reset to original
    content.innerHTML = originalHTML;

    if (!query || query.length < 2) {
      // Re-enhance tables after reset
      enhanceGuideTables(content);
      return 0;
    }

    const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    let matchCount = 0;

    // Walk text nodes and highlight matches
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((node) => {
      const text = node.textContent || "";
      if (regex.test(text)) {
        const span = document.createElement("span");
        span.innerHTML = text.replace(regex, (match) => {
          matchCount++;
          return `<mark class="guide-search-highlight">${escapeHtml(match)}</mark>`;
        });
        node.parentNode?.replaceChild(span, node);
      }
      // Reset regex lastIndex
      regex.lastIndex = 0;
    });

    // Re-enhance tables after modification
    enhanceGuideTables(content);

    return matchCount;
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// === Collection Stats ===

function calculateCollectionStats(content: HTMLElement): {
  total: number;
  owned: number;
  wishlist: number;
  backlog: number;
} {
  const allGames = games.get();
  const userCollection = collection.get();
  const tables = content.querySelectorAll("table");

  let total = 0;
  let owned = 0;
  let wishlist = 0;
  let backlog = 0;

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll("th")).map(
      (th) => th.textContent?.toLowerCase() || ""
    );
    const titleIndex = headers.findIndex(
      (h) => h.includes("title") || h.includes("game")
    );

    if (titleIndex === -1) return;

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length <= titleIndex) return;

      const gameName = cells[titleIndex].textContent?.trim() || "";
      const platform = currentGuide?.platform;

      const matchedGame = findMatchingGame(allGames, gameName, platform || "");
      if (matchedGame) {
        total++;
        const status = userCollection.get(matchedGame.key)?.status || "none";
        if (status === "owned") owned++;
        if (status === "wishlist") wishlist++;
        if (status === "backlog") backlog++;
      }
    });
  });

  return { total, owned, wishlist, backlog };
}

function renderCollectionStats(stats: {
  total: number;
  owned: number;
  wishlist: number;
  backlog: number;
}): HTMLElement {
  const container = el.div({ class: "guide-collection-stats" });
  const percent = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;

  container.innerHTML = `
    <div class="guide-stats-header">
      <span class="guide-stats-icon">🎮</span>
      <span class="guide-stats-title">Your Progress</span>
    </div>
    <div class="guide-stats-progress">
      <div class="guide-stats-bar">
        <div class="guide-stats-fill" style="width: ${percent}%"></div>
      </div>
      <span class="guide-stats-percent">${percent}%</span>
    </div>
    <div class="guide-stats-breakdown">
      <div class="guide-stats-item owned">
        <span class="guide-stats-count">${stats.owned}</span>
        <span class="guide-stats-label">Owned</span>
      </div>
      <div class="guide-stats-item wishlist">
        <span class="guide-stats-count">${stats.wishlist}</span>
        <span class="guide-stats-label">Wishlist</span>
      </div>
      <div class="guide-stats-item backlog">
        <span class="guide-stats-count">${stats.backlog}</span>
        <span class="guide-stats-label">Backlog</span>
      </div>
      <div class="guide-stats-item total">
        <span class="guide-stats-count">${stats.total}</span>
        <span class="guide-stats-label">Listed</span>
      </div>
    </div>
  `;

  return container;
}

// === Guide Viewer Component ===

async function renderGuideViewer(slug: string): Promise<HTMLElement> {
  const container = el.div({ class: "guide-viewer" });

  // Find guide metadata
  const meta = guideIndex.find((g) => g.slug === slug);
  if (!meta) {
    container.innerHTML = `<div class="guide-error">Guide not found</div>`;
    return container;
  }

  // Loading state
  container.innerHTML = `
    <div class="guide-loading">
      <div class="guide-loading-spinner"></div>
      <p>Loading guide...</p>
    </div>
  `;

  // Load full guide
  const guide = await loadGuide(meta.path);
  if (!guide) {
    container.innerHTML = `<div class="guide-error">Failed to load guide</div>`;
    return container;
  }

  currentGuide = guide;
  container.innerHTML = "";

  // Reading progress bar (fixed at top)
  const progressContainer = el.div({ class: "guide-progress" });
  progressContainer.innerHTML = `
    <div class="guide-progress-bar"></div>
    <span class="guide-progress-text">0%</span>
  `;
  container.appendChild(progressContainer);

  // Back button
  const backBtn = el.button({ class: "guide-back-btn" });
  backBtn.innerHTML = `← Back to Guides`;
  backBtn.addEventListener("click", () => {
    cleanup();
    navigateToIndex();
  });
  container.appendChild(backBtn);

  // Guide header with search
  const header = el.div({ class: "guide-header" });
  header.innerHTML = `
    <div class="guide-meta">
      <span class="guide-category-badge">${guide.category === "console" ? guide.platform : guide.genre}</span>
      <span class="guide-type-badge">${guide.type === "reference" ? "Reference" : "Collecting Guide"}</span>
    </div>
    <h1 class="guide-title">${escapeHtml(guide.title)}</h1>
    <p class="guide-description">${escapeHtml(guide.description)}</p>
    <div class="guide-header-row">
      <div class="guide-updated">Last updated: ${guide.updated || guide.date}</div>
      <div class="guide-search">
        <input type="text" class="guide-search-input" placeholder="🔍 Search in guide..." />
        <span class="guide-search-results"></span>
      </div>
    </div>
  `;
  container.appendChild(header);

  // Main layout: sidebar + content
  const layout = el.div({ class: "guide-layout" });

  // Sidebar with TOC and stats
  const sidebar = el.div({ class: "guide-sidebar" });

  // Guide content
  const content = el.div({ class: "guide-content" });
  content.innerHTML = guide.htmlContent;

  // Extract TOC from content (must be done after content is set)
  const toc = extractTableOfContents(content);
  if (toc.length > 2) {
    sidebar.appendChild(renderTableOfContents(toc));
  }

  // Collection stats
  enhanceGuideTables(content);
  const stats = calculateCollectionStats(content);
  if (stats.total > 0) {
    sidebar.appendChild(renderCollectionStats(stats));
  }

  layout.appendChild(sidebar);
  layout.appendChild(content);
  container.appendChild(layout);

  // Search functionality
  const searchInput = header.querySelector(".guide-search-input") as HTMLInputElement;
  const searchResults = header.querySelector(".guide-search-results") as HTMLElement;
  const highlight = createSearchHighlighter(content);

  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const count = highlight(searchInput.value);
      if (searchInput.value.length >= 2) {
        searchResults.textContent = `${count} match${count !== 1 ? "es" : ""}`;
        searchResults.classList.add("visible");

        // Scroll to first match
        const firstMatch = content.querySelector(".guide-search-highlight");
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        searchResults.classList.remove("visible");
      }
    }, 200);
  });

  // Scroll handlers for TOC and reading progress
  const handleScroll = (): void => {
    updateReadingProgress();
    if (toc.length > 2) {
      updateTocHighlight(toc);
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  scrollListener = handleScroll;

  // Cleanup function
  function cleanup(): void {
    if (scrollListener) {
      window.removeEventListener("scroll", scrollListener);
      scrollListener = null;
    }
    readingProgress = 0;
    tocActiveId = "";
  }

  // Initial update
  setTimeout(handleScroll, 100);

  return container;
}

// === Collection Integration ===

function enhanceGuideTables(container: HTMLElement): void {
  const allGames = games.get();
  const userCollection = collection.get();

  // Find tables that look like game lists
  const tables = container.querySelectorAll("table");

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll("th")).map(
      (th) => th.textContent?.toLowerCase() || ""
    );

    // Check if this is a game table (has Title or Game Name column)
    const titleIndex = headers.findIndex(
      (h) => h.includes("title") || h.includes("game")
    );
    const platformIndex = headers.findIndex((h) => h.includes("platform"));

    if (titleIndex === -1) return;

    // Add collection status column header
    const headerRow = table.querySelector("tr");
    if (headerRow) {
      const statusHeader = document.createElement("th");
      statusHeader.textContent = "Your Collection";
      statusHeader.className = "guide-table-status-header";
      headerRow.appendChild(statusHeader);
    }

    // Process each row
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length <= titleIndex) return;

      const gameName = cells[titleIndex].textContent?.trim() || "";
      const platform =
        platformIndex >= 0 && cells[platformIndex]
          ? cells[platformIndex].textContent?.trim()
          : currentGuide?.platform;

      // Try to find matching game in collection
      const matchedGame = findMatchingGame(allGames, gameName, platform || "");
      const status = matchedGame
        ? userCollection.get(matchedGame.key)?.status || "none"
        : "none";

      // Add status cell
      const statusCell = document.createElement("td");
      statusCell.className = "guide-table-status-cell";

      if (matchedGame) {
        statusCell.innerHTML = createCollectionControls(matchedGame, status);
        attachCollectionEvents(statusCell, matchedGame);
      } else {
        statusCell.innerHTML = `<span class="guide-game-not-found">—</span>`;
      }

      row.appendChild(statusCell);

      // Make game name clickable if we found a match
      if (matchedGame) {
        const titleCell = cells[titleIndex];
        titleCell.classList.add("guide-game-link");
        titleCell.addEventListener("click", () => openGameModal(matchedGame));
      }
    });

    // Add class for styling
    table.classList.add("guide-enhanced-table");

    // Add quick-add toolbar if there are matched games
    const tableGames = collectTableGames(table, allGames, titleIndex, platformIndex);
    if (tableGames.length > 0) {
      const toolbar = createQuickAddToolbar(tableGames, userCollection, table);
      table.parentNode?.insertBefore(toolbar, table);
    }
  });
}

// Collect all matched games from a table
function collectTableGames(
  table: Element,
  allGames: GameWithKey[],
  titleIndex: number,
  platformIndex: number
): GameWithKey[] {
  const matchedGames: GameWithKey[] = [];
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length <= titleIndex) return;

    const gameName = cells[titleIndex].textContent?.trim() || "";
    const platform =
      platformIndex >= 0 && cells[platformIndex]
        ? cells[platformIndex].textContent?.trim()
        : currentGuide?.platform;

    const matchedGame = findMatchingGame(allGames, gameName, platform || "");
    if (matchedGame) {
      matchedGames.push(matchedGame);
    }
  });

  return matchedGames;
}

// Create quick-add toolbar for batch operations
function createQuickAddToolbar(
  tableGames: GameWithKey[],
  userCollection: Map<string, { status: CollectionStatus }>,
  table: Element
): HTMLElement {
  const toolbar = el.div({ class: "guide-table-toolbar" });

  // Count current statuses
  let ownedCount = 0;
  let wishlistCount = 0;
  tableGames.forEach((game) => {
    const status = userCollection.get(game.key)?.status || "none";
    if (status === "owned") ownedCount++;
    if (status === "wishlist") wishlistCount++;
  });

  const notOwnedCount = tableGames.length - ownedCount;

  toolbar.innerHTML = `
    <div class="guide-toolbar-info">
      <span class="guide-toolbar-count">${tableGames.length} games in list</span>
      <span class="guide-toolbar-status">
        <span class="owned">${ownedCount} owned</span>
        <span class="wishlist">${wishlistCount} wishlist</span>
      </span>
    </div>
    <div class="guide-toolbar-actions">
      <button class="guide-toolbar-btn wishlist-all" ${notOwnedCount === 0 ? "disabled" : ""}>
        ★ Add ${notOwnedCount} to Wishlist
      </button>
      <button class="guide-toolbar-btn owned-all" ${notOwnedCount === 0 ? "disabled" : ""}>
        ✓ Mark ${notOwnedCount} as Owned
      </button>
    </div>
  `;

  // Add wishlist handler
  const wishlistBtn = toolbar.querySelector(".wishlist-all");
  wishlistBtn?.addEventListener("click", () => {
    tableGames.forEach((game) => {
      const status = userCollection.get(game.key)?.status || "none";
      if (status !== "owned") {
        setGameStatus(game.key, "wishlist");
      }
    });
    // Update table UI
    updateTableStatuses(table);
    // Refresh toolbar
    const newToolbar = createQuickAddToolbar(tableGames, collection.get(), table);
    toolbar.replaceWith(newToolbar);
    // Update stats widget
    updateStatsWidget();
  });

  // Add owned handler
  const ownedBtn = toolbar.querySelector(".owned-all");
  ownedBtn?.addEventListener("click", () => {
    tableGames.forEach((game) => {
      setGameStatus(game.key, "owned");
    });
    // Update table UI
    updateTableStatuses(table);
    // Refresh toolbar
    const newToolbar = createQuickAddToolbar(tableGames, collection.get(), table);
    toolbar.replaceWith(newToolbar);
    // Update stats widget
    updateStatsWidget();
  });

  return toolbar;
}

// Update table row status buttons
function updateTableStatuses(table: Element): void {
  const userCollection = collection.get();

  table.querySelectorAll<HTMLElement>(".guide-collection-controls").forEach((controls) => {
    const gameKey = controls.getAttribute("data-game-key");
    if (!gameKey) return;

    const status = userCollection.get(gameKey)?.status || "none";
    controls.querySelectorAll(".guide-status-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-status") === status);
    });
  });
}

// Update the stats widget in sidebar
function updateStatsWidget(): void {
  const content = document.querySelector(".guide-content");
  if (!content) return;

  const stats = calculateCollectionStats(content as HTMLElement);
  const statsWidget = document.querySelector(".guide-collection-stats");
  if (statsWidget) {
    const newWidget = renderCollectionStats(stats);
    statsWidget.replaceWith(newWidget);
  }
}

function findMatchingGame(
  allGames: GameWithKey[],
  gameName: string,
  platform: string
): GameWithKey | null {
  const normalizedName = gameName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    allGames.find((game) => {
      const gameNameNorm = game.game_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const platformMatch =
        !platform ||
        game.platform.toLowerCase().includes(platform.toLowerCase()) ||
        platform.toLowerCase().includes(game.platform.toLowerCase());
      return gameNameNorm === normalizedName && platformMatch;
    }) || null
  );
}

function createCollectionControls(game: GameWithKey, status: CollectionStatus): string {
  const buttons = [
    { status: "owned", icon: "✓", label: "Owned", class: "owned" },
    { status: "wishlist", icon: "★", label: "Wishlist", class: "wishlist" },
    { status: "backlog", icon: "📋", label: "Backlog", class: "backlog" },
  ];

  return `
    <div class="guide-collection-controls" data-game-key="${game.key}">
      ${buttons
        .map(
          (btn) => `
        <button 
          class="guide-status-btn ${btn.class} ${status === btn.status ? "active" : ""}" 
          data-status="${btn.status}"
          title="${btn.label}"
        >${btn.icon}</button>
      `
        )
        .join("")}
    </div>
  `;
}

function attachCollectionEvents(cell: HTMLElement, game: GameWithKey): void {
  cell.querySelectorAll<HTMLElement>(".guide-status-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newStatus = btn.getAttribute("data-status") as CollectionStatus;
      const currentStatus = collection.get().get(game.key)?.status || "none";

      // Toggle off if clicking same status
      const finalStatus = currentStatus === newStatus ? "none" : newStatus;
      setGameStatus(game.key, finalStatus);

      // Update UI
      const controls = cell.querySelector(".guide-collection-controls");
      if (controls) {
        controls.querySelectorAll(".guide-status-btn").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-status") === finalStatus);
        });
      }
    });
  });
}

// === Navigation ===

function navigateToGuide(slug: string): void {
  currentView = { view: "guide", slug };
  updateView();
  // Update URL without page reload
  window.history.pushState({ view: "guide", slug }, "", `?guide=${slug}`);
}

function navigateToIndex(): void {
  currentView = { view: "index" };
  currentGuide = null;
  updateView();
  window.history.pushState({ view: "index" }, "", "?view=guides");
}

async function updateView(): Promise<void> {
  if (!containerElement) return;

  containerElement.innerHTML = "";

  if (currentView.view === "index") {
    containerElement.appendChild(renderGuideIndex());
  } else {
    const viewer = await renderGuideViewer(currentView.slug);
    containerElement.appendChild(viewer);
  }
}

// === Mount Function ===

export function mountGuides(selector: string): () => void {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn(`Guides container not found: ${selector}`);
    return () => {};
  }

  containerElement = element as HTMLElement;
  guideIndex = buildGuideIndex();

  // Check URL for initial state
  const params = new URLSearchParams(window.location.search);
  const guideSlug = params.get("guide");
  if (guideSlug) {
    currentView = { view: "guide", slug: guideSlug };
  } else if (params.get("view") === "guides") {
    currentView = { view: "index" };
  }

  // Handle browser back/forward
  window.addEventListener("popstate", (event) => {
    if (event.state?.view === "guide" && event.state.slug) {
      currentView = { view: "guide", slug: event.state.slug };
      updateView();
    } else if (event.state?.view === "index") {
      currentView = { view: "index" };
      updateView();
    }
  });

  updateView();

  // Cleanup function
  return () => {
    containerElement = null;
  };
}

// === Public API ===

export function showGuidesView(): void {
  navigateToIndex();
}

export function hideGuidesView(): void {
  if (containerElement) {
    containerElement.innerHTML = "";
  }
}

export { navigateToGuide, guideIndex };
