import { describe, it, expect, beforeEach } from "vitest";
import app from "../app.js";
const getBackupPayload = app.__getBackupPayload || (() => ({}));

const SAMPLE_DATA = [
  {
    game_name: "Chrono Trigger",
    platform: "SNES",
    genre: "RPG",
    rating: "9.6",
    release_year: "1995",
    cover: "",
    Details: "",
  },
  {
    game_name: "Castlevania Symphony Of The Night",
    platform: "PS1",
    genre: "Action RPG, Metroidvania",
    rating: "9.5",
    release_year: "1997",
    cover: "",
    Details: "",
  },
];

function buildSampleGames(count) {
  return Array.from({ length: count }, (_, index) => ({
    game_name: `Game ${index + 1}`,
    platform: index % 2 === 0 ? "SNES" : "PS1",
    genre: "Action",
    rating: "9.0",
    release_year: (1990 + index).toString(),
    cover: "",
    Details: "",
  }));
}

function resetDom() {
  document.body.innerHTML = `
    <div id="result"></div>
    <section class="browse-toolbar">
      <div id="browseSummary"></div>
      <div class="browse-controls">
        <select id="browseModeSelect">
          <option value="stream">Infinite scroll</option>
          <option value="paged">Paginated</option>
        </select>
        <select id="pageSizeSelect">
          <option value="30">30</option>
          <option value="60">60</option>
        </select>
      </div>
    </section>
    <div id="gameGrid" class="game-grid"></div>
    <nav id="paginationControls" class="pagination"></nav>
    <button id="loadMoreBtn" style="display:none;"></button>
    <div id="gridSentinel"></div>
    <select id="sortControl">
      <option value="name-asc">Name (A → Z)</option>
      <option value="name-desc">Name (Z → A)</option>
      <option value="rating-desc">Rating (High → Low)</option>
      <option value="rating-asc">Rating (Low → High)</option>
      <option value="year-desc">Release (New → Old)</option>
      <option value="year-asc">Release (Old → New)</option>
    </select>
    <div id="stats"></div>
    <section id="dashboard">
      <div id="dashboard-statuses">
        <div class="status-row">
          <div class="status-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
            aria-label="Owned games in collection"
          ><span id="dash-owned-bar"></span></div>
          <span id="dash-owned-count"></span>
          <span id="dash-owned-percent"></span>
        </div>
        <div class="status-row">
          <div class="status-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
            aria-label="Wishlist games"
          ><span id="dash-wishlist-bar"></span></div>
          <span id="dash-wishlist-count"></span>
          <span id="dash-wishlist-percent"></span>
        </div>
        <div class="status-row">
          <div class="status-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
            aria-label="Backlog games"
          ><span id="dash-backlog-bar"></span></div>
          <span id="dash-backlog-count"></span>
          <span id="dash-backlog-percent"></span>
        </div>
        <div class="status-row">
          <div class="status-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
            aria-label="Trade games"
          ><span id="dash-trade-bar"></span></div>
          <span id="dash-trade-count"></span>
          <span id="dash-trade-percent"></span>
        </div>
      </div>
      <div class="dashboard-card dashboard-price" id="dashboard-price" data-loaded="false">
        <div class="price-summary-header">
          <h2>Collection Value</h2>
          <span class="price-summary-updated" data-price-summary-updated>Awaiting price snapshots…</span>
        </div>
        <p class="price-summary-empty" data-price-summary-empty>Populate price data to see totals.</p>
        <div class="price-summary-grid">
          <article class="price-summary-block" data-price-status="owned">
            <header>
              <span>Owned</span>
              <small><span id="price-owned-priced">0</span>/<span id="price-owned-count">0</span> priced</small>
            </header>
            <dl>
              <div><dt>Loose</dt><dd id="price-owned-loose">—</dd></div>
              <div><dt>CIB</dt><dd id="price-owned-cib">—</dd></div>
              <div><dt>New</dt><dd id="price-owned-new">—</dd></div>
            </dl>
          </article>
          <article class="price-summary-block" data-price-status="wishlist">
            <header>
              <span>Wishlist</span>
              <small><span id="price-wishlist-priced">0</span>/<span id="price-wishlist-count">0</span> priced</small>
            </header>
            <dl>
              <div><dt>Loose</dt><dd id="price-wishlist-loose">—</dd></div>
              <div><dt>CIB</dt><dd id="price-wishlist-cib">—</dd></div>
              <div><dt>New</dt><dd id="price-wishlist-new">—</dd></div>
            </dl>
          </article>
          <article class="price-summary-block" data-price-status="backlog">
            <header>
              <span>Backlog</span>
              <small><span id="price-backlog-priced">0</span>/<span id="price-backlog-count">0</span> priced</small>
            </header>
            <dl>
              <div><dt>Loose</dt><dd id="price-backlog-loose">—</dd></div>
              <div><dt>CIB</dt><dd id="price-backlog-cib">—</dd></div>
              <div><dt>New</dt><dd id="price-backlog-new">—</dd></div>
            </dl>
          </article>
          <article class="price-summary-block" data-price-status="trade">
            <header>
              <span>Trade</span>
              <small><span id="price-trade-priced">0</span>/<span id="price-trade-count">0</span> priced</small>
            </header>
            <dl>
              <div><dt>Loose</dt><dd id="price-trade-loose">—</dd></div>
              <div><dt>CIB</dt><dd id="price-trade-cib">—</dd></div>
              <div><dt>New</dt><dd id="price-trade-new">—</dd></div>
            </dl>
          </article>
        </div>
      </div>
      <div class="genre-carousel">
        <div id="dash-genres-window" data-carousel-window>
          <div id="dash-genres" role="list"></div>
        </div>
      </div>
      <div id="dash-timeline"></div>
    </section>
  `;
}

