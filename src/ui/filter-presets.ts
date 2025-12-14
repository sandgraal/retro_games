/**
 * Saved Filter Presets
 * Allow users to save and quickly apply filter combinations
 */

import { createSignal, effect } from "../core/signals";
import { filterState, setFilters, DEFAULT_FILTER_STATE } from "../state/store";
import type { FilterState } from "../core/types";
import { escapeHtml } from "./components";

// Storage key
const PRESETS_STORAGE_KEY = "dragonshoard_filter_presets";

// Preset interface
export interface FilterPreset {
  id: string;
  name: string;
  icon: string;
  filters: Partial<FilterState>;
  isBuiltIn: boolean;
  createdAt: number;
}

// Built-in presets
const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: "retro-nintendo",
    name: "Retro Nintendo",
    icon: "🍄",
    filters: {
      platforms: new Set([
        "NES",
        "SNES",
        "N64",
        "Game Boy",
        "Game Boy Color",
        "Game Boy Advance",
      ]),
      eras: new Set(["retro"]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "playstation-classics",
    name: "PlayStation Classics",
    icon: "🎮",
    filters: {
      platforms: new Set(["PlayStation", "PS2", "PSP", "PS Vita"]),
      eras: new Set(["retro", "last-gen"]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "sega-collection",
    name: "Sega Collection",
    icon: "🔵",
    filters: {
      platforms: new Set([
        "Genesis",
        "Sega CD",
        "Saturn",
        "Dreamcast",
        "Game Gear",
        "Master System",
      ]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "highly-rated",
    name: "Highly Rated (8+)",
    icon: "⭐",
    filters: {
      minRating: 8,
      sortBy: "rating",
      sortDirection: "desc",
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "budget-finds",
    name: "Budget Finds (<$20)",
    icon: "💰",
    filters: {
      priceRange: { min: 0, max: 2000 }, // in cents
      sortBy: "value",
      sortDirection: "asc",
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "rpg-adventures",
    name: "RPG Adventures",
    icon: "⚔️",
    filters: {
      genres: new Set(["RPG", "JRPG", "Action RPG", "Tactical RPG"]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "my-collection",
    name: "My Collection",
    icon: "📦",
    filters: {
      statuses: new Set(["owned"]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: "wishlist",
    name: "Wishlist",
    icon: "💫",
    filters: {
      statuses: new Set(["wishlist"]),
    },
    isBuiltIn: true,
    createdAt: 0,
  },
];

// Signal for user-created presets
export const userPresets = createSignal<FilterPreset[]>([]);

// Signal for the currently active preset
export const activePreset = createSignal<string | null>(null);

/**
 * Load user presets from localStorage
 */
export function loadUserPresets(): void {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert Set-like arrays back to Sets
      const presets = parsed.map((preset: FilterPreset) => ({
        ...preset,
        filters: deserializeFilters(preset.filters),
      }));
      userPresets.set(presets);
    }
  } catch (error) {
    console.warn("Failed to load filter presets:", error);
  }
}

/**
 * Save user presets to localStorage
 */
function saveUserPresets(): void {
  try {
    const presets = userPresets.get();
    // Convert Sets to arrays for JSON serialization
    const serialized = presets.map((preset) => ({
      ...preset,
      filters: serializeFilters(preset.filters),
    }));
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("Failed to save filter presets:", error);
  }
}

/**
 * Serialize filters for storage (convert Sets to arrays)
 */
function serializeFilters(filters: Partial<FilterState>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value instanceof Set) {
      serialized[key] = Array.from(value);
    } else {
      serialized[key] = value;
    }
  }

  return serialized;
}

/**
 * Deserialize filters from storage (convert arrays to Sets)
 */
function deserializeFilters(filters: Record<string, unknown>): Partial<FilterState> {
  const deserialized: Partial<FilterState> = {};
  const setFields = ["platforms", "genres", "regions", "statuses", "eras"];

  for (const [key, value] of Object.entries(filters)) {
    if (setFields.includes(key) && Array.isArray(value)) {
      (deserialized as Record<string, unknown>)[key] = new Set(value);
    } else {
      (deserialized as Record<string, unknown>)[key] = value;
    }
  }

  return deserialized;
}

/**
 * Get all presets (built-in + user)
 */
export function getAllPresets(): FilterPreset[] {
  return [...BUILT_IN_PRESETS, ...userPresets.get()];
}

/**
 * Apply a preset to filters
 */
export function applyPreset(presetId: string): void {
  const allPresets = getAllPresets();
  const preset = allPresets.find((p) => p.id === presetId);

  if (!preset) {
    console.warn("Preset not found:", presetId);
    return;
  }

  // Merge preset filters with default state
  const newState: FilterState = {
    ...DEFAULT_FILTER_STATE,
    // Clone Sets to avoid reference issues
    platforms: new Set(DEFAULT_FILTER_STATE.platforms),
    genres: new Set(DEFAULT_FILTER_STATE.genres),
    regions: new Set(DEFAULT_FILTER_STATE.regions),
    statuses: new Set(DEFAULT_FILTER_STATE.statuses),
    eras: new Set(DEFAULT_FILTER_STATE.eras),
  };

  // Apply preset filters
  for (const [key, value] of Object.entries(preset.filters)) {
    if (value instanceof Set) {
      (newState as unknown as Record<string, unknown>)[key] = new Set(value);
    } else if (typeof value === "object" && value !== null) {
      (newState as unknown as Record<string, unknown>)[key] = { ...value };
    } else {
      (newState as unknown as Record<string, unknown>)[key] = value;
    }
  }

  setFilters(newState);
  activePreset.set(presetId);
}

/**
 * Create a new user preset from current filters
 */
export function createPreset(name: string, icon: string = "🎯"): FilterPreset {
  const currentFilters = filterState.get();

  // Extract only non-default filters
  const filtersToSave: Partial<FilterState> = {};

  if (currentFilters.platforms.size > 0) {
    filtersToSave.platforms = new Set(currentFilters.platforms);
  }
  if (currentFilters.genres.size > 0) {
    filtersToSave.genres = new Set(currentFilters.genres);
  }
  if (currentFilters.regions.size > 0) {
    filtersToSave.regions = new Set(currentFilters.regions);
  }
  if (currentFilters.statuses.size > 0) {
    filtersToSave.statuses = new Set(currentFilters.statuses);
  }
  if (currentFilters.eras.size > 0) {
    filtersToSave.eras = new Set(currentFilters.eras);
  }
  if (currentFilters.searchQuery) {
    filtersToSave.searchQuery = currentFilters.searchQuery;
  }
  if (currentFilters.yearRange.start || currentFilters.yearRange.end) {
    filtersToSave.yearRange = { ...currentFilters.yearRange };
  }
  if (currentFilters.priceRange.min || currentFilters.priceRange.max) {
    filtersToSave.priceRange = { ...currentFilters.priceRange };
  }
  if (currentFilters.minRating > 0) {
    filtersToSave.minRating = currentFilters.minRating;
  }
  if (currentFilters.sortBy !== "name") {
    filtersToSave.sortBy = currentFilters.sortBy;
    filtersToSave.sortDirection = currentFilters.sortDirection;
  }
  if (currentFilters.showDealsOnly) {
    filtersToSave.showDealsOnly = true;
  }
  if (currentFilters.showIndieOnly) {
    filtersToSave.showIndieOnly = true;
  }
  if (currentFilters.showVrOnly) {
    filtersToSave.showVrOnly = true;
  }

  const preset: FilterPreset = {
    id: `user-${Date.now()}`,
    name,
    icon,
    filters: filtersToSave,
    isBuiltIn: false,
    createdAt: Date.now(),
  };

  userPresets.set([...userPresets.get(), preset]);
  saveUserPresets();
  activePreset.set(preset.id);

  return preset;
}

/**
 * Delete a user preset
 */
export function deletePreset(presetId: string): boolean {
  const presets = userPresets.get();
  const preset = presets.find((p) => p.id === presetId);

  if (!preset || preset.isBuiltIn) {
    return false;
  }

  userPresets.set(presets.filter((p) => p.id !== presetId));
  saveUserPresets();

  if (activePreset.get() === presetId) {
    activePreset.set(null);
  }

  return true;
}

/**
 * Rename a user preset
 */
export function renamePreset(presetId: string, newName: string): boolean {
  const presets = userPresets.get();
  const index = presets.findIndex((p) => p.id === presetId);

  if (index === -1 || presets[index].isBuiltIn) {
    return false;
  }

  const updated = [...presets];
  updated[index] = { ...updated[index], name: newName };
  userPresets.set(updated);
  saveUserPresets();

  return true;
}

/**
 * Clear the active preset (when filters change manually)
 */
export function clearActivePreset(): void {
  activePreset.set(null);
}

/**
 * Initialize preset system (load from storage, setup listeners)
 */
export function initPresets(): () => void {
  // Load saved presets
  loadUserPresets();

  // Clear active preset when filters change manually
  let ignoreNextChange = false;
  const unsub = effect(() => {
    filterState.get();
    if (ignoreNextChange) {
      ignoreNextChange = false;
      return;
    }
    // Debounce to avoid clearing on preset apply
    setTimeout(() => {
      if (!ignoreNextChange) {
        activePreset.set(null);
      }
    }, 100);
  });

  // Return cleanup
  return unsub;
}

/**
 * Render preset selector UI
 */
export function renderPresetSelector(containerId: string): () => void {
  const container = document.getElementById(containerId);
  if (!container) return () => {};

  const render = (): void => {
    const presets = getAllPresets();
    const active = activePreset.get();

    container.innerHTML = `
      <div class="preset-selector">
        <div class="preset-selector__header">
          <span class="preset-selector__label">Quick Filters</span>
          <button type="button" class="preset-selector__save-btn" id="savePresetBtn" title="Save current filters as preset">
            <span aria-hidden="true">💾</span> Save
          </button>
        </div>
        <div class="preset-selector__list">
          ${presets
            .map(
              (preset) => `
            <button
              type="button"
              class="preset-chip ${active === preset.id ? "preset-chip--active" : ""}"
              data-preset-id="${escapeHtml(preset.id)}"
              title="${escapeHtml(preset.name)}"
            >
              <span class="preset-chip__icon">${escapeHtml(preset.icon)}</span>
              <span class="preset-chip__name">${escapeHtml(preset.name)}</span>
              ${
                preset.isBuiltIn
                  ? ""
                  : `<span class="preset-chip__delete" data-delete-preset="${escapeHtml(preset.id)}" title="Delete preset">×</span>`
              }
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    // Add click handlers
    container.querySelectorAll("[data-preset-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        // Don't apply if clicking delete button
        if (target.hasAttribute("data-delete-preset")) return;

        const presetId = (btn as HTMLElement).dataset.presetId;
        if (presetId) {
          applyPreset(presetId);
        }
      });
    });

    // Delete handlers
    container.querySelectorAll("[data-delete-preset]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const presetId = (btn as HTMLElement).dataset.deletePreset;
        if (presetId && confirm("Delete this preset?")) {
          deletePreset(presetId);
          render();
        }
      });
    });

    // Save button handler
    const saveBtn = container.querySelector("#savePresetBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const name = prompt("Enter a name for this filter preset:");
        if (name) {
          createPreset(name);
          render();
        }
      });
    }
  };

  // Initial render
  render();

  // Re-render on changes
  const unsub1 = userPresets.subscribe(render);
  const unsub2 = activePreset.subscribe(render);

  return () => {
    unsub1();
    unsub2();
  };
}
