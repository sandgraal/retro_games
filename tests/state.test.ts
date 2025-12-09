/**
 * State Store Tests
 * Tests for reactive state management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setGames,
  setPrices,
  setLoading,
  setError,
  setGameStatus,
  getGameStatus,
  setGameNotes,
  getGameNotes,
  updateFilters,
  resetFilters,
  togglePlatformFilter,
  toggleGenreFilter,
  setSearchQuery,
  setSort,
  setTheme,
  setViewMode,
  games,
  isLoading,
  error,
  filterState,
  theme,
  viewMode,
  filteredGames,
  availablePlatforms,
  availableGenres,
  collectionStats,
} from "../src/state";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("state/store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset state to defaults
    setGames([]);
    setLoading(false);
    setError(null);
    resetFilters();
  });

  describe("games state", () => {
    it("should set and get games", () => {
      const testGames = [
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
      ];

      setGames(testGames);

      const result = games.get();
      expect(result).toHaveLength(1);
      expect(result[0].game_name).toBe("Chrono Trigger");
      expect(result[0].key).toBe("chrono trigger___snes");
    });
  });

  describe("loading state", () => {
    it("should set and get loading", () => {
      setLoading(true);
      expect(isLoading.get()).toBe(true);

      setLoading(false);
      expect(isLoading.get()).toBe(false);
    });
  });

  describe("error state", () => {
    it("should set and get error", () => {
      setError("Test error");
      expect(error.get()).toBe("Test error");

      setError(null);
      expect(error.get()).toBeNull();
    });
  });

  describe("collection status", () => {
    it("should set and get game status", () => {
      setGameStatus("chrono trigger___snes", "owned");
      expect(getGameStatus("chrono trigger___snes")).toBe("owned");
    });

    it("should default to none for unknown games", () => {
      expect(getGameStatus("unknown___game")).toBe("none");
    });

    it("should remove status when set to none", () => {
      setGameStatus("chrono trigger___snes", "owned");
      setGameStatus("chrono trigger___snes", "none");
      expect(getGameStatus("chrono trigger___snes")).toBe("none");
    });
  });

  describe("game notes", () => {
    it("should set and get notes", () => {
      setGameNotes("chrono trigger___snes", "Great game!");
      expect(getGameNotes("chrono trigger___snes")).toBe("Great game!");
    });

    it("should return empty string for missing notes", () => {
      expect(getGameNotes("unknown___game")).toBe("");
    });

    it("should remove empty notes", () => {
      setGameNotes("chrono trigger___snes", "Note");
      setGameNotes("chrono trigger___snes", "");
      expect(getGameNotes("chrono trigger___snes")).toBe("");
    });
  });

  describe("filter state", () => {
    it("should update filters", () => {
      updateFilters({ minRating: 8 });
      expect(filterState.get().minRating).toBe(8);
    });

    it("should reset filters", () => {
      updateFilters({ minRating: 8, searchQuery: "test" });
      resetFilters();

      const state = filterState.get();
      expect(state.minRating).toBe(0);
      expect(state.searchQuery).toBe("");
    });

    it("should toggle platform filter", () => {
      togglePlatformFilter("SNES");
      expect(filterState.get().platforms.has("SNES")).toBe(true);

      togglePlatformFilter("SNES");
      expect(filterState.get().platforms.has("SNES")).toBe(false);
    });

    it("should toggle genre filter", () => {
      toggleGenreFilter("RPG");
      expect(filterState.get().genres.has("RPG")).toBe(true);

      toggleGenreFilter("RPG");
      expect(filterState.get().genres.has("RPG")).toBe(false);
    });

    it("should set search query", () => {
      setSearchQuery("chrono");
      expect(filterState.get().searchQuery).toBe("chrono");
    });

    it("should set sort options", () => {
      setSort("rating", "desc");
      const state = filterState.get();
      expect(state.sortBy).toBe("rating");
      expect(state.sortDirection).toBe("desc");
    });
  });

  describe("UI state", () => {
    it("should set theme", () => {
      setTheme("light");
      expect(theme.get()).toBe("light");
    });

    it("should set view mode", () => {
      setViewMode("list");
      expect(viewMode.get()).toBe("list");
    });
  });

  describe("computed: filteredGames", () => {
    beforeEach(() => {
      const testGames = [
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
        {
          game_name: "Super Mario World",
          platform: "SNES",
          genre: "Platformer",
          rating: "9.4",
          release_year: "1990",
        },
        {
          game_name: "Final Fantasy VII",
          platform: "PS1",
          genre: "RPG",
          rating: "9.2",
          release_year: "1997",
        },
      ];
      setGames(testGames);
      resetFilters();
    });

    it("should return all games when no filters", () => {
      expect(filteredGames.get()).toHaveLength(3);
    });

    it("should filter by platform", () => {
      togglePlatformFilter("SNES");
      expect(filteredGames.get()).toHaveLength(2);
    });

    it("should filter by genre", () => {
      toggleGenreFilter("RPG");
      expect(filteredGames.get()).toHaveLength(2);
    });

    it("should filter by search", () => {
      setSearchQuery("chrono");
      expect(filteredGames.get()).toHaveLength(1);
      expect(filteredGames.get()[0].game_name).toBe("Chrono Trigger");
    });

    it("should filter by min rating", () => {
      updateFilters({ minRating: 9.5 });
      expect(filteredGames.get()).toHaveLength(1);
    });

    it("should sort by name", () => {
      setSort("name", "asc");
      const result = filteredGames.get();
      expect(result[0].game_name).toBe("Chrono Trigger");
      expect(result[2].game_name).toBe("Super Mario World");
    });

    it("should sort by rating", () => {
      setSort("rating", "desc");
      const result = filteredGames.get();
      expect(result[0].game_name).toBe("Chrono Trigger");
    });
  });

  describe("computed: availablePlatforms", () => {
    it("should extract unique platforms", () => {
      setGames([
        {
          game_name: "Game 1",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "Game 2",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "Game 3",
          platform: "PS1",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
      ]);

      const platforms = availablePlatforms.get();
      expect(platforms).toHaveLength(2);
      expect(platforms).toContain("SNES");
      expect(platforms).toContain("PS1");
    });
  });

  describe("computed: availableGenres", () => {
    it("should extract unique genres from comma-separated", () => {
      setGames([
        {
          game_name: "Game 1",
          platform: "SNES",
          genre: "RPG, Action",
          rating: "9",
          release_year: "1995",
        },
        {
          game_name: "Game 2",
          platform: "SNES",
          genre: "RPG",
          rating: "9",
          release_year: "1995",
        },
      ]);

      const genres = availableGenres.get();
      expect(genres).toHaveLength(2);
      expect(genres).toContain("RPG");
      expect(genres).toContain("Action");
    });
  });

  describe("computed: collectionStats", () => {
    it("should calculate stats", () => {
      setGames([
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
        {
          game_name: "Final Fantasy VI",
          platform: "SNES",
          genre: "RPG",
          rating: "9.5",
          release_year: "1994",
        },
      ]);
      setGameStatus("chrono trigger___snes", "owned");

      const stats = collectionStats.get();
      expect(stats.totalGames).toBe(2);
      expect(stats.ownedCount).toBe(1);
      expect(stats.completionPercentage).toBe(50);
    });
  });
});
