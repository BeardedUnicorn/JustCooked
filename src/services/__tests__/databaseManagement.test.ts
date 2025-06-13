import { DatabaseManagementService } from '../databaseManagement';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { DatabaseExport, DatabaseImportResult } from '@app-types';

// Mock Tauri APIs
jest.mock('@tauri-apps/api/core');
jest.mock('@tauri-apps/plugin-dialog');
jest.mock('@tauri-apps/plugin-fs');

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;
const mockSave = save as jest.MockedFunction<typeof save>;
const mockOpen = open as jest.MockedFunction<typeof open>;
const mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;
const mockReadTextFile = readTextFile as jest.MockedFunction<typeof readTextFile>;

describe('DatabaseManagementService', () => {
  let service: DatabaseManagementService;

  beforeEach(() => {
    service = new DatabaseManagementService();
    jest.clearAllMocks();
  });

  describe('exportDatabase', () => {
    it('exports database successfully', async () => {
      const mockExportData: DatabaseExport = {
        version: '1.0',
        export_date: '2023-01-01T00:00:00Z',
        recipes: [],
        ingredients: [],
        pantry_items: [],
        recipe_collections: [],
        recent_searches: [],
        raw_ingredients: [],
      };

      mockInvoke.mockResolvedValue(mockExportData);
      mockSave.mockResolvedValue('/path/to/export.json');
      mockWriteTextFile.mockResolvedValue();

      await service.exportDatabase();

      expect(mockInvoke).toHaveBeenCalledWith('db_export_database');
      expect(mockSave).toHaveBeenCalledWith({
        title: 'Export Database',
        defaultPath: expect.stringMatching(/justcooked-backup-\d{4}-\d{2}-\d{2}\.json/),
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      expect(mockWriteTextFile).toHaveBeenCalledWith('/path/to/export.json', JSON.stringify(mockExportData, null, 2));
    });

    it('throws error when export is cancelled', async () => {
      mockInvoke.mockResolvedValue({});
      mockSave.mockResolvedValue(null);

      await expect(service.exportDatabase()).rejects.toThrow('Export cancelled by user');
    });

    it('throws error when backend export fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Backend error'));

      await expect(service.exportDatabase()).rejects.toThrow('Backend error');
    });
  });

  describe('importDatabase', () => {
    it('imports database successfully with merge option', async () => {
      const mockImportData: DatabaseExport = {
        version: '1.0',
        export_date: '2023-01-01T00:00:00Z',
        recipes: [],
        ingredients: [],
        pantry_items: [],
        recipe_collections: [],
        recent_searches: [],
        raw_ingredients: [],
      };

      const mockResult: DatabaseImportResult = {
        recipes_imported: 5,
        recipes_failed: 0,
        ingredients_imported: 10,
        ingredients_failed: 0,
        pantry_items_imported: 3,
        pantry_items_failed: 0,
        collections_imported: 2,
        collections_failed: 0,
        searches_imported: 1,
        searches_failed: 0,
        raw_ingredients_imported: 0,
        raw_ingredients_failed: 0,
        errors: [],
      };

      mockOpen.mockResolvedValue('/path/to/import.json');
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockImportData));
      mockInvoke.mockResolvedValue(mockResult);

      const result = await service.importDatabase(false);

      expect(mockOpen).toHaveBeenCalledWith({
        title: 'Import Database',
        multiple: false,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      expect(mockReadTextFile).toHaveBeenCalledWith('/path/to/import.json');
      expect(mockInvoke).toHaveBeenCalledWith('db_import_database', {
        data: mockImportData,
        replaceExisting: false
      });
      expect(result).toEqual(mockResult);
    });

    it('imports database successfully with replace option', async () => {
      const mockImportData: DatabaseExport = {
        version: '1.0',
        export_date: '2023-01-01T00:00:00Z',
        recipes: [],
        ingredients: [],
        pantry_items: [],
        recipe_collections: [],
        recent_searches: [],
        raw_ingredients: [],
      };

      const mockResult: DatabaseImportResult = {
        recipes_imported: 5,
        recipes_failed: 0,
        ingredients_imported: 10,
        ingredients_failed: 0,
        pantry_items_imported: 3,
        pantry_items_failed: 0,
        collections_imported: 2,
        collections_failed: 0,
        searches_imported: 1,
        searches_failed: 0,
        raw_ingredients_imported: 0,
        raw_ingredients_failed: 0,
        errors: [],
      };

      mockOpen.mockResolvedValue('/path/to/import.json');
      mockReadTextFile.mockResolvedValue(JSON.stringify(mockImportData));
      mockInvoke.mockResolvedValue(mockResult);

      const result = await service.importDatabase(true);

      expect(mockInvoke).toHaveBeenCalledWith('db_import_database', {
        data: mockImportData,
        replaceExisting: true
      });
      expect(result).toEqual(mockResult);
    });

    it('throws error when import is cancelled', async () => {
      mockOpen.mockResolvedValue(null);

      await expect(service.importDatabase()).rejects.toThrow('Import cancelled by user');
    });

    it('throws error when file contains invalid JSON', async () => {
      mockOpen.mockResolvedValue('/path/to/import.json');
      mockReadTextFile.mockResolvedValue('invalid json');

      await expect(service.importDatabase()).rejects.toThrow('Invalid JSON file format');
    });

    it('validates import data structure', async () => {
      const invalidData = { invalid: 'data' };

      mockOpen.mockResolvedValue('/path/to/import.json');
      mockReadTextFile.mockResolvedValue(JSON.stringify(invalidData));

      await expect(service.importDatabase()).rejects.toThrow('Invalid import data: missing version');
    });
  });

  describe('resetDatabase', () => {
    it('resets database successfully', async () => {
      mockInvoke.mockResolvedValue();

      await service.resetDatabase();

      expect(mockInvoke).toHaveBeenCalledWith('db_reset_database');
    });

    it('throws error when reset fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Reset failed'));

      await expect(service.resetDatabase()).rejects.toThrow('Reset failed');
    });
  });

  describe('formatImportResult', () => {
    it('formats successful import result', () => {
      const result: DatabaseImportResult = {
        recipes_imported: 5,
        recipes_failed: 0,
        ingredients_imported: 10,
        ingredients_failed: 0,
        pantry_items_imported: 3,
        pantry_items_failed: 0,
        collections_imported: 2,
        collections_failed: 0,
        searches_imported: 1,
        searches_failed: 0,
        raw_ingredients_imported: 0,
        raw_ingredients_failed: 0,
        errors: [],
      };

      const formatted = service.formatImportResult(result);

      expect(formatted).toBe('Successfully imported: 5 recipes, 10 ingredients, 3 pantry items, 2 collections, 1 searches');
    });

    it('formats import result with failures', () => {
      const result: DatabaseImportResult = {
        recipes_imported: 5,
        recipes_failed: 2,
        ingredients_imported: 10,
        ingredients_failed: 1,
        pantry_items_imported: 3,
        pantry_items_failed: 0,
        collections_imported: 2,
        collections_failed: 0,
        searches_imported: 1,
        searches_failed: 0,
        raw_ingredients_imported: 0,
        raw_ingredients_failed: 0,
        errors: [],
      };

      const formatted = service.formatImportResult(result);

      expect(formatted).toBe('Successfully imported: 5 recipes, 10 ingredients, 3 pantry items, 2 collections, 1 searches\n3 items failed to import');
    });

    it('formats empty import result', () => {
      const result: DatabaseImportResult = {
        recipes_imported: 0,
        recipes_failed: 0,
        ingredients_imported: 0,
        ingredients_failed: 0,
        pantry_items_imported: 0,
        pantry_items_failed: 0,
        collections_imported: 0,
        collections_failed: 0,
        searches_imported: 0,
        searches_failed: 0,
        raw_ingredients_imported: 0,
        raw_ingredients_failed: 0,
        errors: [],
      };

      const formatted = service.formatImportResult(result);

      expect(formatted).toBe('No data was imported');
    });
  });
});
