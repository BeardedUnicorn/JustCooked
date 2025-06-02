import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  getRecentSearches,
  saveSearch,
  clearSearchHistory,
  removeSearch,
  getSearchSuggestions,
} from '@services/searchHistoryStorage';
import { SearchFilters, RecentSearch } from '@app-types';

const mockFilters: SearchFilters = {
  query: 'test',
  tags: ['dessert'],
  difficulty: ['Easy'],
  maxPrepTime: 30,
};

describe('searchHistoryStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('saveSearch', () => {
    test('should save new search successfully', () => {
      saveSearch('chocolate cake', mockFilters);

      const stored = localStorage.getItem('search_history');
      expect(stored).toBeTruthy();
      
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(1);
      expect(searches[0].query).toBe('chocolate cake');
      expect(searches[0].filters).toEqual(mockFilters);
      expect(searches[0].id).toBeTruthy();
      expect(searches[0].timestamp).toBeTruthy();
    });

    test('should add search to existing history', () => {
      // Add first search
      saveSearch('pasta', mockFilters);
      saveSearch('chocolate cake', mockFilters);

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(2);
      expect(searches[0].query).toBe('chocolate cake'); // Most recent first
      expect(searches[1].query).toBe('pasta');
    });

    test('should not add duplicate searches', () => {
      saveSearch('chocolate cake', mockFilters);
      saveSearch('pasta', mockFilters);
      saveSearch('chocolate cake', mockFilters); // Duplicate

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(2);
      expect(searches[0].query).toBe('chocolate cake'); // Should move to front
      expect(searches[1].query).toBe('pasta');
    });

    test('should limit history to maximum items', () => {
      // Add 15 searches (more than the max of 10)
      for (let i = 0; i < 15; i++) {
        saveSearch(`search-${i}`, mockFilters);
      }

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(10); // Should not exceed max
      expect(searches[0].query).toBe('search-14'); // Most recent should be first
    });

    test('should ignore empty or whitespace-only searches', () => {
      saveSearch('', mockFilters);
      saveSearch('   ', mockFilters);
      saveSearch('\t\n', mockFilters);

      const stored = localStorage.getItem('search_history');
      expect(stored).toBeNull();
    });

    test('should trim whitespace from search terms', () => {
      saveSearch('  chocolate cake  ', mockFilters);

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches[0].query).toBe('chocolate cake');
    });
  });

  describe('getRecentSearches', () => {
    test('should return recent searches successfully', () => {
      const mockSearch: RecentSearch = {
        id: 'test-id',
        query: 'chocolate cake',
        filters: mockFilters,
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      localStorage.setItem('search_history', JSON.stringify([mockSearch]));

      const searches = getRecentSearches();

      expect(searches).toHaveLength(1);
      expect(searches[0]).toEqual(mockSearch);
    });

    test('should return empty array when no searches exist', () => {
      const searches = getRecentSearches();

      expect(searches).toEqual([]);
    });

    test('should handle invalid JSON gracefully', () => {
      localStorage.setItem('search_history', 'invalid json');

      const searches = getRecentSearches();

      expect(searches).toEqual([]);
    });

    test('should handle localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      const searches = getRecentSearches();

      expect(searches).toEqual([]);

      // Restore original method
      localStorage.getItem = originalGetItem;
    });
  });

  describe('clearSearchHistory', () => {
    test('should clear search history successfully', () => {
      // Add some searches first
      saveSearch('test search', mockFilters);
      expect(localStorage.getItem('search_history')).toBeTruthy();

      clearSearchHistory();

      expect(localStorage.getItem('search_history')).toBeNull();
    });
  });

  describe('removeSearch', () => {
    test('should remove specific search successfully', () => {
      const search1: RecentSearch = {
        id: 'search-1',
        query: 'chocolate cake',
        filters: mockFilters,
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      const search2: RecentSearch = {
        id: 'search-2',
        query: 'pasta',
        filters: mockFilters,
        timestamp: '2024-01-15T11:00:00.000Z',
      };
      localStorage.setItem('search_history', JSON.stringify([search1, search2]));

      removeSearch('search-1');

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(1);
      expect(searches[0].id).toBe('search-2');
    });

    test('should handle removal of non-existent search', () => {
      const search: RecentSearch = {
        id: 'search-1',
        query: 'chocolate cake',
        filters: mockFilters,
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      localStorage.setItem('search_history', JSON.stringify([search]));

      removeSearch('nonexistent');

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches).toHaveLength(1);
      expect(searches[0].id).toBe('search-1');
    });

    test('should handle empty history', () => {
      removeSearch('search-1');

      const stored = localStorage.getItem('search_history');
      expect(stored).toBeNull();
    });
  });

  describe('getSearchSuggestions', () => {
    beforeEach(() => {
      const searches: RecentSearch[] = [
        {
          id: '1',
          query: 'chocolate cake',
          filters: mockFilters,
          timestamp: '2024-01-15T10:00:00.000Z',
        },
        {
          id: '2',
          query: 'chocolate chip cookies',
          filters: mockFilters,
          timestamp: '2024-01-15T11:00:00.000Z',
        },
        {
          id: '3',
          query: 'vanilla cake',
          filters: mockFilters,
          timestamp: '2024-01-15T12:00:00.000Z',
        },
        {
          id: '4',
          query: 'pasta',
          filters: mockFilters,
          timestamp: '2024-01-15T13:00:00.000Z',
        },
      ];
      localStorage.setItem('search_history', JSON.stringify(searches));
    });

    test('should return matching suggestions', () => {
      const suggestions = getSearchSuggestions('chocolate');

      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('chocolate cake');
      expect(suggestions).toContain('chocolate chip cookies');
    });

    test('should exclude exact matches', () => {
      const suggestions = getSearchSuggestions('chocolate cake');

      expect(suggestions).toHaveLength(0);
      expect(suggestions).not.toContain('chocolate cake');
    });

    test('should return empty array for empty query', () => {
      const suggestions = getSearchSuggestions('');

      expect(suggestions).toEqual([]);
    });

    test('should return empty array for whitespace-only query', () => {
      const suggestions = getSearchSuggestions('   ');

      expect(suggestions).toEqual([]);
    });

    test('should limit suggestions to 5 items', () => {
      // Add more searches with 'cake' in them
      const moreSearches: RecentSearch[] = [];
      for (let i = 0; i < 10; i++) {
        moreSearches.push({
          id: `cake-${i}`,
          query: `cake recipe ${i}`,
          filters: mockFilters,
          timestamp: '2024-01-15T10:00:00.000Z',
        });
      }
      localStorage.setItem('search_history', JSON.stringify(moreSearches));

      const suggestions = getSearchSuggestions('cake');

      expect(suggestions).toHaveLength(5);
    });

    test('should be case insensitive', () => {
      const suggestions = getSearchSuggestions('CHOCOLATE');

      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('chocolate cake');
      expect(suggestions).toContain('chocolate chip cookies');
    });
  });

  describe('edge cases', () => {
    test('should handle very long search terms', () => {
      const longTerm = 'a'.repeat(1000);
      
      saveSearch(longTerm, mockFilters);

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches[0].query).toBe(longTerm);
    });

    test('should handle special characters in search terms', () => {
      const specialTerm = 'café & "special" chars: 中文';
      
      saveSearch(specialTerm, mockFilters);

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches[0].query).toBe(specialTerm);
    });

    test('should handle unicode characters', () => {
      const unicodeTerm = 'jalapeño peppers 🌶️';
      
      saveSearch(unicodeTerm, mockFilters);

      const stored = localStorage.getItem('search_history');
      const searches = JSON.parse(stored!);
      expect(searches[0].query).toBe(unicodeTerm);
    });
  });
});
