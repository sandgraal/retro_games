import { describe, it, expect, beforeEach } from "vitest";
import app from "../app.js";

const SAMPLE_DATA = [
  {
    game_name: "Chrono Trigger",
    platform: "SNES",
    genre: "RPG",
    rating: "9.6",
    cover: "",
    Details: "",
  },
  {
    game_name: "Castlevania Symphony Of The Night",
    platform: "PS1",
    genre: "Action RPG, Metroidvania",
    rating: "9.5",
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
    owned: {},
    importedCollection: null,
    filterPlatform: "",
    filterGenre: "",
    searchValue: "",
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
      importedCollection: { "Chrono Trigger___SNES": true },
    });
    const filtered = app.applyFilters(SAMPLE_DATA);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].game_name).toBe("Chrono Trigger");
  });
});

describe("renderTable", () => {
  it("renders rows and marks owned entries", () => {
    app.__setState({
      owned: { "Chrono Trigger___SNES": true },
    });
    app.renderTable(SAMPLE_DATA);
    const rows = document.querySelectorAll("#romTable tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains("owned-row")).toBe(true);
    const firstCheckbox = rows[0].querySelector(".checkbox-own");
    expect(firstCheckbox.checked).toBe(true);
    expect(document.getElementById("romTable").style.display).toBe("");
    expect(document.getElementById("result").style.display).toBe("none");
  });
});
