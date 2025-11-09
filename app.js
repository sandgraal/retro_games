// @ts-check

/*
  Sandgraal's Game List
  Author: Chris Sandgraal
  Github: https://github.com/sandgraal/retro_games
  Description: Retro ROM tracker and game explorer.
  2024-06
*/

// === Column Names and Keys ===

/**
 * @typedef {Object} GameRow
 * @property {string} [game_name]
 * @property {string} [platform]
 * @property {string} [genre]
 * @property {string} [cover]
 * @property {string|number} [rating]
 * @property {string|number} [release_year]
 * @property {string} [Details]
 * @property {string[]} [screenshots]
 * @property {Record<string, any>} [key: string]
 */

/** @typedef {Record<string, string>} StatusMap */
/** @typedef {Record<string, string>} NoteMap */
/**
 * @typedef {Object} FilterState
 * @property {string} [filterStatus]
 * @property {string} [filterRatingMin]
 * @property {string} [filterYearStart]
 * @property {string} [filterYearEnd]
 */
const COL_GAME = "game_name";
const COL_PLATFORM = "platform";
const COL_GENRE = "genre";
const COL_COVER = "cover";
const COL_RATING = "rating";
const COL_RELEASE_YEAR = "release_year";
const STORAGE_KEY = "roms_owned";
const NOTES_STORAGE_KEY = "rom_notes";
const STATUS_NONE = "none";
const STATUS_OWNED = "owned";
const STATUS_WISHLIST = "wishlist";
const STATUS_BACKLOG = "backlog";
const STATUS_TRADE = "trade";
const THEME_STORAGE_KEY = "rom_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";

const STATUS_OPTIONS = [
  { value: STATUS_NONE, label: "None" },
  { value: STATUS_OWNED, label: "Owned" },
  { value: STATUS_WISHLIST, label: "Wishlist" },
  { value: STATUS_BACKLOG, label: "Backlog" },
  { value: STATUS_TRADE, label: "Trade" },
];
const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const SAMPLE_DATA_URL = "./data/sample-games.json";
const BACKUP_FILENAME = "sandgraal-collection.json";
const FILTER_STORAGE_KEY = "rom_filters";

const reduceMotionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const registeredCarouselWindows = new Set();
let carouselControlsBound = false;

// === Supabase Config ===
const SUPABASE_CONFIG = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_URL = SUPABASE_CONFIG.url || "";
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || "";
let forceSampleFlag = false;
if (typeof window !== "undefined") {
  forceSampleFlag = !!window.__SANDGRAAL_FORCE_SAMPLE__;
  try {
    if (window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("sample") === "1") forceSampleFlag = true;
    }
  } catch {
    /* noop */
  }
} else if (typeof globalThis !== "undefined") {
  forceSampleFlag = !!globalThis.__SANDGRAAL_FORCE_SAMPLE__;
}
const FORCE_SAMPLE = forceSampleFlag;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (FORCE_SAMPLE) {
  console.info("Sample dataset forced via __SANDGRAAL_FORCE_SAMPLE__.");
} else if (!supabase) {
  console.warn(
    "Supabase credentials missing. Provide window.__SUPABASE_CONFIG__ in config.js."
  );
}

// === Fetch all games from Supabase ===
async function fetchGames() {
  if (!supabase) {
    throw new Error(
      "Supabase configuration missing. Copy config.example.js to config.js and add your credentials."
    );
  }
  let { data, error } = await supabase
    .from("games")
    .select("*")
    .order("game_name", { ascending: true });
  if (error) throw error;
  return data;
}

async function fetchSampleGames() {
  const response = await fetch(SAMPLE_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Sample data missing or inaccessible.");
  }
  return response.json();
}

async function loadGameData() {
  const useFallback = async (reason) => {
    console.warn("Using local sample data due to Supabase issue:", reason);
    const sample = await fetchSampleGames();
    return { data: sample, source: "sample" };
  };

  if (FORCE_SAMPLE || !supabase) {
    return useFallback("Supabase not configured.");
  }

  try {
    const data = await fetchGames();
    return { data, source: "supabase" };
  } catch (err) {
    return useFallback(err);
  }
}

/** @type {GameRow[]} */
let rawData = [];
/** @type {StatusMap} */
let gameStatuses = {};
/** @type {NoteMap} */
let gameNotes = {};
/** @type {StatusMap|null} */
let importedCollection = null;
/** @type {NoteMap|null} */
let importedNotes = null;
/** @type {FilterState} */
let persistedFilters = {};
let filterPlatform = "",
  filterGenre = "",
  searchValue = "",
  filterStatus = "",
  filterRatingMin = "",
  filterYearStart = "",
  filterYearEnd = "",
  sortColumn = COL_GAME,
  sortDirection = "asc";

/**
 * Parse a year string/number into an integer or null when invalid.
 * @param {string|number} value
 * @returns {number|null}
 */
function parseYear(value) {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Extracts release year from a data row using common field names.
 * @param {Record<string, any>} row
 * @returns {number|null}
 */
function getReleaseYear(row) {
  const fallbackValue =
    row[COL_RELEASE_YEAR] ?? row.release_year ?? row.releaseYear ?? row["Release Year"];
  return parseYear(fallbackValue);
}

function isValidTheme(theme) {
  return theme === THEME_LIGHT || theme === THEME_DARK;
}

function getStoredThemeChoice() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function getPreferredTheme() {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? THEME_LIGHT
        : THEME_DARK;
    } catch {
      /* noop */
    }
  }
  return THEME_DARK;
}

