/**
 * Utility functions for localStorage operations
 */

// Generic localStorage getter with error handling
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Failed to load from localStorage (key: ${key}):`, error);
    return defaultValue;
  }
}

// Generic localStorage setter with error handling
export function setToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage (key: ${key}):`, error);
    return false;
  }
}

// Remove item from localStorage with error handling
export function removeFromStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove from localStorage (key: ${key}):`, error);
    return false;
  }
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Get storage usage information
export function getStorageInfo(): { used: number; available: number; total: number } {
  if (!isStorageAvailable()) {
    return { used: 0, available: 0, total: 0 };
  }

  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }

  // Most browsers have a 5-10MB limit for localStorage
  const total = 5 * 1024 * 1024; // 5MB estimate
  const available = total - used;

  return { used, available, total };
}

// Clear all items with a specific prefix
export function clearStorageByPrefix(prefix: string): number {
  if (!isStorageAvailable()) {
    return 0;
  }

  const keysToRemove: string[] = [];
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  return keysToRemove.length;
}

// Get all keys with a specific prefix
export function getStorageKeysByPrefix(prefix: string): string[] {
  if (!isStorageAvailable()) {
    return [];
  }

  const keys: string[] = [];
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith(prefix)) {
      keys.push(key);
    }
  }

  return keys;
}