beforeEach(() => {
  app.__teardownVirtualization();
  resetDom();
  app.__setState({
    statuses: {},
    importedCollection: null,
    filterPlatform: "",
    filterGenre: "",
    searchValue: "",
    filterStatus: "",
    filterRatingMin: "",
    filterYearStart: "",
    filterYearEnd: "",
    rawData: SAMPLE_DATA,
  });
});

describe("remote filter payloads", () => {
  it("normalizes search, range, and sort inputs", () => {
    app.__setState({
      filterPlatform: "SNES",
      filterGenre: "RPG",
      searchValue: "chrono",
      filterRatingMin: "8.5",
      filterYearStart: "1990",
      filterYearEnd: "1995",
      sortColumn: "rating",
      sortDirection: "desc",
    });
    const payload = app.__buildRemoteFilterPayload();
    expect(payload).toEqual({
      search: "chrono",
      platform: "SNES",
      genre: "RPG",
      ratingMin: 8.5,
      yearStart: 1990,
      yearEnd: 1995,
      sortColumn: "rating",
      sortDirection: "desc",
    });
  });
});

describe("browse pagination controls", () => {
  it("limits visible cards to the current page size", () => {
    const dataset = buildSampleGames(4);
    app.__setState({
      rawData: dataset,
      browseMode: "paged",
      paginationState: {
        pageSize: 2,
        currentPage: 1,
        renderedCount: 2,
        totalItems: 0,
        totalPages: 1,
      },
    });
    app.refreshFilteredView("test:paged");
    const cards = document.querySelectorAll(".game-card");
    expect(cards).toHaveLength(2);
    expect(document.getElementById("browseSummary").textContent).toContain(
      "Showing 1–2 of 4"
    );
  });

  it("shows load-more controls for infinite mode batches", () => {
    const dataset = buildSampleGames(5);
    app.__setState({
      rawData: dataset,
      browseMode: "stream",
      paginationState: {
        pageSize: 2,
        renderedCount: 2,
        currentPage: 1,
        totalItems: 0,
        totalPages: 1,
      },
    });
    app.refreshFilteredView("test:infinite");
    const loadMore = document.getElementById("loadMoreBtn");
    expect(loadMore.style.display).toBe("");
    expect(loadMore.textContent).toContain("Load 2 more");
    expect(document.getElementById("browseSummary").textContent).toContain(
      "Showing 1–2 of 5"
    );
  });
});

describe("virtualized grid window", () => {
  it("renders a limited window with spacer padding when dataset is large", async () => {
    const dataset = buildSampleGames(160);
    const originalInnerHeight =
      typeof window.innerHeight === "number" ? window.innerHeight : 0;
    window.innerHeight = 900;
    app.__setState({
      rawData: dataset,
      browseMode: "stream",
      paginationState: {
        pageSize: dataset.length,
        renderedCount: dataset.length,
        currentPage: 1,
        totalItems: dataset.length,
        totalPages: 1,
      },
    });
    app.refreshFilteredView("test:virtual");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const virtualization = app.__getVirtualizationState();
    expect(virtualization.active).toBe(true);
    const cards = document.querySelectorAll(".game-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(dataset.length);
    expect(document.querySelectorAll(".virtual-spacer").length).toBe(2);
    window.innerHeight = originalInnerHeight;
    app.__teardownVirtualization();
  });
});

describe("applyFilters", () => {
  it("filters by platform and search text", () => {
    app.__setState({ filterPlatform: "SNES" });
    const platformFiltered = app.applyFilters(SAMPLE_DATA);
    expect(platformFiltered).toHaveLength(1);
    expect(platformFiltered[0].game_name).toBe("Chrono Trigger");

    app.__setState({ filterPlatform: "", searchValue: "castlevania" });
    const searchFiltered = app.applyFilters(SAMPLE_DATA);
    expect(searchFiltered).toHaveLength(1);
    expect(searchFiltered[0].game_name).toBe("Castlevania Symphony Of The Night");
  });

  it("filters when viewing an imported collection", () => {
    app.__setState({
      importedCollection: { "Chrono Trigger___SNES": "owned" },
    });
    const filtered = app.applyFilters(SAMPLE_DATA);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].game_name).toBe("Chrono Trigger");
  });

  it("respects rating minimum and release year range filters", () => {
    app.__setState({ filterRatingMin: "9.6" });
    const ratingFiltered = app.applyFilters(SAMPLE_DATA);
    expect(ratingFiltered).toHaveLength(1);
    expect(ratingFiltered[0].game_name).toBe("Chrono Trigger");

    app.__setState({
      filterRatingMin: "",
      filterYearStart: "1996",
      filterYearEnd: "1997",
    });
    const yearFiltered = app.applyFilters(SAMPLE_DATA);
    expect(yearFiltered).toHaveLength(1);
    expect(yearFiltered[0].game_name).toBe("Castlevania Symphony Of The Night");
  });
});

