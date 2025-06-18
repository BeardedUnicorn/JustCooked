import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  getAllCollections,
  getCollectionById,
  saveCollection,
  deleteCollection,
  createCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
} from '../recipeCollectionStorage';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const mockCollections = [
  {
    id: 'collection-1',
    name: 'Favorites',
    description: 'My favorite recipes',
    recipeIds: ['recipe-1', 'recipe-2'],
    dateCreated: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'collection-2',
    name: 'Quick Meals',
    description: 'Fast and easy recipes',
    recipeIds: ['recipe-3'],
    dateCreated: '2024-01-02T00:00:00.000Z',
    dateModified: '2024-01-02T00:00:00.000Z',
  },
];

describe('recipeCollectionStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset crypto.randomUUID mock
    vi.mocked(global.crypto.randomUUID).mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
  });

  describe('getAllCollections', () => {
    test('should return all collections from database', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      const collections = await getAllCollections();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_recipe_collections');
      expect(collections).toEqual(mockCollections);
    });

    test('should return empty array when database call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const collections = await getAllCollections();

      expect(collections).toEqual([]);
    });
  });

  describe('getCollectionById', () => {
    test('should return collection when found', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      const collection = await getCollectionById('collection-1');

      expect(collection).toEqual(mockCollections[0]);
    });

    test('should return null when collection not found', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      const collection = await getCollectionById('non-existent');

      expect(collection).toBeNull();
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const collection = await getCollectionById('collection-1');

      expect(collection).toBeNull();
    });
  });

  describe('saveCollection', () => {
    test('should save collection to database', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await saveCollection(mockCollections[0]);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe_collection', {
        collection: expect.objectContaining({
          ...mockCollections[0],
          dateModified: expect.any(String),
        }),
      });
    });

    test('should handle database save errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(saveCollection(mockCollections[0])).rejects.toThrow('Failed to save collection');
    });
  });

  describe('deleteCollection', () => {
    test('should delete existing collection', async () => {
      mockInvoke.mockResolvedValue(true);

      await deleteCollection('collection-1');

      expect(mockInvoke).toHaveBeenCalledWith('db_delete_recipe_collection', { id: 'collection-1' });
    });

    test('should handle non-existent collection', async () => {
      mockInvoke.mockResolvedValue(false);

      await expect(deleteCollection('non-existent')).rejects.toThrow('Collection not found');
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(deleteCollection('collection-1')).rejects.toThrow('Failed to delete collection');
    });
  });

  describe('createCollection', () => {
    test('should create new collection', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const collection = await createCollection('New Collection', 'Description');

      expect(collection).toEqual({
        id: 'test-uuid-123',
        name: 'New Collection',
        description: 'Description',
        recipeIds: [],
        dateCreated: expect.any(String),
        dateModified: expect.any(String),
      });

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe_collection', {
        collection: collection,
      });
    });

    test('should handle database save errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(createCollection('Test')).rejects.toThrow('Failed to create collection');
    });
  });

  describe('addRecipeToCollection', () => {
    test('should add recipe to collection', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockCollections) // getCollectionById call
        .mockResolvedValueOnce(undefined); // saveCollection call

      await addRecipeToCollection('collection-1', 'recipe-3');

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe_collection', {
        collection: expect.objectContaining({
          recipeIds: ['recipe-1', 'recipe-2', 'recipe-3'],
        }),
      });
    });

    test('should not add duplicate recipe', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      await addRecipeToCollection('collection-1', 'recipe-1');

      // Should not call save since recipe already exists
      expect(mockInvoke).toHaveBeenCalledTimes(1); // Only the getCollectionById call
    });

    test('should handle non-existent collection', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      await expect(addRecipeToCollection('non-existent', 'recipe-1')).resolves.toBeUndefined();
    });
  });

  describe('removeRecipeFromCollection', () => {
    test('should remove recipe from collection', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockCollections) // getCollectionById call
        .mockResolvedValueOnce(undefined); // saveCollection call

      await removeRecipeFromCollection('collection-1', 'recipe-1');

      expect(mockInvoke).toHaveBeenCalledWith('db_save_recipe_collection', {
        collection: expect.objectContaining({
          recipeIds: expect.arrayContaining(['recipe-2']),
        }),
      });
      
      // Verify that recipe-1 was removed
      const saveCall = mockInvoke.mock.calls.find((call: any) => call[0] === 'db_save_recipe_collection');
      expect(saveCall).toBeDefined();
      expect((saveCall as any)[1].collection.recipeIds).not.toContain('recipe-1');
    });

    test('should handle non-existent collection', async () => {
      mockInvoke.mockResolvedValue(mockCollections);

      await expect(removeRecipeFromCollection('non-existent', 'recipe-1')).resolves.toBeUndefined();
    });
  });
});
