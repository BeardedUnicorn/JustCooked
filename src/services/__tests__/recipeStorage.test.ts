import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  exists,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import {
  saveRecipe,
  getAllRecipes,
  getRecipeById,
  deleteRecipe,
} from '../recipeStorage';
import { deleteRecipeImage } from '../imageService';
import { mockRecipe } from '../../__tests__/fixtures/recipes';

// Mock the dependencies
jest.mock('@tauri-apps/plugin-fs');
jest.mock('../imageService');

const mockReadTextFile = readTextFile as jest.MockedFunction<typeof readTextFile>;
const mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockRemove = remove as jest.MockedFunction<typeof remove>;
const mockExists = exists as jest.MockedFunction<typeof exists>;
const mockDeleteRecipeImage = deleteRecipeImage as jest.MockedFunction<typeof deleteRecipeImage>;

describe('recipeStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveRecipe', () => {
    test('should save a new recipe successfully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(false); // Index doesn't exist
      mockWriteTextFile.mockResolvedValue();

      await saveRecipe(mockRecipe);

      // Should write the recipe file
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        `recipes/${mockRecipe.id}.json`,
        JSON.stringify(mockRecipe, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );

      // Should create/update the index
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'recipes/index.json',
        expect.stringContaining(mockRecipe.id),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should create directory if it does not exist', async () => {
      mockExists.mockResolvedValueOnce(false); // Directory doesn't exist
      mockMkdir.mockResolvedValue();
      mockExists.mockResolvedValueOnce(false); // Index doesn't exist
      mockWriteTextFile.mockResolvedValue();

      await saveRecipe(mockRecipe);

      expect(mockMkdir).toHaveBeenCalledWith('recipes', {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      });
    });

    test('should update existing recipe in index', async () => {
      const existingIndex = [
        {
          id: mockRecipe.id,
          title: 'Old Title',
          image: 'old-image.jpg',
          tags: ['old-tag'],
          dateAdded: mockRecipe.dateAdded,
          dateModified: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Index exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(existingIndex));
      mockWriteTextFile.mockResolvedValue();

      await saveRecipe(mockRecipe);

      // Should update the existing recipe in index
      const indexCall = mockWriteTextFile.mock.calls.find(call => 
        call[0] === 'recipes/index.json'
      );
      expect(indexCall).toBeDefined();
      
      const savedIndex = JSON.parse(indexCall![1] as string);
      expect(savedIndex).toHaveLength(1);
      expect(savedIndex[0].title).toBe(mockRecipe.title);
      expect(savedIndex[0].id).toBe(mockRecipe.id);
    });

    test('should handle file system errors', async () => {
      mockExists.mockResolvedValueOnce(true);
      mockWriteTextFile.mockRejectedValue(new Error('File system error'));

      await expect(saveRecipe(mockRecipe)).rejects.toThrow('Failed to save recipe: Error: File system error');
    });
  });

  describe('getAllRecipes', () => {
    test('should return all recipes when index exists', async () => {
      const indexData = [
        {
          id: 'recipe-1',
          title: 'Recipe 1',
          image: 'image1.jpg',
          tags: ['tag1'],
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Index exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(indexData));
      
      // Mock recipe file exists and content
      mockExists.mockResolvedValueOnce(true);
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockRecipe));

      const recipes = await getAllRecipes();

      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(mockRecipe);
    });

    test('should return empty array when index does not exist', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(false); // Index doesn't exist

      const recipes = await getAllRecipes();

      expect(recipes).toEqual([]);
    });

    test('should filter out recipes with missing files', async () => {
      const indexData = [
        { id: 'recipe-1', title: 'Recipe 1', image: '', tags: [], dateAdded: '', dateModified: '' },
        { id: 'recipe-2', title: 'Recipe 2', image: '', tags: [], dateAdded: '', dateModified: '' },
      ];

      mockExists.mockResolvedValueOnce(true); // Directory exists (ensureDirectory)
      mockExists.mockResolvedValueOnce(true); // Index exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(indexData));

      // First recipe file exists, second doesn't
      mockExists.mockResolvedValueOnce(true);
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockRecipe));
      mockExists.mockResolvedValueOnce(false);

      // Mock the index update write
      mockWriteTextFile.mockResolvedValueOnce();

      const recipes = await getAllRecipes();

      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(mockRecipe);
    });

    test('should handle corrupted index gracefully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Index exists
      mockReadTextFile.mockResolvedValueOnce('invalid json');

      const recipes = await getAllRecipes();

      expect(recipes).toEqual([]);
    });
  });

  describe('getRecipeById', () => {
    test('should return recipe when it exists', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Recipe file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockRecipe));

      const recipe = await getRecipeById(mockRecipe.id);

      expect(recipe).toEqual(mockRecipe);
      expect(mockReadTextFile).toHaveBeenCalledWith(
        `recipes/${mockRecipe.id}.json`,
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should return null when recipe does not exist', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(false); // Recipe file doesn't exist

      const recipe = await getRecipeById('non-existent-id');

      expect(recipe).toBeNull();
    });

    test('should handle file read errors', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Recipe file exists
      mockReadTextFile.mockRejectedValue(new Error('Read error'));

      const recipe = await getRecipeById(mockRecipe.id);

      expect(recipe).toBeNull();
    });

    test('should handle corrupted recipe file', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Recipe file exists
      mockReadTextFile.mockResolvedValue('invalid json');

      const recipe = await getRecipeById(mockRecipe.id);

      expect(recipe).toBeNull();
    });
  });

  describe('deleteRecipe', () => {
    test('should delete recipe and update index', async () => {
      const otherRecipe = {
        id: 'other-recipe',
        title: 'Other Recipe',
        image: 'other.jpg',
        tags: [],
        dateAdded: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-01T00:00:00.000Z',
        description: '',
        sourceUrl: '',
        prepTime: '',
        cookTime: '',
        totalTime: '',
        servings: 4,
        ingredients: [],
        instructions: [],
      };

      // Mock getRecipeById call
      mockExists.mockResolvedValueOnce(true); // Directory exists (ensureDirectory)
      mockExists.mockResolvedValueOnce(true); // Recipe file exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockRecipe));

      // Mock deleteRecipeImage
      mockDeleteRecipeImage.mockResolvedValue();

      // Mock file deletion
      mockExists.mockResolvedValueOnce(true); // Recipe file exists for deletion
      mockRemove.mockResolvedValue();

      // Mock getAllRecipes call (for index update)
      mockExists.mockResolvedValueOnce(true); // Directory exists (ensureDirectory)
      mockExists.mockResolvedValueOnce(true); // Index exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify([
        { id: mockRecipe.id, title: mockRecipe.title, image: mockRecipe.image, tags: mockRecipe.tags, dateAdded: mockRecipe.dateAdded, dateModified: mockRecipe.dateModified },
        { id: 'other-recipe', title: 'Other Recipe', image: 'other.jpg', tags: [], dateAdded: '2024-01-01T00:00:00.000Z', dateModified: '2024-01-01T00:00:00.000Z' }
      ]));

      // Mock recipe file reads for getAllRecipes
      mockExists.mockResolvedValueOnce(true); // First recipe file exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockRecipe));
      mockExists.mockResolvedValueOnce(true); // Second recipe file exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(otherRecipe));

      // Mock final index write
      mockWriteTextFile.mockResolvedValue();

      await deleteRecipe(mockRecipe.id);

      // Should delete the recipe file
      expect(mockRemove).toHaveBeenCalledWith(
        `recipes/${mockRecipe.id}.json`,
        { baseDir: BaseDirectory.AppLocalData }
      );

      // Should delete the recipe image
      expect(mockDeleteRecipeImage).toHaveBeenCalledWith(mockRecipe.image);
    });

    test('should handle non-existent recipe gracefully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(false); // Recipe file doesn't exist

      await expect(deleteRecipe('non-existent-id')).resolves.not.toThrow();
    });

    test('should handle file deletion errors', async () => {
      // Mock getRecipeById call
      mockExists.mockResolvedValueOnce(true); // Directory exists (ensureDirectory)
      mockExists.mockResolvedValueOnce(true); // Recipe file exists
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockRecipe));

      // Mock deleteRecipeImage success
      mockDeleteRecipeImage.mockResolvedValue();

      // Mock file deletion failure
      mockExists.mockResolvedValueOnce(true); // Recipe file exists for deletion
      mockRemove.mockRejectedValue(new Error('File deletion failed'));

      // Should throw error when file deletion fails
      await expect(deleteRecipe(mockRecipe.id)).rejects.toThrow('Failed to delete recipe');
    });
  });
});
