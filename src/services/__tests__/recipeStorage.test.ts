import { Recipe } from '../../types';
import * as recipeStorage from '../recipeStorage';

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke as jest.MockedFunction<typeof import('@tauri-apps/api/core').invoke>;

// Mock the image service
jest.mock('@services/imageService', () => ({
  deleteRecipeImage: jest.fn(),
}));

// Mock the time utils
jest.mock('@utils/timeUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2024-01-15T10:30:00.000Z'),
}));

describe('recipeStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRecipe: Recipe = {
    id: 'test-recipe-123',
    title: 'Chocolate Chip Cookies',
    description: 'Delicious homemade chocolate chip cookies',
    image: 'https://example.com/cookies.jpg',
    sourceUrl: 'https://allrecipes.com/recipe/123/cookies',
    prepTime: 'PT15M',
    cookTime: 'PT12M',
    totalTime: 'PT27M',
    servings: 24,
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cups' },
      { name: 'sugar', amount: 1, unit: 'cup' },
      { name: 'eggs', amount: 3, unit: '' },
      { name: 'milk', amount: 0.5, unit: 'cup' },
      { name: 'butter', amount: 0.25, unit: 'cup' },
    ],
    instructions: [
      'Preheat oven to 375°F',
      'Mix dry ingredients in a bowl',
      'Add wet ingredients and mix until combined',
      'Drop spoonfuls onto baking sheet',
      'Bake for 10-12 minutes until golden brown',
    ],
    tags: ['dessert', 'cookies', 'baking'],
    dateAdded: '2024-01-15T10:30:00.000Z',
    dateModified: '2024-01-15T10:30:00.000Z',
    rating: undefined,
    difficulty: undefined,
    isFavorite: undefined,
    personalNotes: undefined,
    collections: [],
    nutritionalInfo: undefined,
  };

  const mockTauriRecipe = {
    id: 'test-recipe-123',
    title: 'Chocolate Chip Cookies',
    description: 'Delicious homemade chocolate chip cookies',
    image: 'https://example.com/cookies.jpg',
    source_url: 'https://allrecipes.com/recipe/123/cookies',
    prep_time: 'PT15M',
    cook_time: 'PT12M',
    total_time: 'PT27M',
    servings: 24,
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cups' },
      { name: 'sugar', amount: 1, unit: 'cup' },
      { name: 'eggs', amount: 3, unit: '' },
      { name: 'milk', amount: 0.5, unit: 'cup' },
      { name: 'butter', amount: 0.25, unit: 'cup' },
    ],
    instructions: [
      'Preheat oven to 375°F',
      'Mix dry ingredients in a bowl',
      'Add wet ingredients and mix until combined',
      'Drop spoonfuls onto baking sheet',
      'Bake for 10-12 minutes until golden brown',
    ],
    tags: ['dessert', 'cookies', 'baking'],
    date_added: '2024-01-15T10:30:00.000Z',
    date_modified: '2024-01-15T10:30:00.000Z',
    rating: undefined,
    difficulty: undefined,
    is_favorite: undefined,
    personal_notes: undefined,
    collections: [],
    nutritional_info: undefined,
  };

  describe('saveRecipe', () => {
    it('should save a new recipe successfully', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await recipeStorage.saveRecipe(mockRecipe);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe', {
        recipe: {
          id: mockRecipe.id,
          title: mockRecipe.title,
          description: mockRecipe.description,
          image: mockRecipe.image,
          source_url: mockRecipe.sourceUrl,
          prep_time: mockRecipe.prepTime,
          cook_time: mockRecipe.cookTime,
          total_time: mockRecipe.totalTime,
          servings: mockRecipe.servings,
          ingredients: mockRecipe.ingredients,
          instructions: mockRecipe.instructions,
          tags: mockRecipe.tags,
          date_added: mockRecipe.dateAdded,
          date_modified: mockRecipe.dateModified,
          rating: mockRecipe.rating,
          difficulty: mockRecipe.difficulty,
          is_favorite: mockRecipe.isFavorite,
          personal_notes: mockRecipe.personalNotes,
          collections: mockRecipe.collections,
        },
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockInvoke.mockRejectedValue(error);

      await expect(recipeStorage.saveRecipe(mockRecipe)).rejects.toThrow(
        'Failed to save recipe: Error: Database error'
      );
    });
  });

  describe('getAllRecipes', () => {
    it('should return all recipes from database', async () => {
      mockInvoke.mockResolvedValue([mockTauriRecipe]);

      const recipes = await recipeStorage.getAllRecipes();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_recipes');
      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(mockRecipe);
    });

    it('should return empty array when database is empty', async () => {
      mockInvoke.mockResolvedValue([]);

      const recipes = await recipeStorage.getAllRecipes();

      expect(recipes).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const recipes = await recipeStorage.getAllRecipes();

      expect(recipes).toHaveLength(0);
    });
  });

  describe('getRecipeById', () => {
    it('should return recipe when it exists', async () => {
      mockInvoke.mockResolvedValue(mockTauriRecipe);

      const recipe = await recipeStorage.getRecipeById('test-recipe-123');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recipe_by_id', { id: 'test-recipe-123' });
      expect(recipe).toEqual(mockRecipe);
    });

    it('should return null when recipe does not exist', async () => {
      mockInvoke.mockResolvedValue(null);

      const recipe = await recipeStorage.getRecipeById('non-existent');

      expect(recipe).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const recipe = await recipeStorage.getRecipeById('test-recipe-123');

      expect(recipe).toBeNull();
    });
  });

  describe('updateRecipe', () => {
    it('should update recipe with new dateModified', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await recipeStorage.updateRecipe(mockRecipe);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe', {
        recipe: expect.objectContaining({
          id: mockRecipe.id,
          date_modified: '2024-01-15T10:30:00.000Z',
        }),
      });
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe successfully', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockTauriRecipe) // getRecipeById
        .mockResolvedValueOnce(true); // db_delete_recipe

      await recipeStorage.deleteRecipe('test-recipe-123');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recipe_by_id', { id: 'test-recipe-123' });
      expect(mockInvoke).toHaveBeenCalledWith('db_delete_recipe', { id: 'test-recipe-123' });
    });

    it('should handle non-existent recipe', async () => {
      mockInvoke
        .mockResolvedValueOnce(null) // getRecipeById
        .mockResolvedValueOnce(false); // db_delete_recipe

      await expect(recipeStorage.deleteRecipe('non-existent')).rejects.toThrow(
        'Failed to delete recipe'
      );
    });

    it('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(recipeStorage.deleteRecipe('test-recipe-123')).rejects.toThrow(
        'Failed to delete recipe'
      );
    });
  });

  describe('getExistingRecipeUrls', () => {
    it('should return existing recipe URLs', async () => {
      const urls = ['https://example.com/recipe1', 'https://example.com/recipe2'];
      mockInvoke.mockResolvedValue(urls);

      const result = await recipeStorage.getExistingRecipeUrls();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_existing_recipe_urls');
      expect(result).toEqual(urls);
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const result = await recipeStorage.getExistingRecipeUrls();

      expect(result).toEqual([]);
    });
  });

  describe('searchRecipes', () => {
    it('should search recipes by query', async () => {
      mockInvoke.mockResolvedValue([mockTauriRecipe]);

      const recipes = await recipeStorage.searchRecipes('chocolate');

      expect(mockInvoke).toHaveBeenCalledWith('db_search_recipes', { query: 'chocolate' });
      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(mockRecipe);
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const recipes = await recipeStorage.searchRecipes('chocolate');

      expect(recipes).toEqual([]);
    });
  });

  describe('getRecipesByTag', () => {
    it('should get recipes by tag', async () => {
      mockInvoke.mockResolvedValue([mockTauriRecipe]);

      const recipes = await recipeStorage.getRecipesByTag('dessert');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_recipes_by_tag', { tag: 'dessert' });
      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(mockRecipe);
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const recipes = await recipeStorage.getRecipesByTag('dessert');

      expect(recipes).toEqual([]);
    });
  });

  describe('getFavoriteRecipes', () => {
    it('should get favorite recipes', async () => {
      const favoriteRecipe = { ...mockTauriRecipe, is_favorite: true };
      mockInvoke.mockResolvedValue([favoriteRecipe]);

      const recipes = await recipeStorage.getFavoriteRecipes();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_favorite_recipes');
      expect(recipes).toHaveLength(1);
      expect(recipes[0].isFavorite).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const recipes = await recipeStorage.getFavoriteRecipes();

      expect(recipes).toEqual([]);
    });
  });

  describe('migrateJsonRecipes', () => {
    it('should migrate JSON recipes to database', async () => {
      mockInvoke.mockResolvedValue(5);

      const count = await recipeStorage.migrateJsonRecipes();

      expect(mockInvoke).toHaveBeenCalledWith('db_migrate_json_recipes');
      expect(count).toBe(5);
    });

    it('should handle migration errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Migration error'));

      const count = await recipeStorage.migrateJsonRecipes();

      expect(count).toBe(0);
    });
  });
});
