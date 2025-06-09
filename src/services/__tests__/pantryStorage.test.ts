import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
  getPantryItemById,
  searchPantryItems,
} from '../pantryStorage';
import { mockPantryItems } from '../../__tests__/fixtures/recipes';

// Mock Tauri invoke
const mockInvoke = jest.fn() as jest.MockedFunction<any>;
jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('pantryStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset crypto.randomUUID mock
    (global.crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid-123');
  });

  describe('getPantryItems', () => {
    test('should return pantry items from database', async () => {
      mockInvoke.mockResolvedValue(mockPantryItems);

      const items = await getPantryItems();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_pantry_items');
      expect(items).toEqual(mockPantryItems);
    });

    test('should return empty array when database call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const items = await getPantryItems();

      expect(items).toEqual([]);
    });
  });

  describe('addPantryItem', () => {
    test('should add item to pantry', async () => {
      const newItem = {
        name: 'Olive Oil',
        amount: 1,
        unit: 'bottle',
        category: 'oils',
      };

      mockInvoke.mockResolvedValue(undefined);

      await addPantryItem(newItem);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          ...newItem,
          id: 'test-uuid-123',
          dateAdded: expect.any(String),
          dateModified: expect.any(String),
        }),
      });
    });

    test('should handle database save errors', async () => {
      const newItem = {
        name: 'Olive Oil',
        amount: 1,
        unit: 'bottle',
        category: 'oils',
      };

      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(addPantryItem(newItem)).rejects.toThrow('Database error');
    });
  });

  describe('updatePantryItem', () => {
    test('should update existing item', async () => {
      const updatedItem = {
        ...mockPantryItems[0],
        amount: 10,
        unit: 'kg',
      };

      mockInvoke.mockResolvedValue(undefined);

      await updatePantryItem(updatedItem);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          ...updatedItem,
          dateModified: expect.any(String),
        }),
      });
    });

    test('should handle database save errors', async () => {
      const updatedItem = {
        ...mockPantryItems[0],
        amount: 10,
      };

      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(updatePantryItem(updatedItem)).rejects.toThrow('Database error');
    });
  });

  describe('deletePantryItem', () => {
    test('should delete existing item', async () => {
      mockInvoke.mockResolvedValue(true);

      await deletePantryItem(mockPantryItems[0].id);

      expect(mockInvoke).toHaveBeenCalledWith('db_delete_pantry_item', {
        id: mockPantryItems[0].id,
      });
    });

    test('should handle non-existent item', async () => {
      mockInvoke.mockResolvedValue(false);

      await expect(deletePantryItem('non-existent-id')).rejects.toThrow('Pantry item not found');
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(deletePantryItem('some-id')).rejects.toThrow('Failed to delete pantry item');
    });
  });

  describe('getPantryItemById', () => {
    test('should return item when found', async () => {
      mockInvoke.mockResolvedValue(mockPantryItems);

      const item = await getPantryItemById(mockPantryItems[0].id);

      expect(item).toEqual(mockPantryItems[0]);
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_pantry_items');
    });

    test('should return null when item not found', async () => {
      mockInvoke.mockResolvedValue(mockPantryItems);

      const item = await getPantryItemById('non-existent-id');

      expect(item).toBeNull();
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const item = await getPantryItemById('some-id');

      expect(item).toBeNull();
    });
  });

  describe('searchPantryItems', () => {
    test('should search items by name', async () => {
      mockInvoke.mockResolvedValue(mockPantryItems);

      const results = await searchPantryItems('Flour');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Flour');
      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_pantry_items');
    });

    test('should return all items for empty query', async () => {
      mockInvoke.mockResolvedValue(mockPantryItems);

      const results = await searchPantryItems('');

      expect(results).toEqual(mockPantryItems);
    });

    test('should search by location and notes', async () => {
      const itemsWithLocation = [
        { ...mockPantryItems[0], location: 'pantry' },
        { ...mockPantryItems[1], notes: 'organic sugar' },
      ];
      mockInvoke.mockResolvedValue(itemsWithLocation);

      const results = await searchPantryItems('pantry');

      expect(results).toHaveLength(1);
      expect(results[0].location).toBe('pantry');
    });

    test('should handle database errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const results = await searchPantryItems('test');

      expect(results).toEqual([]);
    });
  });
});
