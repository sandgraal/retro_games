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
const STORAGE_KEY = "roms_owned";

// === Supabase Config ===
const SUPABASE_CONFIG = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_URL = SUPABASE_CONFIG.url || "";
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (!supabase) {
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

let rawData = [],
  owned = {},
  importedCollection = null;
let filterPlatform = "",
  filterGenre = "",
  searchValue = "";

/**
 * LocalStorage: Load & Save owned game state
 */
function loadOwned() {
  try {
    owned = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    owned = {};
  }
}
function saveOwned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
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
  let filterOwned = importedCollection;
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
    if (filterOwned && !filterOwned[row[COL_GAME] + "___" + row[COL_PLATFORM]])
      return false;
    return true;
  });
}

/**
 * Render the ROM table from (filtered) data.
 */
function renderTable(data) {
  if (!data.length) {
    document.getElementById("romTable").style.display = "none";
    showError("No results match your filters.");
    return;
  }
  const headers = Object.keys(data[0]);
  const thead = document.querySelector("#romTable thead");
  const tbody = document.querySelector("#romTable tbody");
  thead.innerHTML =
    "<tr><th>Owned?</th>" + headers.map((h) => `<th>${h}</th>`).join("") + "</tr>";
  tbody.innerHTML = data
    .map((row, idx) => {
      const key = row[COL_GAME] + "___" + row[COL_PLATFORM];
      let checked = importedCollection
        ? importedCollection[key]
          ? "checked disabled"
          : "disabled"
        : owned[key]
          ? "checked"
          : "";
      return (
        `<tr data-row="${idx}" class="${
          owned[key] || (importedCollection && importedCollection[key]) ? "owned-row" : ""
        } game-row">` +
        `<td class="center"><input type="checkbox" class="checkbox-own" data-key="${key}" ${checked}></td>` +
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
  document.getElementById("result").style.display = "none";
  document.getElementById("romTable").style.display = "";
  // Checkbox logic (no importedCollection means editing is enabled)
  if (!importedCollection) {
    tbody.querySelectorAll(".checkbox-own").forEach((cb) => {
      cb.onchange = function () {
        const k = this.getAttribute("data-key");
        if (this.checked) owned[k] = true;
        else delete owned[k];
        saveOwned();
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
        e.target.classList.contains("checkbox-own")
      )
        return;
      const rowIdx = parseInt(tr.getAttribute("data-row"), 10);
      showGameModal(data[rowIdx]);
    };
  });
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
  let useOwned = importedCollection || owned;
  const ownedCount = data.filter(
    (row) => useOwned[row[COL_GAME] + "___" + row[COL_PLATFORM]]
  ).length;
  document.getElementById("stats").textContent =
    `Games: ${total} | Owned: ${ownedCount} | Average Rating: ${avg} | Platforms: ${platforms.size}`;
}

/**
 * Export user's owned games as a CSV.
 */
function exportOwnedGames() {
  const rows = rawData.filter((row) => owned[row[COL_GAME] + "___" + row[COL_PLATFORM]]);
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
  Object.keys(owned).forEach((k) => {
    if (owned[k]) codes.push(k);
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
 * Import a shared code (owned games) and display the imported collection.
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
    decoded.split("|").forEach((k) => (coll[k] = true));
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
 * Show error in a styled message area (not a blocking alert).
 */
function showError(msg) {
  const el = document.getElementById("result");
  el.style.display = "";
  el.style.color = "#ff7070";
  el.textContent = msg;
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

// === On load: Fetch games from Supabase, bootstrap UI, set up listeners ===

const disableBootstrapFlag =
  (typeof window !== "undefined" && window.__SANDGRAAL_DISABLE_BOOTSTRAP__) ||
  (typeof globalThis !== "undefined" && globalThis.__SANDGRAAL_DISABLE_BOOTSTRAP__);
const canBootstrap =
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof document.getElementById === "function";

if (!disableBootstrapFlag && canBootstrap) {
  fetchGames()
    .then((data) => {
      rawData = data;
      if (!rawData.length) throw new Error("No games in database!");
      loadOwned();
      setupFilters(rawData);
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));

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
      showError("Supabase error: " + message);
    });
}

const testApi = {
  applyFilters,
  renderTable,
  setupFilters,
  updateStats,
  showError,
  __setState(overrides = {}) {
    if (Object.prototype.hasOwnProperty.call(overrides, "owned")) {
      owned = overrides.owned;
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
    if (Object.prototype.hasOwnProperty.call(overrides, "rawData")) {
      rawData = overrides.rawData;
    }
  },
  __getState() {
    return {
      owned,
      importedCollection,
      filterPlatform,
      filterGenre,
      searchValue,
      rawData,
    };
  },
};

/* eslint-disable no-undef */
if (typeof module !== "undefined" && module.exports) {
  module.exports = testApi;
}
/* eslint-enable no-undef */
