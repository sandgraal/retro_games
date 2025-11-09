import { describe, it, expect, beforeEach } from "vitest";
import app from "../app.js";

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

function resetDom() {
  document.body.innerHTML = `
    <div id="result"></div>
    <table id="romTable">
      <thead></thead>
      <tbody></tbody>
    </table>
    <div id="stats"></div>
  `;
}

beforeEach(() => {
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
  it("renders rows and marks owned entries", () => {
    app.__setState({
      statuses: { "Chrono Trigger___SNES": "owned" },
      notes: {},
    });
    app.renderTable(SAMPLE_DATA);
    const rows = document.querySelectorAll("#romTable tbody tr");
    expect(rows).toHaveLength(2);
    const chronoRow = Array.from(rows).find((row) =>
      row.textContent.includes("Chrono Trigger")
    );
    expect(chronoRow).toBeTruthy();
    expect(chronoRow.classList.contains("status-owned")).toBe(true);
    const statusSelect = chronoRow.querySelector(".status-select");
    expect(statusSelect.value).toBe("owned");
    expect(document.getElementById("romTable").style.display).toBe("");
    expect(document.getElementById("result").style.display).toBe("none");
  });

  it("sorts columns when headers clicked", () => {
    app.__setState({
      sortColumn: "game_name",
      sortDirection: "asc",
    });
    app.renderTable(SAMPLE_DATA);
    const firstRowTitle = document
      .querySelector("#romTable tbody tr td:nth-child(2)")
      .textContent.trim();
    expect(firstRowTitle).toBe("Castlevania Symphony Of The Night");

    app.toggleSort("game_name");
    const updatedRowTitle = document
      .querySelector("#romTable tbody tr td:nth-child(2)")
      .textContent.trim();
    expect(updatedRowTitle).toBe("Chrono Trigger");
  });

  it("respects status filter selection", () => {
    app.__setState({
      statuses: {
        "Chrono Trigger___SNES": "owned",
        "Castlevania Symphony Of The Night___PS1": "wishlist",
      },
      filterStatus: "wishlist",
    });
    const filtered = app.applyFilters(SAMPLE_DATA);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].game_name).toBe("Castlevania Symphony Of The Night");
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
