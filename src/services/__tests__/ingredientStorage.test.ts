import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  loadIngredients,
  saveIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  searchIngredients,
  findIngredientByName,
  autoDetectIngredients,
} from '../ingredientStorage';
import { mockIngredientDatabase } from '../../__tests__/fixtures/recipes';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('ingredientStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset crypto.randomUUID mock
    (global.crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid-123');
  });

  describe('loadIngredients', () => {
    test('should load ingredients from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));

      const ingredients = loadIngredients();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('justcooked_ingredients');
      expect(ingredients).toEqual(mockIngredientDatabase);
    });

    test('should return default ingredients when localStorage is empty', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const ingredients = loadIngredients();

      expect(ingredients).toHaveLength(10); // Default ingredients count
      expect(ingredients[0].name).toBe('Salt');
      expect(ingredients[1].name).toBe('Black Pepper');
    });

    test('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const ingredients = loadIngredients();

      expect(ingredients).toHaveLength(10); // Should fall back to defaults
    });
  });

  describe('saveIngredients', () => {
    test('should save ingredients to localStorage', () => {
      saveIngredients(mockIngredientDatabase);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'justcooked_ingredients',
        JSON.stringify(mockIngredientDatabase)
      );
    });

    test('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveIngredients(mockIngredientDatabase)).not.toThrow();
    });
  });

  describe('addIngredient', () => {
    test('should add a new ingredient with generated ID and timestamps', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));
      mockLocalStorage.setItem.mockImplementation(() => {});

      const newIngredient = {
        name: 'Tomato',
        category: 'vegetables',
        aliases: ['tomatoes', 'fresh tomato'],
      };

      const result = addIngredient(newIngredient);

      expect(result.id).toBe('test-uuid-123');
      expect(result.name).toBe('Tomato');
      expect(result.category).toBe('vegetables');
      expect(result.aliases).toEqual(['tomatoes', 'fresh tomato']);
      expect(result.dateAdded).toBeDefined();
      expect(result.dateModified).toBeDefined();
    });

    test('should add ingredient to existing list', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
      
      const capturedData: any[] = [];
      mockLocalStorage.setItem.mockImplementation((_key, value) => {
        capturedData.push(JSON.parse(value as string));
      });

      const newIngredient = {
        name: 'Tomato',
        category: 'vegetables',
        aliases: [],
      };

      addIngredient(newIngredient);

      expect(capturedData[0]).toHaveLength(mockIngredientDatabase.length + 1);
      expect(capturedData[0][mockIngredientDatabase.length].name).toBe('Tomato');
    });
  });

  describe('updateIngredient', () => {
    test('should update existing ingredient', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));

      let capturedData: any;
      mockLocalStorage.setItem.mockImplementation((key, value) => {
        if (key === 'justcooked_ingredients') {
          capturedData = JSON.parse(value as string);
        }
      });

      const updates = {
        name: 'Updated Flour',
        aliases: ['updated flour', 'new alias'],
      };

      const result = updateIngredient(mockIngredientDatabase[0].id, updates);

      expect(result).toBeDefined();
      expect(capturedData).toHaveLength(mockIngredientDatabase.length);
      expect(capturedData[0].name).toBe('Updated Flour');
      expect(capturedData[0].aliases).toEqual(['updated flour', 'new alias']);
      expect(capturedData[0].dateModified).toBeDefined();
    });

    test('should handle non-existent ingredient', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
      mockLocalStorage.setItem.mockImplementation(() => {});

      const result = updateIngredient('non-existent-id', { name: 'Updated Name' });

      expect(result).toBeNull();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('deleteIngredient', () => {
    test('should delete existing ingredient', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));

      let capturedData: any;
      mockLocalStorage.setItem.mockImplementation((key, value) => {
        if (key === 'justcooked_ingredients') {
          capturedData = JSON.parse(value as string);
        }
      });

      const result = deleteIngredient(mockIngredientDatabase[0].id);

      expect(result).toBe(true);
      expect(capturedData).toHaveLength(mockIngredientDatabase.length - 1);
      expect(capturedData.find((ing: any) => ing.id === mockIngredientDatabase[0].id)).toBeUndefined();
    });

    test('should handle non-existent ingredient', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
      mockLocalStorage.setItem.mockImplementation(() => {});

      const result = deleteIngredient('non-existent');

      expect(result).toBe(false);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('searchIngredients', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
    });

    test('should find exact matches', () => {
      const results = searchIngredients('Sugar');

      expect(results).toHaveLength(1);
      expect(results[0].ingredient.name).toBe('Sugar');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].score).toBe(1);
    });

    test('should find alias matches', () => {
      const results = searchIngredients('white sugar');

      expect(results).toHaveLength(1);
      expect(results[0].ingredient.name).toBe('Sugar');
      expect(results[0].matchType).toBe('alias');
    });

    test('should find fuzzy matches', () => {
      const results = searchIngredients('flou');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].ingredient.name).toBe('All-Purpose Flour');
      expect(results[0].matchType).toBe('fuzzy');
    });

    test('should return empty array for no matches', () => {
      const results = searchIngredients('nonexistent ingredient');

      expect(results).toEqual([]);
    });

    test('should handle case insensitive search', () => {
      const results = searchIngredients('SUGAR');

      expect(results).toHaveLength(1);
      expect(results[0].ingredient.name).toBe('Sugar');
    });

    test('should sort results by score', () => {
      const results = searchIngredients('egg');

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });

  describe('findIngredientByName', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
    });

    test('should find ingredient by exact name', () => {
      const ingredient = findIngredientByName('Sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });

    test('should find ingredient by alias', () => {
      const ingredient = findIngredientByName('white sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });

    test('should return null for non-existent ingredient', () => {
      const ingredient = findIngredientByName('nonexistent');

      expect(ingredient).toBeNull();
    });

    test('should handle case insensitive search', () => {
      const ingredient = findIngredientByName('SUGAR');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });
  });



  describe('autoDetectIngredients', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockIngredientDatabase));
    });

    test('should add new ingredients and skip existing ones', () => {
      const capturedData: any[] = [];
      mockLocalStorage.setItem.mockImplementation((_key, value) => {
        capturedData.push(JSON.parse(value as string));
      });

      const ingredientNames = ['Sugar', 'New Ingredient', 'Another New One'];

      const newIngredients = autoDetectIngredients(ingredientNames);

      // Should only add the new ingredients (Sugar already exists)
      expect(newIngredients).toHaveLength(2);
      expect(newIngredients[0].name).toBe('New Ingredient');
      expect(newIngredients[1].name).toBe('Another New One');
    });

    test('should clean ingredient names before processing', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        // Mock implementation for storage
      });

      const ingredientNames = ['2 cups fresh tomatoes, diced'];

      const newIngredients = autoDetectIngredients(ingredientNames);

      expect(newIngredients).toHaveLength(1);
      expect(newIngredients[0].name).toBe('2 cups fresh tomatoes'); // cleanIngredientName removes ", diced"
    });
  });
});
