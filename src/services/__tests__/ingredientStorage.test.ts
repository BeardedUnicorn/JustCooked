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
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('ingredientStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset crypto.randomUUID mock
    vi.mocked(global.crypto.randomUUID).mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
  });

  describe('loadIngredients', () => {
    test('should load ingredients from database', async () => {
      // Mock the backend format (snake_case) that Tauri returns
      const mockTauriIngredients = mockIngredientDatabase.map(ing => ({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        aliases: ing.aliases,
        date_added: ing.dateAdded, // Convert to snake_case for backend format
        date_modified: ing.dateModified, // Convert to snake_case for backend format
      }));

      mockInvoke.mockResolvedValue(mockTauriIngredients);

      const ingredients = await loadIngredients();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
      expect(ingredients).toEqual(mockIngredientDatabase); // Should convert back to frontend format
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

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.name).toBe('Tomato');
      expect(result.category).toBe('vegetables');
      expect(result.aliases).toEqual(['tomatoes', 'fresh tomato']);
      expect(result.dateAdded).toBeDefined();
      expect(result.dateModified).toBeDefined();
      // Check that the correct format (snake_case) is sent to Tauri
      expect(mockInvoke).toHaveBeenCalledWith('db_save_ingredient', {
        ingredient: expect.objectContaining({
          id: result.id,
          name: result.name,
          category: result.category,
          aliases: result.aliases,
          date_added: result.dateAdded, // Should be snake_case
          date_modified: result.dateModified, // Should be snake_case
        })
      });
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
    // Helper function to create mock Tauri format
    const createMockTauriIngredients = () => mockIngredientDatabase.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      aliases: ing.aliases,
      date_added: ing.dateAdded,
      date_modified: ing.dateModified,
    }));

    test('should update existing ingredient', async () => {
      mockInvoke
        .mockResolvedValueOnce(createMockTauriIngredients()) // loadIngredients call
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
      expect(mockInvoke).toHaveBeenCalledWith('db_save_ingredient', { ingredient: expect.objectContaining({
        id: result!.id,
        name: result!.name,
        category: result!.category,
        aliases: result!.aliases,
        date_added: result!.dateAdded,
        date_modified: result!.dateModified,
      }) });
    });

    test('should handle non-existent ingredient', async () => {
      mockInvoke.mockResolvedValue(createMockTauriIngredients());

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
      // Mock the backend format (snake_case) that Tauri returns
      const mockTauriResult = [{
        id: mockIngredientDatabase[1].id,
        name: mockIngredientDatabase[1].name,
        category: mockIngredientDatabase[1].category,
        aliases: mockIngredientDatabase[1].aliases,
        date_added: mockIngredientDatabase[1].dateAdded,
        date_modified: mockIngredientDatabase[1].dateModified,
      }];
      mockInvoke.mockResolvedValue(mockTauriResult);

      const results = await searchIngredients('Sugar');

      expect(mockInvoke).toHaveBeenCalledWith('db_search_ingredients', { query: 'Sugar' });
      expect(results).toHaveLength(1);
      expect(results[0].ingredient.name).toBe('Sugar');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].score).toBe(1);
    });

    test('should handle fuzzy matches', async () => {
      // Mock the backend format (snake_case) that Tauri returns
      const mockTauriResult = [{
        id: mockIngredientDatabase[0].id,
        name: mockIngredientDatabase[0].name,
        category: mockIngredientDatabase[0].category,
        aliases: mockIngredientDatabase[0].aliases,
        date_added: mockIngredientDatabase[0].dateAdded,
        date_modified: mockIngredientDatabase[0].dateModified,
      }];
      mockInvoke.mockResolvedValue(mockTauriResult);

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
      // Mock the backend format (snake_case) that Tauri returns
      const mockTauriResults = [
        mockIngredientDatabase.find(ing => ing.name === 'Eggs')!,
        mockIngredientDatabase.find(ing => ing.name === 'All-Purpose Flour')!,
      ].map(ing => ({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        aliases: ing.aliases,
        date_added: ing.dateAdded,
        date_modified: ing.dateModified,
      }));
      mockInvoke.mockResolvedValue(mockTauriResults);

      const results = await searchIngredients('egg');

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });

  describe('findIngredientByName', () => {
    // Helper function to create mock Tauri format
    const createMockTauriIngredients = () => mockIngredientDatabase.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      aliases: ing.aliases,
      date_added: ing.dateAdded,
      date_modified: ing.dateModified,
    }));

    test('should find ingredient by exact name', async () => {
      mockInvoke.mockResolvedValue(createMockTauriIngredients());

      const ingredient = await findIngredientByName('Sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_ingredients');
    });

    test('should find ingredient by alias', async () => {
      mockInvoke.mockResolvedValue(createMockTauriIngredients());

      const ingredient = await findIngredientByName('white sugar');

      expect(ingredient).toBeDefined();
      expect(ingredient!.name).toBe('Sugar');
    });

    test('should return null for non-existent ingredient', async () => {
      mockInvoke.mockResolvedValue(createMockTauriIngredients());

      const ingredient = await findIngredientByName('nonexistent');

      expect(ingredient).toBeNull();
    });

    test('should handle case insensitive search', async () => {
      mockInvoke.mockResolvedValue(createMockTauriIngredients());

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
    // Helper function to create mock Tauri format
    const createMockTauriIngredients = () => mockIngredientDatabase.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      aliases: ing.aliases,
      date_added: ing.dateAdded,
      date_modified: ing.dateModified,
    }));

    test('should add new ingredients and skip existing ones', async () => {
      mockInvoke
        .mockResolvedValueOnce(createMockTauriIngredients()) // findIngredientByName for 'Sugar'
        .mockResolvedValueOnce(createMockTauriIngredients()) // findIngredientByName for 'New Ingredient'
        .mockResolvedValueOnce(undefined) // saveIngredient for 'New Ingredient'
        .mockResolvedValueOnce(createMockTauriIngredients()) // findIngredientByName for 'Another New One'
        .mockResolvedValueOnce(undefined); // saveIngredient for 'Another New One'

      const ingredientNames = ['Sugar', 'New Ingredient', 'Another New One'];

      const newIngredients = await autoDetectIngredients(ingredientNames);

      // Should only add the new ingredients (Sugar already exists)
      expect(newIngredients).toHaveLength(2);
      expect(newIngredients[0].name).toBe('new ingredient');
      expect(newIngredients[1].name).toBe('another new one');
    });

    test('should canonicalize parsed ingredients before saving them to the catalog', async () => {
      mockInvoke
        .mockResolvedValueOnce(createMockTauriIngredients()) // findIngredientByName
        .mockResolvedValueOnce(undefined) // saveIngredient for 1% milk
        .mockResolvedValueOnce(createMockTauriIngredients()) // findIngredientByName
        .mockResolvedValueOnce(undefined); // saveIngredient for onion

      const ingredientNames = [
        { name: '0.33333334326744 cup 1% milk', amount: 0.33333334326744, unit: 'cup' },
        { name: '&nbsp;1 medium onion, finely chopped', amount: 1, unit: '' },
        { name: '* Raw egg is not recommended for the elderly', amount: 1, unit: '' },
      ];

      const newIngredients = await autoDetectIngredients(ingredientNames);

      expect(newIngredients).toHaveLength(2);
      expect(newIngredients[0].name).toBe('1% milk');
      expect(newIngredients[1].name).toBe('onion');
    });
  });
});