function applyThemeChoice(theme) {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (isValidTheme(theme)) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function persistThemeChoice(theme) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

function updateThemeToggleButton(activeTheme) {
  if (typeof document === "undefined") return;
  const button = document.getElementById("themeToggle");
  if (!button) return;
  const theme = isValidTheme(activeTheme) ? activeTheme : getPreferredTheme();
  const nextTheme = theme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
  const labelTarget = nextTheme === THEME_LIGHT ? "Light" : "Dark";
  button.textContent = `Switch to ${labelTarget} Theme`;
  button.setAttribute("aria-pressed", theme === THEME_LIGHT ? "true" : "false");
  button.setAttribute("aria-label", `Switch to ${labelTarget.toLowerCase()} theme`);
  button.setAttribute("title", button.textContent);
  button.dataset.nextTheme = nextTheme;
}

function initThemeToggle() {
  const initialStoredTheme = getStoredThemeChoice();
  const initialTheme = initialStoredTheme || getPreferredTheme();
  applyThemeChoice(initialTheme);
  updateThemeToggleButton(initialTheme);

  if (typeof document === "undefined") return;
  const button = document.getElementById("themeToggle");
  if (button) {
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || getPreferredTheme();
      const nextTheme = current === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      applyThemeChoice(nextTheme);
      persistThemeChoice(nextTheme);
      updateThemeToggleButton(nextTheme);
    });
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const syncThemeWithSystem = (event) => {
        if (getStoredThemeChoice()) return;
        const themeFromSystem = event.matches ? THEME_LIGHT : THEME_DARK;
        applyThemeChoice(themeFromSystem);
        updateThemeToggleButton(themeFromSystem);
      };
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncThemeWithSystem);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncThemeWithSystem);
      }
    } catch {
      /* noop */
    }
  }
}

/**
 * Resolve status for a given key, defaulting to STATUS_NONE.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
function getStatusForKey(key, sourceMap) {
  const map = sourceMap || gameStatuses;
  return map[key] || STATUS_NONE;
}

/**
 * Persist a status for the provided key.
 * @param {string} key
 * @param {string} status
 */
function setStatusForKey(key, status) {
  if (!status || status === STATUS_NONE) {
    delete gameStatuses[key];
  } else {
    gameStatuses[key] = status;
  }
}

/**
 * Read a saved note for the given key.
 * @param {string} key
 * @param {Record<string, string>} [sourceMap]
 * @returns {string}
 */
function getNoteForKey(key, sourceMap) {
  const map = sourceMap || gameNotes;
  return map[key] || "";
}

/**
 * Save a note (or remove when empty) for the given key.
 * @param {string} key
 * @param {string} note
 */
function setNoteForKey(key, note) {
  if (!note || !note.trim()) {
    delete gameNotes[key];
  } else {
    gameNotes[key] = note.trim();
  }
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function prefersReducedMotion() {
  return !!(reduceMotionQuery && reduceMotionQuery.matches);
}

function formatPercent(value, count = 0) {
  if (!count || !Number.isFinite(value) || value <= 0) return "0%";
  if (value < 1) return "<1%";
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

function updateCarouselButtons(windowEl) {
  if (!windowEl || !windowEl.parentElement) return;
  const parent = windowEl.parentElement;
  const targetId = windowEl.id;
  if (!targetId) return;
  const prevBtn = parent.querySelector(
    `[data-carousel-target="${targetId}"][data-direction="prev"]`
  );
  const nextBtn = parent.querySelector(
    `[data-carousel-target="${targetId}"][data-direction="next"]`
  );
  const maxScroll = Math.max(0, windowEl.scrollWidth - windowEl.clientWidth);
  if (prevBtn) prevBtn.disabled = windowEl.scrollLeft <= 1;
  if (nextBtn) nextBtn.disabled = windowEl.scrollLeft >= maxScroll - 1;
}

function registerCarouselWindow(windowEl) {
  if (!windowEl || windowEl.dataset.carouselRegistered) return;
  windowEl.dataset.carouselRegistered = "true";
  registeredCarouselWindows.add(windowEl);
  windowEl.addEventListener("scroll", () => updateCarouselButtons(windowEl), {
    passive: true,
  });
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => updateCarouselButtons(windowEl));
    observer.observe(windowEl);
    windowEl.__carouselObserver = observer;
  }
  updateCarouselButtons(windowEl);
}

function initCarouselControls() {
  if (carouselControlsBound || typeof document === "undefined") return;
  const controls = document.querySelectorAll("[data-carousel-target]");
  controls.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-carousel-target");
      if (!targetId) return;
      const windowEl = document.getElementById(targetId);
      if (!windowEl) return;
      const direction = button.getAttribute("data-direction") === "next" ? 1 : -1;
      const stepAttr = Number(button.getAttribute("data-scroll-step"));
      const baseStep = Math.round(windowEl.clientWidth * 0.85) || 220;
      const step = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : baseStep;
      windowEl.scrollBy({
        left: step * direction,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      const update = () => updateCarouselButtons(windowEl);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(update);
        window.setTimeout(update, prefersReducedMotion() ? 0 : 320);
      } else {
        update();
      }
    });
  });
  carouselControlsBound = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    registeredCarouselWindows.forEach((el) => updateCarouselButtons(el));
  });
  if (reduceMotionQuery && typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", () => {
      registeredCarouselWindows.forEach((el) => updateCarouselButtons(el));
    });
  }
}

