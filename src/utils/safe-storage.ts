/**
 * Safe storage helper for resilient localStorage access
 */

export const safeStorage = {
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
};
