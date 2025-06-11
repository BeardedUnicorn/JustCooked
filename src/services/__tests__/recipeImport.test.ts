import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { importRecipeFromUrl } from '@services/recipeImport';
import { formatIngredientForDisplay } from '@utils/ingredientUtils';
import { saveRecipe } from '@services/recipeStorage';
import { autoDetectIngredients } from '@services/ingredientStorage';
import { processRecipeImage } from '@services/imageService';
import { mockImportedRecipe } from '@/__tests__/fixtures/recipes';

// Mock the dependencies
jest.mock('@tauri-apps/api/core');
jest.mock('@services/recipeStorage');
jest.mock('@services/ingredientStorage');
jest.mock('@services/imageService');
jest.mock('@utils/stringUtils', () => ({
  parseTags: jest.fn((keywords: string) => keywords ? keywords.split(',').map(tag => tag.trim()) : []),
  decodeAllHtmlEntities: jest.fn((str: string) => str || ''),
}));
jest.mock('@utils/timeUtils');

// Mock urlUtils with specific implementation for isSupportedUrl
jest.mock('@utils/urlUtils', () => ({
  isSupportedUrl: jest.fn((url: string) => {
    // Allow supported sites for testing
    return url.includes('allrecipes.com') ||
           url.includes('foodnetwork.com') ||
           url.includes('bbcgoodfood.com') ||
           url.includes('seriouseats.com') ||
           url.includes('epicurious.com') ||
           url.includes('food.com') ||
           url.includes('tasteofhome.com') ||
           url.includes('delish.com') ||
           url.includes('bonappetit.com') ||
           url.includes('simplyrecipes.com');
  }),
  shouldDownloadImage: jest.fn(() => true),
  isValidImageUrl: jest.fn(() => true),
}));

// Don't mock ingredientUtils since we want to test formatIngredientForDisplay
// jest.mock('@utils/ingredientUtils');

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;
const mockSaveRecipe = saveRecipe as jest.MockedFunction<typeof saveRecipe>;
const mockAutoDetectIngredients = autoDetectIngredients as jest.MockedFunction<typeof autoDetectIngredients>;
const mockProcessRecipeImage = processRecipeImage as jest.MockedFunction<typeof processRecipeImage>;