describe("renderTable", () => {
  it("renders cards and marks owned entries", () => {
    app.__setState({
      statuses: { "Chrono Trigger___SNES": "owned" },
      notes: {},
    });
    app.renderTable(SAMPLE_DATA);
    const cards = document.querySelectorAll(".game-card");
    expect(cards).toHaveLength(2);
    const chronoCard = Array.from(cards).find((card) =>
      card.textContent.includes("Chrono Trigger")
    );
    expect(chronoCard).toBeTruthy();
    const statusSelect = chronoCard.querySelector(".status-select");
    expect(statusSelect.value).toBe("owned");
    expect(document.getElementById("result").style.display).toBe("none");
  });

  it("updates layout when sorting toggles", () => {
    app.__setState({
      sortColumn: "game_name",
      sortDirection: "asc",
      rawData: SAMPLE_DATA,
    });
    app.renderTable(SAMPLE_DATA);
    const firstCardTitle = document
      .querySelector(".game-card .card-title")
      .textContent.trim();
    expect(firstCardTitle).toBe("Castlevania Symphony Of The Night");

    app.toggleSort("game_name");
    const updatedCardTitle = document
      .querySelector(".game-card .card-title")
      .textContent.trim();
    expect(updatedCardTitle).toBe("Chrono Trigger");
  });

  it("shows note indicator when a note exists", () => {
    app.__setState({
      notes: { "Chrono Trigger___SNES": "Keep boxed copy" },
    });
    app.renderTable(SAMPLE_DATA);
    const noteDots = document.querySelectorAll(".note-dot");
    expect(noteDots.length).toBe(1);
  });
});
describe("dashboard", () => {
  it("updates top genres and status cards", () => {
    const ownedCountEl = document.getElementById("dash-owned-count");
    const ownedPercentEl = document.getElementById("dash-owned-percent");
    ownedCountEl.textContent = "0";
    ownedPercentEl.textContent = "0%";
    document.getElementById("dash-genres").innerHTML = "";
    app.updateDashboard(
      {
        owned: 2,
        wishlist: 1,
        backlog: 0,
        trade: 0,
      },
      SAMPLE_DATA
    );
    expect(ownedCountEl.textContent).toBe("2");
    expect(ownedPercentEl.textContent.endsWith("%")).toBe(true);
    expect(document.getElementById("dash-genres").children.length).toBeGreaterThan(0);
  });

  it("exports backup payload with statuses, notes, filters", () => {
    app.__setState({
      statuses: { "Chrono Trigger___SNES": "wishlist" },
      notes: { "Chrono Trigger___SNES": "Find CIB" },
      filters: {
        filterStatus: "wishlist",
        filterRatingMin: "9",
        filterYearStart: "1990",
        filterYearEnd: "2000",
      },
    });
    const payload = getBackupPayload();
    expect(payload.statuses["Chrono Trigger___SNES"]).toBe("wishlist");
    expect(payload.notes["Chrono Trigger___SNES"]).toBe("Find CIB");
    expect(payload.filters.filterStatus).toBe("wishlist");
    expect(payload.filters.filterYearStart).toBe("1990");
  });
});

describe("price summary", () => {
  it("renders collection totals when price snapshots exist", () => {
    app.__setState({
      statuses: { "Chrono Trigger___SNES": "owned" },
    });
    app.__setPriceState({
      latest: {
        "Chrono Trigger___SNES": {
          game_key: "Chrono Trigger___SNES",
          loose_price_cents: 17500,
          cib_price_cents: 46500,
          new_price_cents: 72500,
          snapshot_date: "2025-03-10",
          source: "pricecharting",
        },
      },
      lastUpdated: "2025-03-10",
    });
    app.updateCollectionValueSummary();
    expect(document.getElementById("price-owned-loose").textContent).toContain("175");
    expect(document.getElementById("price-owned-count").textContent).toBe("1");
    expect(document.getElementById("price-owned-priced").textContent).toBe("1");
    expect(document.querySelector("[data-price-summary-updated]").textContent).toContain(
      "2025"
    );
  });
});