/**
 * Initialize gallery controls inside modal.
 * @param {HTMLElement} modal
 * @param {string[]} images
 */
function initializeGallery(modal, images) {
  const galleryEl = modal.querySelector(".modal-gallery");
  if (!galleryEl) return;
  const imgEl = galleryEl.querySelector(".gallery-image");
  const counterEl = galleryEl.querySelector(".gallery-counter");
  const prevBtn = galleryEl.querySelector(".gallery-nav.prev");
  const nextBtn = galleryEl.querySelector(".gallery-nav.next");
  let currentIndex = 0;

  const updateImage = () => {
    const boundedIndex = ((currentIndex % images.length) + images.length) % images.length;
    currentIndex = boundedIndex;
    imgEl.src = images[boundedIndex];
    imgEl.alt = `${images[boundedIndex]} screenshot`;
    counterEl.textContent = `${boundedIndex + 1} / ${images.length}`;
  };

  prevBtn.onclick = () => {
    currentIndex -= 1;
    updateImage();
  };
  nextBtn.onclick = () => {
    currentIndex += 1;
    updateImage();
  };
  galleryEl.onkeydown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      currentIndex -= 1;
      updateImage();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      currentIndex += 1;
      updateImage();
    }
  };
  galleryEl.setAttribute("tabindex", "0");
  updateImage();
}

/**
 * LocalStorage: Load & Save status state
 */
function loadStatuses() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (raw && typeof raw === "object") {
      gameStatuses = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (typeof value === "string") {
          gameStatuses[key] = value;
        } else if (value === true) {
          gameStatuses[key] = STATUS_OWNED;
        }
      });
    } else {
      gameStatuses = {};
    }
  } catch {
    gameStatuses = {};
  }
}
function saveStatuses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameStatuses));
}

function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "{}");
    gameNotes = raw && typeof raw === "object" ? raw : {};
  } catch {
    gameNotes = {};
  }
}

function saveNotes() {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(gameNotes));
}

function loadPersistedFilters() {
  try {
    persistedFilters = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}");
  } catch {
    persistedFilters = {};
  }
}

function savePersistedFilters() {
  const snapshot = {
    filterStatus,
    filterRatingMin,
    filterYearStart,
    filterYearEnd,
  };
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(snapshot));
}

/** Sync current filter state into the DOM inputs. */
function applyFiltersToInputs() {
  const platformEl = document.getElementById("platformFilter");
  if (platformEl) platformEl.value = filterPlatform || "";
  const genreEl = document.getElementById("genreFilter");
  if (genreEl) genreEl.value = filterGenre || "";
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = searchValue || "";
  const statusEl = document.getElementById("statusFilter");
  if (statusEl) statusEl.value = filterStatus || "";
  const ratingEl = document.getElementById("ratingFilter");
  if (ratingEl) ratingEl.value = filterRatingMin || "";
  const yearStartEl = document.getElementById("yearStartFilter");
  if (yearStartEl) yearStartEl.value = filterYearStart || "";
  const yearEndEl = document.getElementById("yearEndFilter");
  if (yearEndEl) yearEndEl.value = filterYearEnd || "";
}

/**
 * Initialize platform and genre filter dropdowns from data.
 */
function setupFilters(data) {
  const platforms = [
    ...new Set(data.map((row) => row[COL_PLATFORM]).filter(Boolean)),
  ].sort();
  const platSel = document.getElementById("platformFilter");
  platSel.innerHTML =
    `<option value="">All Platforms</option>` +
    platforms.map((p) => `<option>${p}</option>`).join("");
  let allGenres = [];
  data.forEach((row) => {
    if (row[COL_GENRE])
      row[COL_GENRE].split(",")
        .map((g) => g.trim())
        .forEach((g) => allGenres.push(g));
  });
  const genres = [...new Set(allGenres)].sort();
  const genreSel = document.getElementById("genreFilter");
  genreSel.innerHTML =
    `<option value="">All Genres</option>` +
    genres.map((g) => `<option>${g}</option>`).join("");
}

/**
 * Apply search/filter logic to current data set.
 * @param {GameRow[]} data
 * @returns {GameRow[]}
 */
function applyFilters(data) {
  let statusSource = importedCollection || gameStatuses;
  return data.filter((row) => {
    if (filterPlatform && row[COL_PLATFORM] !== filterPlatform) return false;
    if (filterGenre) {
      if (
        !(
          row[COL_GENRE] &&
          row[COL_GENRE].split(",")
            .map((g) => g.trim())
            .includes(filterGenre)
        )
      )
        return false;
    }
    if (searchValue) {
      if (
        !Object.values(row).some(
          (v) => v && v.toString().toLowerCase().includes(searchValue)
        )
      )
        return false;
    }
    const ratingValue = parseFloat(row[COL_RATING]);
    const ratingMin = parseFloat(filterRatingMin);
    if (!Number.isNaN(ratingMin)) {
      if (Number.isNaN(ratingValue) || ratingValue < ratingMin) return false;
    }
    const releaseYear = getReleaseYear(row);
    const startYear = parseYear(filterYearStart);
    const endYear = parseYear(filterYearEnd);
    if (startYear !== null && (releaseYear === null || releaseYear < startYear))
      return false;
    if (endYear !== null && (releaseYear === null || releaseYear > endYear)) return false;
    const key = row[COL_GAME] + "___" + row[COL_PLATFORM];
    if (importedCollection && !importedCollection[key]) return false;
    const rowStatus = getStatusForKey(key, statusSource);
    if (filterStatus && rowStatus !== filterStatus) return false;
    return true;
  });
}