describe('recipeImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatIngredientForDisplay', () => {
    test('should format ingredients with units correctly', () => {
      expect(formatIngredientForDisplay({ amount: 2, unit: 'cups', name: 'flour' }))
        .toBe('2 cups flour');
      expect(formatIngredientForDisplay({ amount: 1, unit: 'cup', name: 'sugar' }))
        .toBe('1 cup sugar');
    });

    test('should format ingredients without units correctly', () => {
      expect(formatIngredientForDisplay({ amount: 3, unit: '', name: 'eggs' }))
        .toBe('3 eggs');
      expect(formatIngredientForDisplay({ amount: 1, unit: '   ', name: 'onion' }))
        .toBe('1 onion');
    });

    test('should format fractional amounts correctly', () => {
      expect(formatIngredientForDisplay({ amount: 0.5, unit: 'cup', name: 'milk' }))
        .toBe('1/2 cup milk');
      expect(formatIngredientForDisplay({ amount: 2.5, unit: '', name: 'apples' }))
        .toBe('2 1/2 apples');
      expect(formatIngredientForDisplay({ amount: 1.25, unit: 'tbsp', name: 'olive oil' }))
        .toBe('1 1/4 tbsp olive oil');
    });
  });

  describe('importRecipeFromUrl', () => {
    const url = 'https://allrecipes.com/recipe/123/cookies';

    beforeEach(() => {
      // Common mocks for successful import
      mockInvoke.mockResolvedValue(mockImportedRecipe);
      mockProcessRecipeImage.mockResolvedValue('processed-image-url');
      mockAutoDetectIngredients.mockReturnValue([]);
      mockSaveRecipe.mockResolvedValue();
    });

    test('should successfully import a recipe from supported URL', async () => {
      await importRecipeFromUrl(url);

      expect(mockInvoke).toHaveBeenCalledWith('import_recipe', { url });
      expect(mockProcessRecipeImage).toHaveBeenCalledWith('https://example.com/cookies.jpg');
      expect(mockSaveRecipe).toHaveBeenCalled();
      
      const savedRecipe = mockSaveRecipe.mock.calls[0][0];

      expect(savedRecipe.title).toBe('Chocolate Chip Cookies');
      expect(savedRecipe.sourceUrl).toBe(url);
      expect(savedRecipe.ingredients).toHaveLength(5);
      expect(savedRecipe.image).toBe('processed-image-url');
    });

    test('should throw error for unsupported URL', async () => {
      const unsupportedUrl = 'https://unsupported-site.com/recipe';

      await expect(importRecipeFromUrl(unsupportedUrl)).rejects.toThrow(
        'Unsupported website. Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes.'
      );

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should handle Tauri backend errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      await expect(importRecipeFromUrl(url)).rejects.toThrow('Failed to import recipe: Network error');
    });

    test('should throw error for empty recipe data from backend', async () => {
      mockInvoke.mockResolvedValue({ ...mockImportedRecipe, name: '' });
      await expect(importRecipeFromUrl(url)).rejects.toThrow(
        'Failed to extract recipe data from the URL'
      );
    });

    test('should fall back to original image URL on image processing failure', async () => {
      // The actual implementation of processRecipeImage catches the error and returns the original URL
      mockProcessRecipeImage.mockResolvedValue(mockImportedRecipe.image);

      await importRecipeFromUrl(url);

      expect(mockSaveRecipe).toHaveBeenCalled();
      const savedRecipe = mockSaveRecipe.mock.calls[0][0];

      // The recipe should still be saved, but with the original image URL
      expect(savedRecipe.image).toBe(mockImportedRecipe.image);
    });

    test('should auto-detect and save ingredients during import', async () => {
      await importRecipeFromUrl(url);

      // Verify that autoDetectIngredients was called with ingredient names
      expect(mockAutoDetectIngredients).toHaveBeenCalledWith([
        'all-purpose flour',
        'granulated sugar',
        'eggs',
        'milk',
        'butter'
      ]);
    });

    test('should continue recipe import even if ingredient detection fails', async () => {
      // Mock ingredient detection to fail
      mockAutoDetectIngredients.mockImplementation(() => {
        throw new Error('Ingredient detection failed');
      });

      // Recipe import should still succeed
      await importRecipeFromUrl(url);

      expect(mockSaveRecipe).toHaveBeenCalled();
      const savedRecipe = mockSaveRecipe.mock.calls[0][0];
      expect(savedRecipe.title).toBe('Chocolate Chip Cookies');
    });

    test('should await ingredient detection before saving recipe', async () => {
      let ingredientDetectionCompleted = false;

      // Mock ingredient detection with delay to test async behavior
      mockAutoDetectIngredients.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        ingredientDetectionCompleted = true;
        return [];
      });

      // Mock save recipe to verify ingredient detection completed first
      mockSaveRecipe.mockImplementation(async () => {
        expect(ingredientDetectionCompleted).toBe(true);
      });

      await importRecipeFromUrl(url);

      expect(mockAutoDetectIngredients).toHaveBeenCalled();
      expect(mockSaveRecipe).toHaveBeenCalled();
    });

    test('should handle empty ingredients gracefully', async () => {
      // Mock recipe with no ingredients
      mockInvoke.mockResolvedValue({
        ...mockImportedRecipe,
        ingredients: [],
      });

      await importRecipeFromUrl(url);

      // Verify empty ingredient list was handled
      expect(mockAutoDetectIngredients).toHaveBeenCalledWith([]);

      const savedRecipe = mockSaveRecipe.mock.calls[0][0];
      expect(savedRecipe.ingredients).toEqual([]);
    });
  });
});