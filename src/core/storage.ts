/**
 * Safe storage helper
 * Provides a no-op storage fallback for non-browser environments
 */

const hasBrowserStorage =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

export const safeStorage: Storage = hasBrowserStorage ? window.localStorage : noopStorage;

export const isStorageAvailable = hasBrowserStorage;
