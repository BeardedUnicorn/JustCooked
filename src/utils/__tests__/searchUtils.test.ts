import { describe, test, expect } from '@jest/globals';
import {
  fuzzySearch,
  generateSearchSuggestions,
  highlightMatches,
  levenshteinDistance,
  advancedFuzzySearch,
  SearchableItem
} from '@utils/searchUtils';

// Test data fixtures
const mockSearchableItems: SearchableItem[] = [
  {
    name: 'Chocolate Chip Cookies',
    aliases: ['cookies', 'choc chip cookies', 'chocolate cookies']
  },
  {
    name: 'Vanilla Cake',
    aliases: ['cake', 'vanilla sponge', 'birthday cake']
  },
  {
    name: 'Apple Pie',
    aliases: ['pie', 'apple tart', 'fruit pie']
  },
  {
    name: 'Banana Bread',
    aliases: ['bread', 'banana loaf', 'quick bread']
  },
  {
    name: 'Chocolate Brownies',
    aliases: ['brownies', 'fudge brownies', 'chocolate squares']
  },
  {
    name: 'Strawberry Shortcake',
    aliases: ['shortcake', 'strawberry cake', 'berry dessert']
  }
];

const mockPreviousSearches = [
  'chocolate chip cookies',
  'vanilla cake recipe',
  'apple pie filling',
  'banana bread moist',
  'chocolate brownies fudgy',
  'strawberry shortcake easy',
  'lemon bars',
  'carrot cake',
  'pumpkin pie',
  'sugar cookies'
];

