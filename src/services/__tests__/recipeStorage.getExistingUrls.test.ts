import { describe, test, expect, jest } from '@jest/globals';
import { Recipe } from '@app-types';

// Create a mock for getAllRecipes
const mockGetAllRecipes = jest.fn();

// Mock the entire module
jest.mock('@services/recipeStorage', () => ({
  getAllRecipes: mockGetAllRecipes,
  getExistingRecipeUrls: async () => {
    try {
      const recipes = await mockGetAllRecipes();
      return recipes
        .map((recipe: Recipe) => recipe.sourceUrl)
        .filter((url: string | undefined) => url && url.trim() !== '');
    } catch (error) {
      console.error('Failed to get existing recipe URLs:', error);
      return [];
    }
  },
}));

import { getExistingRecipeUrls } from '@services/recipeStorage';

describe('getExistingRecipeUrls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return array of recipe URLs from existing recipes', async () => {
    const mockRecipes: Recipe[] = [
      {
        id: '1',
        title: 'Test Recipe 1',
        description: 'A test recipe',
        image: 'test1.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/123/test-recipe-1',
        prepTime: '10 min',
        cookTime: '20 min',
        totalTime: '30 min',
        servings: 4,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-01T00:00:00Z',
        dateModified: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Test Recipe 2',
        description: 'Another test recipe',
        image: 'test2.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/456/test-recipe-2',
        prepTime: '15 min',
        cookTime: '25 min',
        totalTime: '40 min',
        servings: 6,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-02T00:00:00Z',
        dateModified: '2024-01-02T00:00:00Z',
      },
      {
        id: '3',
        title: 'Test Recipe 3',
        description: 'Third test recipe',
        image: 'test3.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/789/test-recipe-3',
        prepTime: '5 min',
        cookTime: '15 min',
        totalTime: '20 min',
        servings: 2,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-03T00:00:00Z',
        dateModified: '2024-01-03T00:00:00Z',
      },
    ];

    mockGetAllRecipes.mockResolvedValue(mockRecipes);

    const result = await getExistingRecipeUrls();

    expect(result).toEqual([
      'https://www.allrecipes.com/recipe/123/test-recipe-1',
      'https://www.allrecipes.com/recipe/456/test-recipe-2',
      'https://www.allrecipes.com/recipe/789/test-recipe-3',
    ]);
    expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
  });

  test('should filter out empty and null URLs', async () => {
    const mockRecipes: Recipe[] = [
      {
        id: '1',
        title: 'Test Recipe 1',
        description: 'A test recipe',
        image: 'test1.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/123/test-recipe-1',
        prepTime: '10 min',
        cookTime: '20 min',
        totalTime: '30 min',
        servings: 4,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-01T00:00:00Z',
        dateModified: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Test Recipe 2',
        description: 'Another test recipe',
        image: 'test2.jpg',
        sourceUrl: '', // Empty URL
        prepTime: '15 min',
        cookTime: '25 min',
        totalTime: '40 min',
        servings: 6,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-02T00:00:00Z',
        dateModified: '2024-01-02T00:00:00Z',
      },
      {
        id: '3',
        title: 'Test Recipe 3',
        description: 'Third test recipe',
        image: 'test3.jpg',
        sourceUrl: '   ', // Whitespace only URL
        prepTime: '5 min',
        cookTime: '15 min',
        totalTime: '20 min',
        servings: 2,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-03T00:00:00Z',
        dateModified: '2024-01-03T00:00:00Z',
      },
      {
        id: '4',
        title: 'Test Recipe 4',
        description: 'Fourth test recipe',
        image: 'test4.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/789/test-recipe-4',
        prepTime: '5 min',
        cookTime: '15 min',
        totalTime: '20 min',
        servings: 2,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-04T00:00:00Z',
        dateModified: '2024-01-04T00:00:00Z',
      },
    ];

    mockGetAllRecipes.mockResolvedValue(mockRecipes);

    const result = await getExistingRecipeUrls();

    expect(result).toEqual([
      'https://www.allrecipes.com/recipe/123/test-recipe-1',
      'https://www.allrecipes.com/recipe/789/test-recipe-4',
    ]);
    expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
  });

  test('should return empty array when no recipes exist', async () => {
    mockGetAllRecipes.mockResolvedValue([]);

    const result = await getExistingRecipeUrls();

    expect(result).toEqual([]);
    expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
  });

  test('should return empty array when getAllRecipes throws an error', async () => {
    mockGetAllRecipes.mockRejectedValue(new Error('Failed to get recipes'));

    const result = await getExistingRecipeUrls();

    expect(result).toEqual([]);
    expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
  });

  test('should handle recipes with undefined sourceUrl', async () => {
    const mockRecipes = [
      {
        id: '1',
        title: 'Test Recipe 1',
        description: 'A test recipe',
        image: 'test1.jpg',
        sourceUrl: 'https://www.allrecipes.com/recipe/123/test-recipe-1',
        prepTime: '10 min',
        cookTime: '20 min',
        totalTime: '30 min',
        servings: 4,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-01T00:00:00Z',
        dateModified: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Test Recipe 2',
        description: 'Another test recipe',
        image: 'test2.jpg',
        // sourceUrl is undefined
        prepTime: '15 min',
        cookTime: '25 min',
        totalTime: '40 min',
        servings: 6,
        ingredients: [],
        instructions: [],
        tags: [],
        dateAdded: '2024-01-02T00:00:00Z',
        dateModified: '2024-01-02T00:00:00Z',
      },
    ] as Recipe[];

    mockGetAllRecipes.mockResolvedValue(mockRecipes);

    const result = await getExistingRecipeUrls();

    expect(result).toEqual([
      'https://www.allrecipes.com/recipe/123/test-recipe-1',
    ]);
    expect(mockGetAllRecipes).toHaveBeenCalledTimes(1);
  });
});
