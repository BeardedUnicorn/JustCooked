import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
} from '../pantryStorage';
import { PantryItem } from '@app-types';

// Mock Tauri invoke
const mockInvoke = vi.fn() as vi.MockedFunction<any>;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

// Mock time utils
vi.mock('@utils/timeUtils', () => ({
  getCurrentTimestamp: () => '2024-01-01T00:00:00.000Z',
}));

describe('Pantry Storage Bug Fix Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addPantryItem', () => {
    test('should add pantry item with correct data structure', async () => {
      // Mock successful save
      mockInvoke.mockResolvedValueOnce(undefined);

      const newItem = {
        name: 'Test Item',
        amount: 2.5,
        unit: 'cups',
        category: 'baking',
        expiryDate: '2024-12-31',
        location: 'pantry',
        notes: 'test notes',
      };

      await addPantryItem(newItem);

      // Verify the Tauri command was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          id: expect.any(String),
          name: 'Test Item',
          amount: 2.5,
          unit: 'cups',
          category: 'baking',
          expiryDate: '2024-12-31',
          location: 'pantry',
          notes: 'test notes',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        }),
      });
    });

    test('should handle minimal pantry item data', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const minimalItem = {
        name: 'Minimal Item',
        amount: 1,
        unit: 'piece',
      };

      await addPantryItem(minimalItem);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          id: expect.any(String),
          name: 'Minimal Item',
          amount: 1,
          unit: 'piece',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        }),
      });
    });

    test('should handle product information correctly', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const productItem = {
        name: 'Product Item',
        amount: 1,
        unit: 'package',
        productCode: '123456789012',
        productName: 'Test Product',
        brands: 'Test Brand',
      };

      await addPantryItem(productItem);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          name: 'Product Item',
          productCode: '123456789012',
          productName: 'Test Product',
          brands: 'Test Brand',
        }),
      });
    });
  });

  describe('getPantryItems', () => {
    test('should retrieve pantry items with correct data structure', async () => {
      const mockItems: PantryItem[] = [
        {
          id: 'item-1',
          name: 'Test Item 1',
          amount: 2,
          unit: 'cups',
          category: 'baking',
          expiryDate: '2024-12-31',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'item-2',
          name: 'Test Item 2',
          amount: 1,
          unit: 'package',
          productCode: '123456789012',
          productName: 'Test Product',
          brands: 'Test Brand',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockInvoke.mockResolvedValueOnce(mockItems);

      const result = await getPantryItems();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_pantry_items');
      expect(result).toEqual(mockItems);
    });

    test('should handle empty pantry', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      const result = await getPantryItems();

      expect(result).toEqual([]);
    });

    test('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Database error'));

      const result = await getPantryItems();

      expect(result).toEqual([]);
    });
  });

  describe('updatePantryItem', () => {
    test('should update pantry item with correct timestamp', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const updatedItem: PantryItem = {
        id: 'item-1',
        name: 'Updated Item',
        amount: 3,
        unit: 'cups',
        category: 'baking',
        dateAdded: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-01T00:00:00.000Z', // This should be updated
      };

      await updatePantryItem(updatedItem);

      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          id: 'item-1',
          name: 'Updated Item',
          amount: 3,
          unit: 'cups',
          category: 'baking',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z', // Should be updated by the function
        }),
      });
    });
  });

  describe('deletePantryItem', () => {
    test('should delete pantry item successfully', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      await deletePantryItem('item-1');

      expect(mockInvoke).toHaveBeenCalledWith('db_delete_pantry_item', {
        id: 'item-1',
      });
    });

    test('should handle item not found', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      await expect(deletePantryItem('nonexistent')).rejects.toThrow('Pantry item not found');
    });
  });

  describe('Integration Test - Add and Retrieve Flow', () => {
    test('should add item and then retrieve it successfully', async () => {
      // Mock add operation
      mockInvoke.mockResolvedValueOnce(undefined);

      const newItem = {
        name: 'Integration Test Item',
        amount: 1.5,
        unit: 'lbs',
        category: 'produce',
      };

      await addPantryItem(newItem);

      // Verify add was called correctly
      expect(mockInvoke).toHaveBeenCalledWith('db_save_pantry_item', {
        item: expect.objectContaining({
          name: 'Integration Test Item',
          amount: 1.5,
          unit: 'lbs',
          category: 'produce',
        }),
      });

      // Mock retrieve operation
      const mockRetrievedItems: PantryItem[] = [
        {
          id: 'generated-id',
          name: 'Integration Test Item',
          amount: 1.5,
          unit: 'lbs',
          category: 'produce',
          dateAdded: '2024-01-01T00:00:00.000Z',
          dateModified: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockInvoke.mockResolvedValueOnce(mockRetrievedItems);

      const retrievedItems = await getPantryItems();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_pantry_items');
      expect(retrievedItems).toHaveLength(1);
      expect(retrievedItems[0]).toMatchObject({
        name: 'Integration Test Item',
        amount: 1.5,
        unit: 'lbs',
        category: 'produce',
      });
    });
  });
});
