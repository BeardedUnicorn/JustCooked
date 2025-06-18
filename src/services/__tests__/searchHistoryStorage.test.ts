import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  getRecentSearches,
  saveSearch,
  removeSearch,
  clearSearchHistory,
  getSearchSuggestions,
} from '../searchHistoryStorage';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const mockSearches = [
  {
    id: 'search-1',
    query: 'chocolate cake',
    timestamp: '2024-01-15T10:00:00.000Z',
    filters: {
      query: 'test',
      tags: ['dessert'],
      difficulty: ['Easy'],
      maxPrepTime: 30,
    },
  },
  {
    id: 'search-2',
    query: 'pasta',
    timestamp: '2024-01-15T11:00:00.000Z',
    filters: {
      query: 'test',
      tags: ['dessert'],
      difficulty: ['Easy'],
      maxPrepTime: 30,
    },
  },
];

describe('searchHistoryStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset crypto.randomUUID mock
    vi.mocked(global.crypto.randomUUID).mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
  });

  describe('getRecentSearches', () => {
    test('should return recent searches from database', async () => {
      mockInvoke.mockResolvedValue(mockSearches);

      const searches = await getRecentSearches(10);

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recent_searches', { limit: 10 });
      expect(searches).toEqual(mockSearches);
    });

    test('should return empty array when database call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const searches = await getRecentSearches();

      expect(searches).toEqual([]);
    });

    test('should use default limit of 10', async () => {
      mockInvoke.mockResolvedValue([]);

      await getRecentSearches();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recent_searches', { limit: 10 });
    });
  });

  describe('saveSearch', () => {
    test('should save new search to database', async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // getRecentSearches call
        .mockResolvedValueOnce(undefined); // db_save_search_history call

      await saveSearch('chocolate cake');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recent_searches', { limit: 50 });
      expect(mockInvoke).toHaveBeenCalledWith('db_save_search_history', {
        search: expect.objectContaining({
          id: 'test-uuid-123',
          query: 'chocolate cake',
          timestamp: expect.any(String),
          filters: {},
        }),
      });
    });

    test('should update existing search with new timestamp', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockSearches) // getRecentSearches call
        .mockResolvedValueOnce(undefined); // db_save_search_history call

      await saveSearch('chocolate cake');

      expect(mockInvoke).toHaveBeenCalledWith('db_save_search_history', {
        search: expect.objectContaining({
          id: 'search-1',
          query: 'chocolate cake',
          timestamp: expect.any(String),
        }),
      });
    });

    test('should handle database save errors gracefully', async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // getRecentSearches call
        .mockRejectedValueOnce(new Error('Database error')); // db_save_search_history call

      // Should not throw
      await expect(saveSearch('test')).resolves.toBeUndefined();
    });
  });

  describe('removeSearch', () => {
    test('should remove search from database', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await removeSearch('search-1');

      expect(mockInvoke).toHaveBeenCalledWith('db_delete_search_history', { id: 'search-1' });
    });

    test('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(removeSearch('search-1')).resolves.toBeUndefined();
    });
  });

  describe('clearSearchHistory', () => {
    test('should clear all search history', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await clearSearchHistory();

      expect(mockInvoke).toHaveBeenCalledWith('db_clear_search_history');
    });

    test('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(clearSearchHistory()).resolves.toBeUndefined();
    });
  });

  describe('getSearchSuggestions', () => {
    test('should return matching suggestions', async () => {
      const searchHistory = [
        { id: '1', query: 'chocolate cake', timestamp: '2024-01-01', filters: {} },
        { id: '2', query: 'chocolate chip cookies', timestamp: '2024-01-02', filters: {} },
        { id: '3', query: 'vanilla cake', timestamp: '2024-01-03', filters: {} },
      ];
      mockInvoke.mockResolvedValue(searchHistory);

      const suggestions = await getSearchSuggestions('chocolate');

      expect(suggestions).toEqual(['chocolate cake', 'chocolate chip cookies']);
    });

    test('should return empty array for empty query', async () => {
      const suggestions = await getSearchSuggestions('');

      expect(suggestions).toEqual([]);
    });

    test('should limit suggestions to specified number', async () => {
      const searchHistory = [
        { id: '1', query: 'cake 1', timestamp: '2024-01-01', filters: {} },
        { id: '2', query: 'cake 2', timestamp: '2024-01-02', filters: {} },
        { id: '3', query: 'cake 3', timestamp: '2024-01-03', filters: {} },
      ];
      mockInvoke.mockResolvedValue(searchHistory);

      const suggestions = await getSearchSuggestions('cake', 2);

      expect(suggestions).toHaveLength(2);
    });

    test('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const suggestions = await getSearchSuggestions('test');

      expect(suggestions).toEqual([]);
    });
  });
});
