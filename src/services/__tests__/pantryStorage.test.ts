import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
} from '@services/pantryStorage';
import { mockPantryItems } from '@/__tests__/fixtures/recipes';

// Mock the dependencies
jest.mock('@tauri-apps/plugin-fs');

const mockReadTextFile = readTextFile as jest.MockedFunction<typeof readTextFile>;
const mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockExists = exists as jest.MockedFunction<typeof exists>;

describe('pantryStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPantryItems', () => {
    test('should return pantry items when file exists', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));

      const items = await getPantryItems();

      expect(items).toEqual(mockPantryItems);
      expect(mockReadTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should return empty array when file does not exist', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist

      const items = await getPantryItems();

      expect(items).toEqual([]);
    });

    test('should create directory if it does not exist', async () => {
      mockExists.mockResolvedValueOnce(false); // Directory doesn't exist
      mockMkdir.mockResolvedValue();
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist

      const items = await getPantryItems();

      expect(mockMkdir).toHaveBeenCalledWith('pantry', {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      });
      expect(items).toEqual([]);
    });

    test('should handle file read errors gracefully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockRejectedValue(new Error('Read error'));

      const items = await getPantryItems();

      expect(items).toEqual([]);
    });

    test('should handle corrupted JSON gracefully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue('invalid json');

      const items = await getPantryItems();

      expect(items).toEqual([]);
    });
  });

  describe('addPantryItem', () => {
    test('should add item to empty pantry', async () => {
      const newItem = {
        id: 'new-item',
        name: 'Olive Oil',
        amount: 1,
        unit: 'bottle',
        category: 'oils',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await addPantryItem(newItem);

      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify([newItem], null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should add item to existing pantry', async () => {
      const newItem = {
        id: 'new-item',
        name: 'Olive Oil',
        amount: 1,
        unit: 'bottle',
        category: 'oils',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await addPantryItem(newItem);

      const expectedItems = [...mockPantryItems, newItem];
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify(expectedItems, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should handle file system errors', async () => {
      const newItem = {
        id: 'new-item',
        name: 'Olive Oil',
        amount: 1,
        unit: 'bottle',
        category: 'oils',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockRejectedValue(new Error('Write error'));

      await expect(addPantryItem(newItem)).rejects.toThrow('Write error');
    });
  });

  describe('updatePantryItem', () => {
    test('should update existing item', async () => {
      const updatedItem = {
        ...mockPantryItems[0],
        amount: 10,
        unit: 'kg',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await updatePantryItem(updatedItem);

      const expectedItems = [updatedItem, mockPantryItems[1]];
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify(expectedItems, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should handle non-existent item gracefully', async () => {
      const nonExistentItem = {
        id: 'non-existent',
        name: 'Non-existent',
        amount: 1,
        unit: 'unit',
        category: 'other',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));

      await updatePantryItem(nonExistentItem);

      // Should not call writeTextFile since item was not found
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });

    test('should handle empty pantry', async () => {
      const updatedItem = {
        id: 'some-id',
        name: 'Some Item',
        amount: 1,
        unit: 'unit',
        category: 'other',
      };

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist

      await updatePantryItem(updatedItem);

      // Should not call writeTextFile since item was not found in empty pantry
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });
  });

  describe('deletePantryItem', () => {
    test('should delete existing item', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await deletePantryItem(mockPantryItems[0].id);

      const expectedItems = [mockPantryItems[1]]; // Only second item remains
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify(expectedItems, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should handle non-existent item gracefully', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockPantryItems));
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await deletePantryItem('non-existent-id');

      // Should save original items unchanged
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify(mockPantryItems, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should handle empty pantry', async () => {
      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(false); // Pantry file doesn't exist
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await deletePantryItem('some-id');

      // Should save empty array (deletePantryItem always saves the filtered result)
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify([], null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });

    test('should delete all items with same ID', async () => {
      const duplicateItems = [
        ...mockPantryItems,
        { ...mockPantryItems[0], name: 'Duplicate Flour' }, // Same ID as first item
      ];

      mockExists.mockResolvedValueOnce(true); // Directory exists (for getPantryItems)
      mockExists.mockResolvedValueOnce(true); // Pantry file exists
      mockReadTextFile.mockResolvedValue(JSON.stringify(duplicateItems));
      mockExists.mockResolvedValueOnce(true); // Directory exists (for savePantryItems)
      mockWriteTextFile.mockResolvedValue();

      await deletePantryItem(mockPantryItems[0].id);

      const expectedItems = [mockPantryItems[1]]; // Only second item remains (both items with same ID are removed)
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        'pantry/items.json',
        JSON.stringify(expectedItems, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      );
    });
  });
});
