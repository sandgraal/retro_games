/**
 * Theme UI helpers extracted from archive/app-legacy.js.
 * Functions for theme detection, application, and toggle UI.
 * @module ui/theme
 */

import {
  THEME_LIGHT,
  THEME_DARK,
  THEME_STORAGE_KEY,
  isValidTheme,
  getStoredThemeChoice,
} from "../state/preferences.js";

// Re-export for convenience
export { THEME_LIGHT, THEME_DARK, THEME_STORAGE_KEY, isValidTheme, getStoredThemeChoice };

// === System Theme Detection ===

/**
 * Get the user's preferred theme from system settings.
 * @returns {string} THEME_LIGHT or THEME_DARK
 */
export function getPreferredTheme() {
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

/**
 * Get the active theme (stored or system preference).
 * @returns {string} THEME_LIGHT or THEME_DARK
 */
export function getActiveTheme() {
  const stored = getStoredThemeChoice();
  return stored || getPreferredTheme();
}

/**
 * Get the opposite theme.
 * @param {string} theme - Current theme
 * @returns {string} Opposite theme
 */
export function getOppositeTheme(theme) {
  return theme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
}

// === Theme Application ===

/**
 * Apply a theme to the document.
 * @param {string} theme - Theme to apply
 */
export function applyThemeChoice(theme) {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (isValidTheme(theme)) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/**
 * Persist theme choice to localStorage.
 * @param {string} theme - Theme to persist
 */
export function persistThemeChoice(theme) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

/**
 * Clear persisted theme choice (revert to system).
 */
export function clearPersistedTheme() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// === Toggle Button Helpers ===

/**
 * Build aria attributes for theme toggle button.
 * @param {string} currentTheme - Current active theme
 * @returns {Object} Attributes object
 */
export function buildThemeToggleAttrs(currentTheme) {
  const theme = isValidTheme(currentTheme) ? currentTheme : getPreferredTheme();
  const nextTheme = getOppositeTheme(theme);
  const labelTarget = nextTheme === THEME_LIGHT ? "Light" : "Dark";

  return {
    text: `Switch to ${labelTarget} Theme`,
    ariaPressed: theme === THEME_LIGHT ? "true" : "false",
    ariaLabel: `Switch to ${labelTarget.toLowerCase()} theme`,
    title: `Switch to ${labelTarget} Theme`,
    nextTheme,
  };
}

/**
 * Update theme toggle button state.
 * @param {HTMLElement|null} button - Button element
 * @param {string} activeTheme - Current active theme
 */
export function updateThemeToggleButton(button, activeTheme) {
  if (!button) return;
  const attrs = buildThemeToggleAttrs(activeTheme);
  button.textContent = attrs.text;
  button.setAttribute("aria-pressed", attrs.ariaPressed);
  button.setAttribute("aria-label", attrs.ariaLabel);
  button.setAttribute("title", attrs.title);
  button.dataset.nextTheme = attrs.nextTheme;
}

// === Media Query Helpers ===

/**
 * Create a media query listener for color scheme changes.
 * @param {Function} callback - Called with new theme when system preference changes
 * @returns {Function|null} Cleanup function or null if not supported
 */
export function onSystemThemeChange(callback) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (event) => {
      const themeFromSystem = event.matches ? THEME_LIGHT : THEME_DARK;
      callback(themeFromSystem);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else if (typeof mediaQuery.addListener === "function") {
      // Legacy Safari support
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  } catch {
    /* noop */
  }

  return null;
}

// === CSS Variable Helpers ===

/**
 * Get a CSS custom property value.
 * @param {string} property - Property name (with or without --)
 * @param {HTMLElement} [element=document.documentElement] - Element to read from
 * @returns {string} Property value or empty string
 */
export function getCSSVariable(property, element) {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function")
    return "";
  const el = element || document.documentElement;
  const propName = property.startsWith("--") ? property : `--${property}`;
  try {
    return getComputedStyle(el).getPropertyValue(propName).trim();
  } catch {
    return "";
  }
}

/**
 * Set a CSS custom property value.
 * @param {string} property - Property name (with or without --)
 * @param {string} value - Value to set
 * @param {HTMLElement} [element=document.documentElement] - Element to set on
 */
export function setCSSVariable(property, value, element) {
  if (typeof document === "undefined") return;
  const el = element || document.documentElement;
  const propName = property.startsWith("--") ? property : `--${property}`;
  try {
    el.style.setProperty(propName, value);
  } catch {
    /* noop */
  }
}

// === Theme Initialization ===

/**
 * Initialize theme from stored preference or system setting.
 * Does not set up event listeners - call initThemeToggle for that.
 * @returns {string} The applied theme
 */
export function initializeTheme() {
  const theme = getActiveTheme();
  applyThemeChoice(theme);
  return theme;
}

/**
 * Toggle between light and dark theme.
 * @returns {string} The new active theme
 */
export function toggleTheme() {
  const current = getActiveTheme();
  const next = getOppositeTheme(current);
  applyThemeChoice(next);
  persistThemeChoice(next);
  return next;
}

// === Motion Preference ===

/**
 * Check if user prefers reduced motion.
 * @returns {boolean} True if user prefers reduced motion
 */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Get scroll behavior based on motion preference.
 * @returns {'auto'|'smooth'} Scroll behavior value
 */
export function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * Get animation delay based on motion preference.
 * @param {number} normalDelay - Normal delay in ms
 * @returns {number} 0 if reduced motion, normalDelay otherwise
 */
export function getAnimationDelay(normalDelay) {
  return prefersReducedMotion() ? 0 : normalDelay;
}
