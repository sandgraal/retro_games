/**
 * Safe storage helper for resilient localStorage access
 */

type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
};

const noopStorage: StorageAdapter = {
  getItem: () => null,
  setItem: () => false,
  removeItem: () => false,
};

function createStorageAdapter(): StorageAdapter {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return noopStorage;
  }

  try {
    const testKey = "__safe_storage_test__";
    window.localStorage.setItem(testKey, "ok");
    window.localStorage.removeItem(testKey);
  } catch (error) {
    console.warn("localStorage is not available; falling back to noop storage", error);
    return noopStorage;
  }

  return {
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to read localStorage key "${key}"`, error);
        return null;
      }
    },
    setItem(key: string, value: string): boolean {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn(`Failed to write localStorage key "${key}"`, error);
        return false;
      }
    },
    removeItem(key: string): boolean {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Failed to remove localStorage key "${key}"`, error);
        return false;
      }
    },
  } satisfies StorageAdapter;
}

export const safeStorage = createStorageAdapter();
export const isStorageAvailable = safeStorage !== noopStorage;
