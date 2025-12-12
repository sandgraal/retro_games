/**
 * Smart Search Component
 * Autocomplete with recent searches, suggestions, and keyboard navigation
 */

import { escapeHtml, debounce } from "./components";
import { gamesSignal, filterState, setSearchQuery, openGameModal } from "../state/store";
import { effect } from "../core/signals";
import type { GameWithKey } from "../core/types";
import { safeStorage } from "../core/storage";

const STORAGE_KEY = "dragonshoard_recent_searches";
const MAX_RECENT_SEARCHES = 10;
const MAX_SUGGESTIONS = 8;

interface SearchSuggestion {
  type: "game" | "platform" | "genre" | "recent";
  text: string;
  subtext?: string;
  icon: string;
  game?: GameWithKey;
}

let isOpen = false;
let selectedIndex = -1;
let suggestions: SearchSuggestion[] = [];
let recentSearches: string[] = [];

/**
 * Load recent searches from storage
 */
function loadRecentSearches(): string[] {
  try {
    const stored = safeStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_RECENT_SEARCHES);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Save a search to recent history
 */
function saveRecentSearch(query: string): void {
  if (!query.trim()) return;

  const trimmed = query.trim();
  recentSearches = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(
    0,
    MAX_RECENT_SEARCHES
  );

  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear recent search history
 */
export function clearRecentSearches(): void {
  recentSearches = [];
  try {
    safeStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate search suggestions based on query
 */
function generateSuggestions(query: string): SearchSuggestion[] {
  const results: SearchSuggestion[] = [];
  const games = gamesSignal.get();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    // Show recent searches when empty
    recentSearches.slice(0, 5).forEach((recent) => {
      results.push({
        type: "recent",
        text: recent,
        icon: "🕒",
      });
    });
    return results;
  }

  // Match game names
  const matchingGames = games
    .filter((g) => g.game_name.toLowerCase().includes(lowerQuery))
    .sort((a, b) => {
      // Prioritize starts-with matches
      const aStarts = a.game_name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.game_name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.game_name.localeCompare(b.game_name);
    })
    .slice(0, 5);

  matchingGames.forEach((game) => {
    results.push({
      type: "game",
      text: game.game_name,
      subtext: `${game.platform} • ${game.release_year}`,
      icon: "🎮",
      game,
    });
  });

  // Match platforms
  const platforms = new Set(games.map((g) => g.platform));
  const matchingPlatforms = Array.from(platforms)
    .filter((p) => p.toLowerCase().includes(lowerQuery))
    .slice(0, 2);

  matchingPlatforms.forEach((platform) => {
    const count = games.filter((g) => g.platform === platform).length;
    results.push({
      type: "platform",
      text: platform,
      subtext: `${count} games`,
      icon: "🕹️",
    });
  });

  // Match genres
  const genres = new Set<string>();
  games.forEach((g) => {
    g.genre?.split(",").forEach((genre) => {
      const trimmed = genre.trim();
      if (trimmed) genres.add(trimmed);
    });
  });

  const matchingGenres = Array.from(genres)
    .filter((g) => g.toLowerCase().includes(lowerQuery))
    .slice(0, 2);

  matchingGenres.forEach((genre) => {
    results.push({
      type: "genre",
      text: genre,
      subtext: "Genre",
      icon: "🏷️",
    });
  });

  return results.slice(0, MAX_SUGGESTIONS);
}

/**
 * Render the dropdown with suggestions
 */
function renderDropdown(container: HTMLElement): void {
  if (suggestions.length === 0) {
    container.innerHTML = `
      <div class="search-dropdown-empty">
        <span class="search-dropdown-empty-icon">🔍</span>
        <span>No results found</span>
      </div>
    `;
    return;
  }

  container.innerHTML = suggestions
    .map((suggestion, index) => {
      const isSelected = index === selectedIndex;
      return `
        <button 
          type="button"
          class="search-suggestion ${isSelected ? "search-suggestion--selected" : ""}"
          data-index="${index}"
          data-type="${suggestion.type}"
        >
          <span class="search-suggestion-icon">${suggestion.icon}</span>
          <div class="search-suggestion-content">
            <span class="search-suggestion-text">${escapeHtml(suggestion.text)}</span>
            ${suggestion.subtext ? `<span class="search-suggestion-subtext">${escapeHtml(suggestion.subtext)}</span>` : ""}
          </div>
          ${suggestion.type === "recent" ? '<button type="button" class="search-suggestion-remove" data-remove="true" title="Remove">×</button>' : ""}
        </button>
      `;
    })
    .join("");
}

/**
 * Handle suggestion selection
 */
function selectSuggestion(suggestion: SearchSuggestion, input: HTMLInputElement): void {
  switch (suggestion.type) {
    case "game":
      if (suggestion.game) {
        openGameModal(suggestion.game);
        input.value = "";
        setSearchQuery("");
      }
      break;
    case "platform":
      // Set search to platform name
      input.value = suggestion.text;
      setSearchQuery(suggestion.text);
      saveRecentSearch(suggestion.text);
      break;
    case "genre":
      input.value = suggestion.text;
      setSearchQuery(suggestion.text);
      saveRecentSearch(suggestion.text);
      break;
    case "recent":
      input.value = suggestion.text;
      setSearchQuery(suggestion.text);
      break;
  }

  closeDropdown();
}

/**
 * Open the dropdown
 */
function openDropdown(): void {
  isOpen = true;
  const dropdown = document.getElementById("searchDropdown");
  if (dropdown) {
    dropdown.hidden = false;
  }
}

/**
 * Close the dropdown
 */
function closeDropdown(): void {
  isOpen = false;
  selectedIndex = -1;
  const dropdown = document.getElementById("searchDropdown");
  if (dropdown) {
    dropdown.hidden = true;
  }
}

/**
 * Initialize smart search on an input element
 */
export function initSmartSearch(inputId: string): () => void {
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!input) return () => {};

  // Load recent searches
  recentSearches = loadRecentSearches();

  // Create dropdown container
  const wrapper = input.parentElement;
  if (!wrapper) return () => {};

  wrapper.classList.add("search-wrapper");

  let dropdown = document.getElementById("searchDropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "searchDropdown";
    dropdown.className = "search-dropdown";
    dropdown.hidden = true;
    dropdown.setAttribute("role", "listbox");
    wrapper.appendChild(dropdown);
  }

  // Handle input changes
  const handleInput = debounce((value: string) => {
    suggestions = generateSuggestions(value);
    selectedIndex = -1;
    renderDropdown(dropdown!);

    if (suggestions.length > 0 || value.length === 0) {
      openDropdown();
    }
  }, 150);

  const onInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    handleInput(value);
  };

  // Handle focus
  const onFocus = () => {
    suggestions = generateSuggestions(input.value);
    renderDropdown(dropdown!);
    openDropdown();
  };

  // Handle blur (with delay for click handling)
  const onBlur = () => {
    setTimeout(() => {
      closeDropdown();
    }, 200);
  };

  // Handle keyboard navigation
  const onKeydown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        openDropdown();
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
        renderDropdown(dropdown!);
        break;
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        renderDropdown(dropdown!);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex], input);
        } else if (input.value.trim()) {
          saveRecentSearch(input.value);
          setSearchQuery(input.value);
          closeDropdown();
        }
        break;
      case "Escape":
        closeDropdown();
        input.blur();
        break;
    }
  };

  // Handle dropdown clicks
  const onDropdownClick = (e: Event) => {
    const target = e.target as HTMLElement;

    // Handle remove button
    if (target.dataset.remove === "true") {
      e.stopPropagation();
      const suggestionEl = target.closest(".search-suggestion");
      const index = parseInt(suggestionEl?.getAttribute("data-index") ?? "-1", 10);
      if (index >= 0 && suggestions[index]?.type === "recent") {
        const text = suggestions[index].text;
        recentSearches = recentSearches.filter((s) => s !== text);
        try {
          safeStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches));
        } catch {
          // Ignore storage errors
        }
        suggestions = generateSuggestions(input.value);
        renderDropdown(dropdown!);
      }
      return;
    }

    // Handle suggestion selection
    const suggestionEl = target.closest(".search-suggestion");
    if (suggestionEl) {
      const index = parseInt(suggestionEl.getAttribute("data-index") ?? "-1", 10);
      if (index >= 0 && suggestions[index]) {
        selectSuggestion(suggestions[index], input);
      }
    }
  };

  // Add event listeners
  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeydown);
  dropdown.addEventListener("click", onDropdownClick);

  // Update ARIA attributes
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "searchDropdown");
  input.setAttribute("aria-expanded", "false");

  // Sync with filter state
  const unsub = effect(() => {
    const query = filterState.get().searchQuery;
    if (input.value !== query) {
      input.value = query;
    }
  });

  // Cleanup
  return () => {
    input.removeEventListener("input", onInput);
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("keydown", onKeydown);
    dropdown?.removeEventListener("click", onDropdownClick);
    unsub();
  };
}
