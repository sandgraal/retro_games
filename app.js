/*
  Sandgraal's Game List
  Author: Chris Sandgraal
  Github: https://github.com/sandgraal/retro_games
  Description: Retro ROM tracker and game explorer.
  2024-06
*/

// === Column Names and Keys ===
const COL_GAME = "game_name";
const COL_PLATFORM = "platform";
const COL_GENRE = "genre";
const COL_COVER = "cover";
const COL_RATING = "rating";
const COL_RELEASE_YEAR = "release_year";
const STORAGE_KEY = "roms_owned";
const STATUS_NONE = "none";
const STATUS_OWNED = "owned";
const STATUS_WISHLIST = "wishlist";
const STATUS_BACKLOG = "backlog";
const STATUS_TRADE = "trade";

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

let rawData = [],
  gameStatuses = {},
  importedCollection = null;
let filterPlatform = "",
  filterGenre = "",
  searchValue = "",
  filterStatus = "",
  filterRatingMin = "",
  filterYearStart = "",
  filterYearEnd = "",
  sortColumn = COL_GAME,
  sortDirection = "asc";

function parseYear(value) {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

function getReleaseYear(row) {
  const fallbackValue =
    row[COL_RELEASE_YEAR] ?? row.release_year ?? row.releaseYear ?? row["Release Year"];
  return parseYear(fallbackValue);
}

function getStatusForKey(key, sourceMap) {
  const map = sourceMap || gameStatuses;
  return map[key] || STATUS_NONE;
}

function setStatusForKey(key, status) {
  if (!status || status === STATUS_NONE) {
    delete gameStatuses[key];
  } else {
    gameStatuses[key] = status;
  }
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
      const statusCell = importedCollection
        ? `<td class="status-cell"><span class="${pillClass}">${statusLabel}</span></td>`
        : `<td class="status-cell">${renderStatusSelect(key, statusValue)}</td>`;
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
  let codes = [];
  Object.entries(gameStatuses).forEach(([key, status]) => {
    if (status && status !== STATUS_NONE) {
      codes.push(`${key}::${status}`);
    }
  });
  let code = btoa(unescape(encodeURIComponent(codes.join("|"))));
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
  try {
    let decoded = decodeURIComponent(escape(atob(code)));
    decoded.split("|").forEach((entry) => {
      if (!entry) return;
      const [key, status] = entry.split("::");
      if (!key) return;
      const normalized = status && STATUS_LABELS[status] ? status : STATUS_OWNED;
      coll[key] = normalized;
    });
    importedCollection = coll;
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
  document.getElementById("shareSection").style.display = "none";
  renderTable(applyFilters(rawData));
  updateStats(applyFilters(rawData));
}

/**
 * Display status messaging under the filters.
 */
function showStatus(msg, variant = "info") {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "";
  el.style.color = variant === "error" ? "#ff7070" : "#7fffd4";
  el.textContent = msg;
}

function hideStatus() {
  const el = document.getElementById("result");
  if (!el) return;
  el.style.display = "none";
}

/**
 * Show error in a styled message area (not a blocking alert).
 */
function showError(msg) {
  showStatus(msg, "error");
}

/**
 * Show a modal popout with game details.
 */
function showGameModal(game) {
  const modal = document.getElementById("gameModal");
  const modalBg = document.getElementById("modalBg");
  // Build modal HTML (no user HTML injected)
  let html = `<button class="modal-close" title="Close" aria-label="Close">&times;</button>`;
  html += `<div class="modal-title">${game[COL_GAME] || "(No Name)"}</div>`;
  if (game[COL_COVER]) html += `<img src="${game[COL_COVER]}" alt="cover art">`;
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
  loadGameData()
    .then(({ data, source }) => {
      rawData = data;
      if (!rawData.length) throw new Error("No games available to display!");
      loadStatuses();
      setupFilters(rawData);
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
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
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("ratingFilter").addEventListener("input", (e) => {
        filterRatingMin = e.target.value.trim();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("yearStartFilter").addEventListener("input", (e) => {
        filterYearStart = e.target.value.trim();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });
      document.getElementById("yearEndFilter").addEventListener("input", (e) => {
        filterYearEnd = e.target.value.trim();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      });

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
  showError,
  toggleSort,
  __setState(overrides = {}) {
    if (Object.prototype.hasOwnProperty.call(overrides, "statuses")) {
      gameStatuses = overrides.statuses;
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
  __getState() {
    return {
      statuses: gameStatuses,
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
