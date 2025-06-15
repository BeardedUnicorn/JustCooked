import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  getFromStorage,
  setToStorage,
  removeFromStorage,
  isStorageAvailable,
  getStorageInfo,
  clearStorageByPrefix,
  getStorageKeysByPrefix
} from '@utils/storageUtils';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    hasOwnProperty: vi.fn((key: string) => key in store),
    // Add store access for testing
    _getStore: () => store,
    _setStore: (newStore: { [key: string]: string }) => {
      store = newStore;
      // Update the mock storage object to be iterable
      Object.keys(store).forEach(key => {
        (mockStorage as any)[key] = store[key];
      });
    }
  };

  return mockStorage;
})();

// Mock the global localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('storageUtils', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();

    // Clear any enumerable properties from the mock
    Object.keys(localStorageMock).forEach(key => {
      if (!['getItem', 'setItem', 'removeItem', 'clear', 'length', 'key', 'hasOwnProperty', '_getStore', '_setStore'].includes(key)) {
        delete (localStorageMock as any)[key];
      }
    });
  });

  describe('getFromStorage', () => {
    test('should return parsed value when key exists', () => {
      const testData = { name: 'test', value: 123 };
      localStorageMock.setItem('test-key', JSON.stringify(testData));

      const result = getFromStorage('test-key', null);
      expect(result).toEqual(testData);
    });

    test('should return default value when key does not exist', () => {
      const defaultValue = { default: true };
      const result = getFromStorage('non-existent-key', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('should return default value when JSON parsing fails', () => {
      localStorageMock.setItem('invalid-json', 'invalid json string');
      const defaultValue: any[] = [];

      const result = getFromStorage('invalid-json', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('should handle different data types', () => {
      // String
      localStorageMock.setItem('string-key', JSON.stringify('hello'));
      expect(getFromStorage('string-key', '')).toBe('hello');

      // Number
      localStorageMock.setItem('number-key', JSON.stringify(42));
      expect(getFromStorage('number-key', 0)).toBe(42);

      // Array
      localStorageMock.setItem('array-key', JSON.stringify([1, 2, 3]));
      expect(getFromStorage('array-key', [])).toEqual([1, 2, 3]);

      // Boolean
      localStorageMock.setItem('boolean-key', JSON.stringify(true));
      expect(getFromStorage('boolean-key', false)).toBe(true);
    });
  });

  describe('setToStorage', () => {
    test('should store value successfully', () => {
      const testData = { name: 'test', value: 123 };
      const result = setToStorage('test-key', testData);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
    });

    test('should handle different data types', () => {
      expect(setToStorage('string', 'hello')).toBe(true);
      expect(setToStorage('number', 42)).toBe(true);
      expect(setToStorage('array', [1, 2, 3])).toBe(true);
      expect(setToStorage('boolean', true)).toBe(true);
      expect(setToStorage('object', { key: 'value' })).toBe(true);
    });

    test('should return false when storage fails', () => {
      // Mock setItem to throw an error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = setToStorage('test-key', 'test-value');
      expect(result).toBe(false);
    });
  });

  describe('removeFromStorage', () => {
    test('should remove item successfully', () => {
      localStorageMock.setItem('test-key', 'test-value');
      const result = removeFromStorage('test-key');

      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });

    test('should return false when removal fails', () => {
      // Mock removeItem to throw an error
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = removeFromStorage('test-key');
      expect(result).toBe(false);
    });

    test('should handle non-existent keys gracefully', () => {
      const result = removeFromStorage('non-existent-key');
      expect(result).toBe(true);
    });
  });

  describe('isStorageAvailable', () => {
    test('should return true when localStorage is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });

    test('should return false when localStorage throws an error', () => {
      // Mock setItem to throw an error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage not available');
      });

      expect(isStorageAvailable()).toBe(false);
    });
  });

  describe('getStorageInfo', () => {
    test('should return storage usage information', () => {
      // Add some test data
      localStorageMock.setItem('key1', 'value1');
      localStorageMock.setItem('key2', 'value2');

      const info = getStorageInfo();
      
      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('available');
      expect(info).toHaveProperty('total');
      expect(info.used).toBeGreaterThan(0);
      expect(info.total).toBe(5 * 1024 * 1024); // 5MB
      expect(info.available).toBe(info.total - info.used);
    });

    test('should return zeros when storage is not available', () => {
      // Mock localStorage to not be available
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage not available');
      });

      const info = getStorageInfo();
      expect(info).toEqual({ used: 0, available: 0, total: 0 });
    });
  });

  describe('clearStorageByPrefix', () => {
    test('should clear items with specific prefix', () => {
      // Add test data
      const store = {
        'app_setting1': 'value1',
        'app_setting2': 'value2',
        'other_data': 'value3'
      };
      (localStorageMock as any)._setStore(store);

      const removedCount = clearStorageByPrefix('app_');

      expect(removedCount).toBe(2);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app_setting1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app_setting2');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other_data');
    });

    test('should return 0 when no items match prefix', () => {
      localStorageMock.setItem('other_data', 'value');
      const store = { 'other_data': 'value' };
      (localStorageMock as any)._setStore(store);

      const removedCount = clearStorageByPrefix('app_');
      expect(removedCount).toBe(0);
    });

    test('should return 0 when storage is not available', () => {
      // Mock localStorage to not be available
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage not available');
      });

      const removedCount = clearStorageByPrefix('app_');
      expect(removedCount).toBe(0);
    });
  });

  describe('getStorageKeysByPrefix', () => {
    test('should return keys with specific prefix', () => {
      const store = {
        'app_setting1': 'value1',
        'app_setting2': 'value2',
        'other_data': 'value3'
      };
      (localStorageMock as any)._setStore(store);

      const keys = getStorageKeysByPrefix('app_');
      expect(keys).toEqual(['app_setting1', 'app_setting2']);
    });

    test('should return empty array when no items match prefix', () => {
      const store = { 'other_data': 'value' };
      (localStorageMock as any)._setStore(store);

      const keys = getStorageKeysByPrefix('app_');
      expect(keys).toEqual([]);
    });

    test('should return empty array when storage is not available', () => {
      // Mock localStorage to not be available
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage not available');
      });

      const keys = getStorageKeysByPrefix('app_');
      expect(keys).toEqual([]);
    });
  });
});
