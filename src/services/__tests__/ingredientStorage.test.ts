import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  loadIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  searchIngredients,
  findIngredientByName,
  autoDetectIngredients,
} from '../ingredientStorage';
import { mockIngredientDatabase } from '../../__tests__/fixtures/recipes';

// Mock Tauri invoke
const mockInvoke = vi.fn() as vi.MockedFunction<any>;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('ingredientStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset crypto.randomUUID mock
    (global.crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid-123');
  });

  describe('loadIngredients', () => {
    test('should load ingredients from database', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const ingredients = await loadIngredients();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
      expect(ingredients).toEqual(mockIngredientDatabase);
    });

    test('should return empty array when database call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const ingredients = await loadIngredients();

      expect(ingredients).toEqual([]);
    });
  });

  describe('addIngredient', () => {
    test('should add a new ingredient with generated ID and timestamps', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const newIngredient = {
        name: 'Tomato',
        category: 'vegetables',
        aliases: ['tomatoes', 'fresh tomato'],
      };

      const result = await addIngredient(newIngredient);

      expect(result.id).toBe('test-uuid-123');
      expect(result.name).toBe('Tomato');
      expect(result.category).toBe('vegetables');
      expect(result.aliases).toEqual(['tomatoes', 'fresh tomato']);
      expect(result.dateAdded).toBeDefined();
      expect(result.dateModified).toBeDefined();
      expect(mockInvoke).toHaveBeenCalledWith('db_save_ingredient', { ingredient: result });
    });

    test('should handle database save errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const newIngredient = {
        name: 'Tomato',
        category: 'vegetables',
        aliases: [],
      };

      await expect(addIngredient(newIngredient)).rejects.toThrow('Database error');
    });
  });

  describe('updateIngredient', () => {
    test('should update existing ingredient', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockIngredientDatabase) // loadIngredients call
        .mockResolvedValueOnce(undefined); // saveIngredient call

      const updates = {
        name: 'Updated Flour',
        aliases: ['updated flour', 'new alias'],
      };

      const result = await updateIngredient(mockIngredientDatabase[0].id, updates);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated Flour');
      expect(result!.aliases).toEqual(['updated flour', 'new alias']);
      expect(result!.dateModified).toBeDefined();
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
      expect(mockInvoke).toHaveBeenCalledWith('db_save_ingredient', { ingredient: result });
    });

    test('should handle non-existent ingredient', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const result = await updateIngredient('non-existent-id', { name: 'Updated Name' });

      expect(result).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
      expect(mockInvoke).toHaveBeenCalledTimes(1); // Only the load call, no save call
    });
  });

  describe('deleteIngredient', () => {
    test('should delete existing ingredient', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await deleteIngredient(mockIngredientDatabase[0].id);

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('db_delete_ingredient', { id: mockIngredientDatabase[0].id });
    });

    test('should handle non-existent ingredient', async () => {
      mockInvoke.mockResolvedValue(false);

      const result = await deleteIngredient('non-existent');

      expect(result).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('db_delete_ingredient', { id: 'non-existent' });
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const result = await deleteIngredient('test-id');

      expect(result).toBe(false);
    });
  });

  describe('searchIngredients', () => {
    test('should search ingredients in database', async () => {
      const searchResults = [mockIngredientDatabase[1]]; // Sugar
      mockInvoke.mockResolvedValue(searchResults);

      const results = await searchIngredients('Sugar');

      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', { query: 'Sugar' });
      expect(results).toHaveLength(1);
      expect(results[0].ingredient.name).toBe('Sugar');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].score).toBe(1);
    });

    test('should handle fuzzy matches', async () => {
      const searchResults = [mockIngredientDatabase[0]]; // All-Purpose Flour
      mockInvoke.mockResolvedValue(searchResults);

      const results = await searchIngredients('flou');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].ingredient.name).toBe('All-Purpose Flour');
      expect(results[0].matchType).toBe('fuzzy');
    });

    test('should return empty array for no matches', async () => {
      mockInvoke.mockResolvedValue([]);

      const results = await searchIngredients('nonexistent ingredient');

      expect(results).toEqual([]);
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const results = await searchIngredients('test');

      expect(results).toEqual([]);
    });

    test('should sort results by score', async () => {
      const searchResults = [
        mockIngredientDatabase.find(ing => ing.name === 'Eggs')!,
        mockIngredientDatabase.find(ing => ing.name === 'All-Purpose Flour')!,
      ];
      mockInvoke.mockResolvedValue(searchResults);

      const results = await searchIngredients('egg');

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });

  describe('findIngredientByName', () => {
    test('should find ingredient by exact name', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const ingredient = await findIngredientByName('Sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
    });

    test('should find ingredient by alias', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const ingredient = await findIngredientByName('white sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });

    test('should return null for non-existent ingredient', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const ingredient = await findIngredientByName('nonexistent');

      expect(ingredient).toBeNull();
    });

    test('should handle case insensitive search', async () => {
      mockInvoke.mockResolvedValue(mockIngredientDatabase);

      const ingredient = await findIngredientByName('SUGAR');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const ingredient = await findIngredientByName('Sugar');

      expect(ingredient).toBeNull();
    });
  });

  describe('autoDetectIngredients', () => {
    test('should add new ingredients and skip existing ones', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockIngredientDatabase) // findIngredientByName for 'Sugar'
        .mockResolvedValueOnce(mockIngredientDatabase) // findIngredientByName for 'New Ingredient'
        .mockResolvedValueOnce(undefined) // saveIngredient for 'New Ingredient'
        .mockResolvedValueOnce(mockIngredientDatabase) // findIngredientByName for 'Another New One'
        .mockResolvedValueOnce(undefined); // saveIngredient for 'Another New One'

      const ingredientNames = ['Sugar', 'New Ingredient', 'Another New One'];

      const newIngredients = await autoDetectIngredients(ingredientNames);

      // Should only add the new ingredients (Sugar already exists)
      expect(newIngredients).toHaveLength(2);
      expect(newIngredients[0].name).toBe('New Ingredient');
      expect(newIngredients[1].name).toBe('Another New One');
    });

    test('should clean ingredient names before processing', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockIngredientDatabase) // findIngredientByName
        .mockResolvedValueOnce(undefined); // saveIngredient

      const ingredientNames = ['2 cups fresh tomatoes, diced'];

      const newIngredients = await autoDetectIngredients(ingredientNames);

      expect(newIngredients).toHaveLength(1);
      expect(newIngredients[0].name).toBe('2 cups fresh tomatoes'); // cleanIngredientName removes ", diced"
    });
  });
});