/**
 * Render the ROM table from (filtered) data.
 * @param {GameRow[]} data
 */
function renderTable(data) {
  if (sortColumn) {
    data = [...data].sort((a, b) => {
      const valueA = (a[sortColumn] || "").toString().toLowerCase();
      const valueB = (b[sortColumn] || "").toString().toLowerCase();
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }
  if (!data.length) {
    document.getElementById("romTable").style.display = "none";
    showError("No results match your filters.");
    return;
  }
  const headers = Object.keys(data[0]);
  const thead = document.querySelector("#romTable thead");
  const tbody = document.querySelector("#romTable tbody");
  thead.innerHTML =
    "<tr><th>Status</th>" +
    headers
      .map((h) => {
        const isActive = h === sortColumn;
        const directionIndicator =
          isActive && sortDirection === "asc" ? "▲" : isActive ? "▼" : "";
        return `<th role="button" tabindex="0" data-sort-key="${h}" aria-sort="${
          isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
        }">${h} ${directionIndicator}</th>`;
      })
      .join("") +
    "</tr>";
  tbody.innerHTML = data
    .map((row, idx) => {
      const key = row[COL_GAME] + "___" + row[COL_PLATFORM];
      const statusValue = getStatusForKey(key, importedCollection || gameStatuses);
      const statusLabel = STATUS_LABELS[statusValue] || STATUS_LABELS[STATUS_NONE];
      const pillClass =
        statusValue && statusValue !== STATUS_NONE
          ? `status-pill status-${statusValue}`
          : "status-pill";
      const noteValue = getNoteForKey(key, importedNotes || gameNotes);
      const noteBadge = noteValue
        ? '<span class="note-dot" title="Has note">✎</span>'
        : "";
      const statusCell = importedCollection
        ? `<td class="status-cell"><span class="${pillClass}">${statusLabel}</span>${noteBadge}</td>`
        : `<td class="status-cell">${renderStatusSelect(key, statusValue)}${noteBadge}</td>`;
      const rowClass =
        statusValue && statusValue !== STATUS_NONE
          ? `game-row status-${statusValue}`
          : "game-row";
      return (
        `<tr data-row="${idx}" class="${rowClass}">` +
        statusCell +
        headers
          .map((h) =>
            h === COL_COVER && row[h]
              ? `<td><img src="${row[h]}" alt="cover"></td>`
              : h === "Details" && row[h]
                ? `<td><a href="${row[h]}" target="_blank" rel="noopener noreferrer">Info</a></td>`
                : `<td>${row[h] || ""}</td>`
          )
          .join("") +
        "</tr>"
      );
    })
    .join("");
  hideStatus();
  document.getElementById("romTable").style.display = "";
  // Status controls (disabled while viewing imported share)
  if (!importedCollection) {
    tbody.querySelectorAll(".status-select").forEach((select) => {
      select.onchange = function () {
        const k = this.getAttribute("data-key");
        setStatusForKey(k, this.value);
        saveStatuses();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      };
    });
  }
  // Row click = show modal (except for checkboxes/links)
  tbody.querySelectorAll("tr.game-row").forEach((tr) => {
    tr.onclick = function (e) {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "A" ||
        e.target.classList.contains("status-select")
      )
        return;
      const rowIdx = parseInt(tr.getAttribute("data-row"), 10);
      showGameModal(data[rowIdx]);
    };
  });
  thead.querySelectorAll("th[data-sort-key]").forEach((th) => {
    th.onclick = () => toggleSort(th.getAttribute("data-sort-key"));
    th.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSort(th.getAttribute("data-sort-key"));
      }
    };
  });
}

function renderStatusSelect(key, current) {
  return `<select class="status-select" data-key="${key}">
    ${STATUS_OPTIONS.map(
      (option) =>
        `<option value="${option.value}" ${current === option.value ? "selected" : ""}>${
          option.label
        }</option>`
    ).join("")}
  </select>`;
}

/**
 * Update game count and average rating stats in the stats area.
 */
function updateStats(data) {
  const total = data.length;
  let ratings = data.map((row) => parseFloat(row[COL_RATING])).filter((n) => !isNaN(n));
  let avg = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
    : "-";
  let platforms = new Set(data.map((row) => row[COL_PLATFORM]));
  const statusSource = importedCollection || gameStatuses;
  const statusCounts = {
    [STATUS_OWNED]: 0,
    [STATUS_WISHLIST]: 0,
    [STATUS_BACKLOG]: 0,
    [STATUS_TRADE]: 0,
  };
  data.forEach((row) => {
    const key = row[COL_GAME] + "___" + row[COL_PLATFORM];
    const status = getStatusForKey(key, statusSource);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;
  });
  const statusSummary = [
    `Owned: ${statusCounts[STATUS_OWNED]}`,
    `Wishlist: ${statusCounts[STATUS_WISHLIST]}`,
    `Backlog: ${statusCounts[STATUS_BACKLOG]}`,
    `Trade: ${statusCounts[STATUS_TRADE]}`,
  ].join(" | ");
  document.getElementById("stats").textContent =
    `Games: ${total} | ${statusSummary} | Average Rating: ${avg} | Platforms: ${platforms.size}`;

  updateDashboard(statusCounts, data);
}