describe('searchUtils', () => {
  describe('fuzzySearch', () => {
    test('should return exact matches with highest score', () => {
      const results = fuzzySearch(mockSearchableItems, 'Apple Pie');
      
      expect(results).toHaveLength(1);
      expect(results[0].item.name).toBe('Apple Pie');
      expect(results[0].score).toBe(1);
      expect(results[0].matchType).toBe('exact');
    });

    test('should return alias matches with score 0.9', () => {
      const results = fuzzySearch(mockSearchableItems, 'cookies');
      
      expect(results.length).toBeGreaterThan(0);
      const cookieMatch = results.find(r => r.item.name === 'Chocolate Chip Cookies');
      expect(cookieMatch).toBeDefined();
      expect(cookieMatch!.score).toBe(0.9);
      expect(cookieMatch!.matchType).toBe('alias');
    });

    test('should return fuzzy matches for partial strings', () => {
      const results = fuzzySearch(mockSearchableItems, 'chocolate');
      
      expect(results.length).toBeGreaterThan(0);
      const chocolateItems = results.filter(r => 
        r.item.name.toLowerCase().includes('chocolate')
      );
      expect(chocolateItems.length).toBeGreaterThan(0);
      
      chocolateItems.forEach(item => {
        expect(item.matchType).toBe('fuzzy');
        expect(item.score).toBeGreaterThan(0);
        expect(item.score).toBeLessThan(1);
      });
    });

    test('should be case insensitive by default', () => {
      const upperResults = fuzzySearch(mockSearchableItems, 'CHOCOLATE');
      const lowerResults = fuzzySearch(mockSearchableItems, 'chocolate');
      
      expect(upperResults).toEqual(lowerResults);
    });

    test('should respect case sensitivity when enabled', () => {
      const results = fuzzySearch(mockSearchableItems, 'CHOCOLATE', { caseSensitive: true });
      
      expect(results).toHaveLength(0);
    });

    test('should return all items when query is empty', () => {
      const results = fuzzySearch(mockSearchableItems, '');
      
      expect(results).toHaveLength(mockSearchableItems.length);
      results.forEach(result => {
        expect(result.score).toBe(1);
        expect(result.matchType).toBe('exact');
      });
    });

    test('should limit results based on maxResults option', () => {
      const results = fuzzySearch(mockSearchableItems, 'a', { maxResults: 2 });
      
      expect(results).toHaveLength(2);
    });

    test('should filter by threshold', () => {
      const results = fuzzySearch(mockSearchableItems, 'x', { threshold: 0.5 });
      
      expect(results).toHaveLength(0);
    });

    test('should sort results by score in descending order', () => {
      const results = fuzzySearch(mockSearchableItems, 'cake');
      
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    test('should handle items without aliases', () => {
      const itemsWithoutAliases: SearchableItem[] = [
        { name: 'Simple Recipe' },
        { name: 'Another Recipe' }
      ];
      
      const results = fuzzySearch(itemsWithoutAliases, 'simple');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Simple Recipe');
    });

    test('should handle empty items array', () => {
      const results = fuzzySearch([], 'test');
      
      expect(results).toHaveLength(0);
    });

    test('should handle special characters in query', () => {
      const specialItems: SearchableItem[] = [
        { name: 'Café au Lait' },
        { name: 'Piña Colada' }
      ];
      
      const results = fuzzySearch(specialItems, 'café');
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('generateSearchSuggestions', () => {
    test('should return matching suggestions', () => {
      const suggestions = generateSearchSuggestions('chocolate', mockPreviousSearches);
      
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.toLowerCase()).toContain('chocolate');
      });
    });

    test('should exclude exact matches', () => {
      const suggestions = generateSearchSuggestions('chocolate chip cookies', mockPreviousSearches);
      
      expect(suggestions).not.toContain('chocolate chip cookies');
    });

    test('should limit suggestions to maxSuggestions', () => {
      const suggestions = generateSearchSuggestions('a', mockPreviousSearches, 3);
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should return empty array for empty query', () => {
      const suggestions = generateSearchSuggestions('', mockPreviousSearches);
      
      expect(suggestions).toHaveLength(0);
    });

    test('should return empty array for whitespace-only query', () => {
      const suggestions = generateSearchSuggestions('   ', mockPreviousSearches);
      
      expect(suggestions).toHaveLength(0);
    });

    test('should be case insensitive', () => {
      const upperSuggestions = generateSearchSuggestions('CHOCOLATE', mockPreviousSearches);
      const lowerSuggestions = generateSearchSuggestions('chocolate', mockPreviousSearches);
      
      expect(upperSuggestions).toEqual(lowerSuggestions);
    });

    test('should handle empty previous searches', () => {
      const suggestions = generateSearchSuggestions('test', []);
      
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('highlightMatches', () => {
    test('should wrap matches in mark tags', () => {
      const result = highlightMatches('Chocolate Chip Cookies', 'chocolate');
      
      expect(result).toBe('<mark>Chocolate</mark> Chip Cookies');
    });

    test('should handle multiple matches', () => {
      const result = highlightMatches('Chocolate Chocolate Chip', 'chocolate');
      
      expect(result).toBe('<mark>Chocolate</mark> <mark>Chocolate</mark> Chip');
    });

    test('should be case insensitive', () => {
      const result = highlightMatches('Chocolate Chip Cookies', 'CHOCOLATE');
      
      expect(result).toBe('<mark>Chocolate</mark> Chip Cookies');
    });

    test('should return original text for empty query', () => {
      const text = 'Chocolate Chip Cookies';
      const result = highlightMatches(text, '');
      
      expect(result).toBe(text);
    });

    test('should return original text for whitespace-only query', () => {
      const text = 'Chocolate Chip Cookies';
      const result = highlightMatches(text, '   ');
      
      expect(result).toBe(text);
    });

    test('should escape special regex characters', () => {
      const result = highlightMatches('Test (special) characters', '(special)');
      
      expect(result).toBe('Test <mark>(special)</mark> characters');
    });

    test('should handle no matches', () => {
      const text = 'Chocolate Chip Cookies';
      const result = highlightMatches(text, 'vanilla');
      
      expect(result).toBe(text);
    });
  });

  describe('levenshteinDistance', () => {
    test('should return 0 for identical strings', () => {
      const distance = levenshteinDistance('hello', 'hello');
      
      expect(distance).toBe(0);
    });

    test('should calculate correct distance for different strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    test('should handle single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
      expect(levenshteinDistance('cat', 'at')).toBe(1);
    });

    test('should be symmetric', () => {
      const str1 = 'hello';
      const str2 = 'world';
      
      expect(levenshteinDistance(str1, str2)).toBe(levenshteinDistance(str2, str1));
    });

    test('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('test', '')).toBe(4);
      expect(levenshteinDistance('', 'test')).toBe(4);
    });
  });

  describe('advancedFuzzySearch', () => {
    test('should return exact matches with highest score', () => {
      const results = advancedFuzzySearch(mockSearchableItems, 'Apple Pie');
      
      expect(results).toHaveLength(1);
      expect(results[0].item.name).toBe('Apple Pie');
      expect(results[0].score).toBe(1);
      expect(results[0].matchType).toBe('exact');
    });

    test('should return fuzzy matches within distance threshold', () => {
      const results = advancedFuzzySearch(mockSearchableItems, 'Appl Pie', { maxDistance: 2 });
      
      expect(results.length).toBeGreaterThan(0);
      const appleMatch = results.find(r => r.item.name === 'Apple Pie');
      expect(appleMatch).toBeDefined();
      expect(appleMatch!.matchType).toBe('fuzzy');
    });

    test('should filter out matches beyond distance threshold', () => {
      const results = advancedFuzzySearch(mockSearchableItems, 'xyz', { maxDistance: 1 });
      
      expect(results).toHaveLength(0);
    });

    test('should limit results based on maxResults', () => {
      const results = advancedFuzzySearch(mockSearchableItems, 'a', { maxResults: 2 });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should return all items for empty query', () => {
      const results = advancedFuzzySearch(mockSearchableItems, '');
      
      expect(results).toHaveLength(mockSearchableItems.length);
      results.forEach(result => {
        expect(result.score).toBe(1);
        expect(result.matchType).toBe('exact');
      });
    });

    test('should sort results by score in descending order', () => {
      const results = advancedFuzzySearch(mockSearchableItems, 'cake', { maxDistance: 3 });
      
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    test('should handle empty items array', () => {
      const results = advancedFuzzySearch([], 'test');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      // These should not throw errors
      expect(() => fuzzySearch(mockSearchableItems, null as any)).not.toThrow();
      expect(() => fuzzySearch(mockSearchableItems, undefined as any)).not.toThrow();
      expect(() => generateSearchSuggestions(null as any, mockPreviousSearches)).not.toThrow();
      expect(() => highlightMatches('test', null as any)).not.toThrow();
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const longItems: SearchableItem[] = [{ name: longString }];
      
      expect(() => fuzzySearch(longItems, 'a')).not.toThrow();
      expect(() => levenshteinDistance(longString, 'test')).not.toThrow();
    });

    test('should handle unicode characters', () => {
      const unicodeItems: SearchableItem[] = [
        { name: '🍪 Cookies' },
        { name: 'Café Latté' },
        { name: '北京烤鸭' }
      ];
      
      expect(() => fuzzySearch(unicodeItems, '🍪')).not.toThrow();
      expect(() => fuzzySearch(unicodeItems, 'café')).not.toThrow();
    });

    test('should handle items with very long aliases arrays', () => {
      const itemWithManyAliases: SearchableItem = {
        name: 'Test Recipe',
        aliases: Array.from({ length: 100 }, (_, i) => `alias${i}`)
      };
      
      expect(() => fuzzySearch([itemWithManyAliases], 'alias50')).not.toThrow();
    });
  });
});