function updateDashboard(statusCounts, data) {
  initCarouselControls();
  const statusConfig = [
    { key: STATUS_OWNED, prefix: "dash-owned", label: "Owned" },
    { key: STATUS_WISHLIST, prefix: "dash-wishlist", label: "Wishlist" },
    { key: STATUS_BACKLOG, prefix: "dash-backlog", label: "Backlog" },
    { key: STATUS_TRADE, prefix: "dash-trade", label: "Trade" },
  ];
  const totalStatuses = statusConfig.reduce(
    (sum, entry) => sum + (statusCounts[entry.key] || 0),
    0
  );
  statusConfig.forEach((entry) => {
    const count = statusCounts[entry.key] || 0;
    const percentValue = totalStatuses ? (count / totalStatuses) * 100 : 0;
    const percentText = formatPercent(percentValue, count);
    const countEl = document.getElementById(`${entry.prefix}-count`);
    const percentEl = document.getElementById(`${entry.prefix}-percent`);
    const barFill = document.getElementById(`${entry.prefix}-bar`);
    const bar = barFill ? barFill.parentElement : null;
    if (countEl) countEl.textContent = count.toLocaleString();
    if (percentEl) percentEl.textContent = percentText;
    if (bar) {
      const ariaValue = count > 0 && percentValue < 1 ? 1 : Math.round(percentValue);
      bar.setAttribute("aria-valuenow", ariaValue.toString());
    }
    if (barFill) {
      const widthValue =
        count > 0 && percentValue < 1 ? "1%" : `${Math.min(percentValue, 100)}%`;
      if (!prefersReducedMotion()) {
        barFill.classList.remove("is-animating");
        void barFill.offsetWidth;
        barFill.style.setProperty("--fill-width", widthValue);
        barFill.classList.add("is-animating");
      } else {
        barFill.classList.remove("is-animating");
        barFill.style.setProperty("--fill-width", widthValue);
      }
    }
  });

  const topGenresEl = document.getElementById("dash-genres");
  if (topGenresEl) {
    const genreCounts = {};
    data.forEach((row) => {
      const genres = row[COL_GENRE]
        ? row[COL_GENRE].split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      genres.forEach((genre) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const totalGenreCount = Object.values(genreCounts).reduce((sum, val) => sum + val, 0);
    if (topGenres.length) {
      topGenresEl.innerHTML = topGenres
        .map(([genre, count]) => {
          const percentValue = totalGenreCount ? (count / totalGenreCount) * 100 : 0;
          const percentText = formatPercent(percentValue, count);
          return `<span class="genre-chip" role="listitem" tabindex="0"><span class="genre-name">${escapeHtml(
            genre
          )}</span><span class="genre-metric"><strong>${count}</strong><span class="genre-percent">${percentText}</span></span></span>`;
        })
        .join("");
    } else {
      topGenresEl.innerHTML =
        '<span class="genre-empty" role="listitem">No genres yet</span>';
    }
    const genreWindow = document.getElementById("dash-genres-window");
    if (genreWindow) {
      registerCarouselWindow(genreWindow);
      updateCarouselButtons(genreWindow);
    }
  }

  const timelineEl = document.getElementById("dash-timeline");
  if (!timelineEl) return;
  const yearCounts = {};
  data.forEach((row) => {
    const year = getReleaseYear(row);
    if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  const sortedYears = Object.entries(yearCounts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(-6);
  if (!sortedYears.length) {
    timelineEl.textContent = "No release data";
  } else {
    const max = Math.max(...sortedYears.map(([, count]) => count));
    timelineEl.innerHTML = sortedYears
      .map(([year, count]) => {
        const percent = max ? Math.max((count / max) * 100, 5) : 5;
        return `<div class="timeline-bar"><span>${year}</span><div class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></div><strong>${count}</strong></div>`;
      })
      .join("");
  }
}

function updateTrendingCarousel(data) {
  initCarouselControls();
  const listEl = document.getElementById("trendingList");
  const windowEl = document.getElementById("trendingWindow");
  if (!listEl || !windowEl) return;

  if (!Array.isArray(data) || !data.length) {
    listEl.innerHTML =
      '<span class="trending-empty" role="listitem">Trending picks will appear once games are added.</span>';
    registerCarouselWindow(windowEl);
    updateCarouselButtons(windowEl);
    return;
  }

  const ratingEntries = data
    .map((row, index) => {
      const rating = parseFloat(row[COL_RATING]);
      return {
        row,
        rating: Number.isFinite(rating) ? rating : null,
        index,
      };
    })
    .filter((item) => item.rating !== null)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      const nameA = (a.row[COL_GAME] || "").toString().toLowerCase();
      const nameB = (b.row[COL_GAME] || "").toString().toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const recentEntries = data
    .map((row, index) => {
      const year = getReleaseYear(row);
      return { row, year: typeof year === "number" ? year : null, index };
    })
    .sort((a, b) => {
      const yearA = a.year === null ? -Infinity : a.year;
      const yearB = b.year === null ? -Infinity : b.year;
      if (yearA !== yearB) return yearB - yearA;
      return b.index - a.index;
    });

  const picks = [];
  const seen = new Set();
  const pushPick = (row) => {
    if (!row) return;
    const key = `${row[COL_GAME] || ""}___${row[COL_PLATFORM] || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    picks.push(row);
  };

  ratingEntries.slice(0, 5).forEach((entry) => pushPick(entry.row));
  recentEntries.slice(0, 5).forEach((entry) => pushPick(entry.row));

  if (picks.length < 8) {
    data.forEach((row) => {
      if (picks.length < 8) pushPick(row);
    });
  }

  if (!picks.length) {
    listEl.innerHTML =
      '<span class="trending-empty" role="listitem">Trending picks will appear once games are added.</span>';
    registerCarouselWindow(windowEl);
    updateCarouselButtons(windowEl);
    return;
  }

  listEl.innerHTML = picks
    .map((row) => {
      const name = escapeHtml(row[COL_GAME] || "Untitled");
      const platform = escapeHtml(row[COL_PLATFORM] || "Unknown platform");
      const yearValue = getReleaseYear(row);
      const yearText = yearValue ? yearValue.toString() : "TBD";
      const ratingValue = parseFloat(row[COL_RATING]);
      const ratingText = Number.isFinite(ratingValue)
        ? ratingValue.toFixed(1).replace(/\.0$/, "")
        : "NR";
      const genres = row[COL_GENRE]
        ? row[COL_GENRE].split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      const primaryGenre = genres.length ? escapeHtml(genres[0]) : "";
      const ratingLabel = ratingText === "NR" ? "Not rated" : `Rating ${ratingText}`;
      return `<article class="trending-card" role="listitem" tabindex="0"><div class="trending-rating" aria-label="${ratingLabel}"><span aria-hidden="true">★</span><span>${ratingText}</span></div><h3>${name}</h3><div class="trending-meta"><span>${platform}</span><span>${escapeHtml(
        yearText
      )}</span>${primaryGenre ? `<span>${primaryGenre}</span>` : ""}</div></article>`;
    })
    .join("");

  registerCarouselWindow(windowEl);
  updateCarouselButtons(windowEl);
}

/**
 * Export user's owned games as a CSV.
 */
function exportOwnedGames() {
  const rows = rawData.filter(
    (row) => getStatusForKey(row[COL_GAME] + "___" + row[COL_PLATFORM]) === STATUS_OWNED
  );
  if (!rows.length) {
    showError("No owned games to export!");
    return;
  }
  let out =
    Object.keys(rawData[0]).join(",") +
    "\n" +
    rows
      .map((row) =>
        Object.values(row)
          .map((cell) => `"${(cell || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  let blob = new Blob([out], { type: "text/csv" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "sandgraal-collection.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Display the share/import section with a code to copy or a field to import.
 */
function showShareSection() {
  const payload = {
    statuses: {},
    notes: {},
  };
  Object.entries(gameStatuses).forEach(([key, status]) => {
    if (status && status !== STATUS_NONE) {
      payload.statuses[key] = status;
    }
  });
  Object.entries(gameNotes).forEach(([key, note]) => {
    if (note && note.trim()) {
      payload.notes[key] = note;
    }
  });
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  document.getElementById("shareSection").style.display = "";
  document.getElementById("shareCode").value = code;
  document.getElementById("importCode").value = "";
  document.getElementById("importResult").textContent = "";
}
function showImportSection() {
  document.getElementById("shareSection").style.display = "";
  document.getElementById("shareCode").value = "";
  document.getElementById("importCode").value = "";
  document.getElementById("importResult").textContent = "";
}

/**
 * Import a shared code (status assignments) and display the imported collection.
 */
function importCollection() {
  let code = document.getElementById("importCode").value.trim();
  if (!code) {
    showError("Paste a code first.");
    return;
  }
  let coll = {};
  let noteMap = {};
  try {
    let decoded = decodeURIComponent(escape(atob(code)));
    if (decoded.trim().startsWith("{")) {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        coll = parsed.statuses || {};
        noteMap = parsed.notes || {};
      }
    } else {
      decoded.split("|").forEach((entry) => {
        if (!entry) return;
        const [key, status] = entry.split("::");
        if (!key) return;
        const normalized = status && STATUS_LABELS[status] ? status : STATUS_OWNED;
        coll[key] = normalized;
      });
    }
    Object.keys(noteMap).forEach((key) => {
      if (!coll[key]) coll[key] = STATUS_NONE;
    });
    importedCollection = coll;
    importedNotes = noteMap;
    renderTable(applyFilters(rawData));
    updateStats(applyFilters(rawData));
    document.getElementById("importResult").textContent =
      "Imported! Viewing shared collection.";
  } catch (e) {
    console.error("Failed to import collection code:", e);
    showError("Invalid code.");
  }
}

/**
 * Close the share/import section and return to normal view.
 */
function closeShareSection() {
  importedCollection = null;
  importedNotes = null;
  document.getElementById("shareSection").style.display = "none";
  renderTable(applyFilters(rawData));
  updateStats(applyFilters(rawData));
}

function exportCollectionBackup() {
  const payload = getBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = BACKUP_FILENAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus("Backup downloaded.", "info");
}

/**
 * Build the portable backup payload.
 * @returns {{statuses: StatusMap, notes: NoteMap, filters: FilterState}}
 */
function getBackupPayload() {
  return {
    statuses: gameStatuses,
    notes: gameNotes,
    filters: persistedFilters,
  };
}

/**
 * Restore a backup from an uploaded file.
 * @param {File} file
 */
function restoreCollectionBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
      if (parsed.statuses && typeof parsed.statuses === "object") {
        gameStatuses = parsed.statuses;
        saveStatuses();
      }
      if (parsed.notes && typeof parsed.notes === "object") {
        gameNotes = parsed.notes;
        saveNotes();
      }
      if (parsed.filters && typeof parsed.filters === "object") {
        persistedFilters = parsed.filters;
        filterStatus = persistedFilters.filterStatus || "";
        filterRatingMin = persistedFilters.filterRatingMin || "";
        filterYearStart = persistedFilters.filterYearStart || "";
        filterYearEnd = persistedFilters.filterYearEnd || "";
        savePersistedFilters();
      }
      applyFiltersToInputs();
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
      showStatus("Backup restored successfully.", "info");
    } catch (err) {
      console.error("Restore failed:", err);
      showError("Failed to restore backup.");
    }
  };
  reader.readAsText(file);
}

/**
 * Display status messaging under the filters.
 */
function showStatus(msg, variant = "info") {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "";
  el.dataset.variant = variant === "error" ? "error" : "info";
  el.textContent = msg;
}

function hideStatus() {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "none";
  delete el.dataset.variant;
}

/**
 * Show error in a styled message area (not a blocking alert).
 */
function showError(msg) {
  showStatus(msg, "error");
}

/**
 * Show a modal popout with game details.
 * @param {GameRow} game
 */
function showGameModal(game) {
  const modal = document.getElementById("gameModal");
  const modalBg = document.getElementById("modalBg");
  const key = (game[COL_GAME] || "") + "___" + (game[COL_PLATFORM] || "");
  let galleryImages = [];
  if (Array.isArray(game.screenshots) && game.screenshots.length) {
    galleryImages = game.screenshots;
  } else if (game[COL_COVER]) {
    galleryImages = [game[COL_COVER]];
  }
  galleryImages = Array.from(new Set(galleryImages.filter(Boolean)));
  // Build modal HTML (no user HTML injected)
  let html = `<button class="modal-close" title="Close" aria-label="Close">&times;</button>`;
  html += `<div class="modal-title">${game[COL_GAME] || "(No Name)"}</div>`;
  if (game[COL_COVER]) html += `<img src="${game[COL_COVER]}" alt="cover art">`;
  if (galleryImages.length) {
    const firstImage = galleryImages[0];
    html += `<div class="modal-gallery" data-current-index="0">
      <button class="gallery-nav prev" aria-label="Previous screenshot">&#10094;</button>
      <img src="${firstImage}" alt="${game[COL_GAME] || ""} media" class="gallery-image">
      <button class="gallery-nav next" aria-label="Next screenshot">&#10095;</button>
      <div class="gallery-counter">1 / ${galleryImages.length}</div>
    </div>`;
  }
  html += `<dl>`;
  for (let k in game) {
    if ([COL_GAME, COL_COVER].includes(k)) continue;
    if (!game[k]) continue;
    html += `<dt>${k}:</dt><dd>${game[k]}</dd>`;
  }
  html += `</dl>`;
  // Resource links (Google, YouTube, GameFAQs)
  const query = encodeURIComponent(
    (game[COL_GAME] || "") + " " + (game[COL_PLATFORM] || "")
  );
  html += `<div class="external-links">`;
  html += `<a href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener">Google</a>`;
  html += `<a href="https://www.youtube.com/results?search_query=${query} gameplay" target="_blank" rel="noopener">YouTube</a>`;
  html += `<a href="https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(
    game[COL_GAME] || ""
  )}" target="_blank" rel="noopener">GameFAQs</a>`;
  html += `</div>`;
  const noteValue = getNoteForKey(key, importedNotes || gameNotes);
  if (importedCollection) {
    html += `<div class="note-editor read-only"><label>Notes</label><div class="note-view">${
      noteValue
        ? escapeHtml(noteValue).replace(/\n/g, "<br>")
        : "<em>No notes shared.</em>"
    }</div></div>`;
  } else {
    html += `<div class="note-editor"><label for="noteField">Your Notes</label><textarea id="noteField" rows="4" placeholder="Add collection notes...">${escapeHtml(
      noteValue
    )}</textarea><button id="saveNoteBtn">Save Note</button></div>`;
  }

  modal.innerHTML = html;
  modal.style.display = modalBg.style.display = "";
  setTimeout(() => {
    modalBg.style.display = "block";
    modal.style.display = "block";
    modal.focus();
  }, 1);

  // Trap focus for accessibility
  modal.setAttribute("tabindex", "-1");
  modal.focus();

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }
  document.addEventListener("keydown", escHandler);
  modal.querySelector(".modal-close").onclick = closeModal;
  modalBg.onclick = closeModal;
  if (galleryImages.length) {
    initializeGallery(modal, galleryImages);
  }
  if (!importedCollection) {
    const saveBtn = modal.querySelector("#saveNoteBtn");
    const noteField = modal.querySelector("#noteField");
    if (saveBtn && noteField) {
      saveBtn.onclick = () => {
        setNoteForKey(key, noteField.value);
        saveNotes();
        closeModal();
        renderTable(applyFilters(rawData));
      };
    }
  }

  function closeModal() {
    modal.style.display = modalBg.style.display = "none";
    modal.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  }
}

function toggleSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortColumn = column;
    sortDirection = "asc";
  }
  renderTable(applyFilters(rawData));
  updateStats(applyFilters(rawData));
}

// === On load: Fetch games from Supabase, bootstrap UI, set up listeners ===

const disableBootstrapFlag =
  (typeof window !== "undefined" && window.__SANDGRAAL_DISABLE_BOOTSTRAP__) ||
  (typeof globalThis !== "undefined" && globalThis.__SANDGRAAL_DISABLE_BOOTSTRAP__);
const canBootstrap =
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof document.getElementById === "function";

if (!disableBootstrapFlag && canBootstrap) {
  initThemeToggle();
  loadGameData()
    .then(({ data, source }) => {
      rawData = data;
      if (!rawData.length) throw new Error("No games available to display!");
      loadStatuses();
      loadNotes();
      loadPersistedFilters();
      filterStatus = persistedFilters.filterStatus || "";
      filterRatingMin = persistedFilters.filterRatingMin || "";
      filterYearStart = persistedFilters.filterYearStart || "";
      filterYearEnd = persistedFilters.filterYearEnd || "";
      setupFilters(rawData);
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
      updateTrendingCarousel(rawData);
      if (source === "sample") {
        showStatus(
          "Supabase is unavailable. Showing a curated sample dataset for now.",
          "info"
        );
      } else {
        hideStatus();
      }

      document.getElementById("platformFilter").addEventListener("change", (e) => {
        filterPlatform = e.target.value;
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("genreFilter").addEventListener("change", (e) => {
        filterGenre = e.target.value;
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("search").addEventListener("input", (e) => {
        searchValue = e.target.value.trim().toLowerCase();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("statusFilter").addEventListener("change", (e) => {
        filterStatus = e.target.value;
        savePersistedFilters();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("ratingFilter").addEventListener("input", (e) => {
        filterRatingMin = e.target.value.trim();
        savePersistedFilters();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("yearStartFilter").addEventListener("input", (e) => {
        filterYearStart = e.target.value.trim();
        savePersistedFilters();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("yearEndFilter").addEventListener("input", (e) => {
        filterYearEnd = e.target.value.trim();
        savePersistedFilters();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("clearFilters").addEventListener("click", () => {
        filterPlatform = "";
        filterGenre = "";
        searchValue = "";
        filterStatus = "";
        filterRatingMin = "";
        filterYearStart = "";
        filterYearEnd = "";
        persistedFilters = {};
        localStorage.removeItem(FILTER_STORAGE_KEY);
        document.getElementById("platformFilter").value = "";
        document.getElementById("genreFilter").value = "";
        document.getElementById("search").value = "";
        document.getElementById("statusFilter").value = "";
        document.getElementById("ratingFilter").value = "";
        document.getElementById("yearStartFilter").value = "";
        document.getElementById("yearEndFilter").value = "";
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });

      applyFiltersToInputs();
      document.getElementById("exportBtn").onclick = exportOwnedGames;
      document.getElementById("shareBtn").onclick = showShareSection;
      document.getElementById("showImport").onclick = showImportSection;
      document.getElementById("copyShare").onclick = function () {
        let code = document.getElementById("shareCode").value;
        navigator.clipboard.writeText(code);
        this.textContent = "Copied!";
        setTimeout(() => {
          this.textContent = "Copy";
        }, 1200);
      };
      document.getElementById("importBtn").onclick = importCollection;
      document.getElementById("closeShare").onclick = closeShareSection;
      document.getElementById("importCode").addEventListener("keydown", function (e) {
        if (e.key === "Enter") importCollection();
      });
      document.getElementById("backupBtn").onclick = exportCollectionBackup;
      const restoreInput = document.getElementById("restoreInput");
      document.getElementById("restoreBtn").onclick = () => restoreInput.click();
      restoreInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          restoreCollectionBackup(file);
          restoreInput.value = "";
        }
      });
    })
    .catch((err) => {
      const message = err && err.message ? err.message : err;
      showError("Unable to load games: " + message);
    });
}

const testApi = {
  applyFilters,
  renderTable,
  setupFilters,
  updateStats,
  updateDashboard,
  updateTrendingCarousel,
  showError,
  toggleSort,
  __setState(overrides = {}) {
    if (Object.prototype.hasOwnProperty.call(overrides, "statuses")) {
      gameStatuses = overrides.statuses;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "notes")) {
      gameNotes = overrides.notes;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "owned")) {
      const incoming = overrides.owned || {};
      gameStatuses = {};
      Object.keys(incoming).forEach((key) => {
        if (incoming[key]) gameStatuses[key] = STATUS_OWNED;
      });
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "importedCollection")) {
      importedCollection = overrides.importedCollection;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterPlatform")) {
      filterPlatform = overrides.filterPlatform;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterGenre")) {
      filterGenre = overrides.filterGenre;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "searchValue")) {
      searchValue = overrides.searchValue;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterStatus")) {
      filterStatus = overrides.filterStatus;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterRatingMin")) {
      filterRatingMin = overrides.filterRatingMin;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterYearStart")) {
      filterYearStart = overrides.filterYearStart;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filterYearEnd")) {
      filterYearEnd = overrides.filterYearEnd;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "filters")) {
      persistedFilters = overrides.filters;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "sortColumn")) {
      sortColumn = overrides.sortColumn;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "sortDirection")) {
      sortDirection = overrides.sortDirection;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "rawData")) {
      rawData = overrides.rawData;
    }
  },
  __getBackupPayload: getBackupPayload,
  __getState() {
    return {
      statuses: gameStatuses,
      notes: gameNotes,
      importedCollection,
      filterPlatform,
      filterGenre,
      searchValue,
      filterStatus,
      filterRatingMin,
      filterYearStart,
      filterYearEnd,
      sortColumn,
      sortDirection,
      rawData,
    };
  },
};

/* eslint-disable no-undef */
if (typeof module !== "undefined" && module.exports) {
  module.exports = testApi;
}
/* eslint-enable no-undef */
