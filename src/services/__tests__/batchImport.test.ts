import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { BatchImportService, batchImportService } from '@services/batchImport';
import { BatchImportStatus, BatchImportProgress } from '@app-types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

// Mock recipe storage
vi.mock('@services/recipeStorage', () => ({
  getExistingRecipeUrls: vi.fn(() => Promise.resolve([])),
}));

// Mock logging service
vi.mock('@services/loggingService', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  })),
}));

describe('BatchImportService', () => {
  let service: BatchImportService;

  beforeEach(() => {
    service = new BatchImportService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('startBatchImport', () => {
    test('should start batch import with valid AllRecipes URL', async () => {
      const mockImportId = 'test-import-123';
      mockInvoke.mockResolvedValueOnce(mockImportId);

      const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
      const importId = await service.startBatchImport(startUrl);

      expect(importId).toBe(mockImportId);
      expect(mockInvoke).toHaveBeenCalledWith('start_batch_import', {
        request: {
          startUrl,
          maxRecipes: undefined,
          maxDepth: undefined,
          existingUrls: [],
        },
      });
    });

    test('should start batch import with options', async () => {
      const mockImportId = 'test-import-456';
      mockInvoke.mockResolvedValueOnce(mockImportId);

      const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
      const options = {
        maxRecipes: 50,
        maxDepth: 2,
      };

      const importId = await service.startBatchImport(startUrl, options);

      expect(importId).toBe(mockImportId);
      expect(mockInvoke).toHaveBeenCalledWith('start_batch_import', {
        request: {
          startUrl,
          maxRecipes: 50,
          maxDepth: 2,
          existingUrls: [],
        },
      });
    });

    test('should reject invalid URLs', async () => {
      const invalidUrls = [
        'https://example.com/recipes',
        'https://foodnetwork.com/recipes',
        'not-a-url',
        'https://allrecipes.com/recipe/123/individual-recipe',
      ];

      for (const url of invalidUrls) {
        await expect(service.startBatchImport(url)).rejects.toThrow(
          'Invalid AllRecipes URL'
        );
      }

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should handle Tauri invoke errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Backend error'));

      const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';

      await expect(service.startBatchImport(startUrl)).rejects.toThrow(
        'Failed to start batch import: Backend error'
      );
    });

    test('should cancel existing import before starting new one', async () => {
      const firstImportId = 'import-1';
      const secondImportId = 'import-2';
      
      mockInvoke
        .mockResolvedValueOnce(firstImportId)
        .mockResolvedValueOnce(undefined) // cancel response
        .mockResolvedValueOnce(secondImportId);

      const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';

      // Start first import
      await service.startBatchImport(startUrl);
      expect(service.getCurrentImportId()).toBe(firstImportId);

      // Start second import (should cancel first)
      await service.startBatchImport(startUrl);
      expect(service.getCurrentImportId()).toBe(secondImportId);

      expect(mockInvoke).toHaveBeenCalledWith('cancel_batch_import', {
        importId: firstImportId,
      });
    });
  });

  describe('getProgress', () => {
    test('should return null when no import is active', async () => {
      const progress = await service.getProgress();
      expect(progress).toBeNull();
    });

    test('should get progress for active import', async () => {
      const mockImportId = 'test-import-123';
      const mockProgress: BatchImportProgress = {
        status: BatchImportStatus.IMPORTING_RECIPES,
        currentUrl: 'https://www.allrecipes.com/recipe/123/test',
        processedRecipes: 5,
        totalRecipes: 20,
        processedCategories: 2,
        totalCategories: 5,
        successfulImports: 4,
        failedImports: 1,
        skippedRecipes: 0,
        errors: [],
        startTime: '2024-01-01T00:00:00Z',
        estimatedTimeRemaining: 300,
      };

      mockInvoke
        .mockResolvedValueOnce(mockImportId)
        .mockResolvedValueOnce(mockProgress);

      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');
      const progress = await service.getProgress();

      expect(progress).toEqual(mockProgress);
      expect(mockInvoke).toHaveBeenCalledWith('get_batch_import_progress', {
        importId: mockImportId,
      });
    });

    test('should handle progress fetch errors', async () => {
      const mockImportId = 'test-import-123';
      mockInvoke
        .mockResolvedValueOnce(mockImportId)
        .mockRejectedValueOnce(new Error('Progress fetch failed'));

      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');
      const progress = await service.getProgress();

      expect(progress).toBeNull();
    });
  });

  describe('cancelBatchImport', () => {
    test('should cancel active import', async () => {
      const mockImportId = 'test-import-123';
      mockInvoke
        .mockResolvedValueOnce(mockImportId)
        .mockResolvedValueOnce(undefined);

      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');
      await service.cancelBatchImport();

      expect(mockInvoke).toHaveBeenCalledWith('cancel_batch_import', {
        importId: mockImportId,
      });
      expect(service.getCurrentImportId()).toBeNull();
    });

    test('should do nothing when no import is active', async () => {
      await service.cancelBatchImport();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should handle cancel errors', async () => {
      const mockImportId = 'test-import-123';
      mockInvoke
        .mockResolvedValueOnce(mockImportId)
        .mockRejectedValueOnce(new Error('Cancel failed'));

      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');

      await expect(service.cancelBatchImport()).rejects.toThrow(
        'Failed to cancel batch import: Cancel failed'
      );
    });
  });

  describe('utility methods', () => {
    test('isImportActive should return correct status', async () => {
      expect(service.isImportActive()).toBe(false);

      mockInvoke.mockResolvedValueOnce('test-import-123');
      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');
      
      expect(service.isImportActive()).toBe(true);

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.cancelBatchImport();
      
      expect(service.isImportActive()).toBe(false);
    });

    test('getSuggestedCategoryUrls should return valid suggestions', () => {
      const suggestions = service.getSuggestedCategoryUrls();

      expect(suggestions).toHaveLength(6);
      expect(suggestions[0]).toEqual({
        name: 'Desserts',
        url: 'https://www.allrecipes.com/recipes/79/desserts',
        description: 'All dessert recipes including cakes, cookies, pies, and more',
      });

      // Verify all URLs are valid AllRecipes category URLs
      suggestions.forEach(suggestion => {
        expect(suggestion.url).toMatch(/^https:\/\/www\.allrecipes\.com\/recipes\//);
        expect(suggestion.url).not.toMatch(/\/recipe\//);
      });
    });

    test('getPopularCategoryUrls should return popular category URLs', () => {
      const popularUrls = service.getPopularCategoryUrls();

      expect(popularUrls.length).toBeGreaterThan(0);

      // Verify all URLs are valid AllRecipes category URLs
      popularUrls.forEach(url => {
        expect(url).toMatch(/^https:\/\/www\.allrecipes\.com\/recipes\//);
        expect(url).not.toMatch(/\/recipe\//);
      });

      // Verify specific URLs from the requirements
      expect(popularUrls).toContain('https://www.allrecipes.com/recipes/17057/everyday-cooking/more-meal-ideas/5-ingredients/main-dishes/');
      expect(popularUrls).toContain('https://www.allrecipes.com/recipes/15436/everyday-cooking/one-pot-meals/');
      expect(popularUrls).toContain('https://www.allrecipes.com/recipes/79/desserts/');
      expect(popularUrls).toContain('https://www.allrecipes.com/recipes/85/holidays-and-events/');
    });

    test('estimateImportTime should provide reasonable estimates', () => {
      const estimates = [
        { recipes: 10, expected: { minMinutes: 1, maxMinutes: 1 } },
        { recipes: 100, expected: { minMinutes: 5, maxMinutes: 9 } },
        { recipes: 500, expected: { minMinutes: 25, maxMinutes: 42 } },
      ];

      estimates.forEach(({ recipes, expected }) => {
        const result = service.estimateImportTime(recipes);
        expect(result.minMinutes).toBe(expected.minMinutes);
        expect(result.maxMinutes).toBe(expected.maxMinutes);
        expect(result.description).toBeDefined();
      });
    });
  });

  describe('progress tracking', () => {
    test('should set up progress tracking when onProgress callback is provided', async () => {
      const mockImportId = 'test-import-123';
      const onProgress = vi.fn();

      mockInvoke.mockResolvedValueOnce(mockImportId);

      await service.startBatchImport(
        'https://www.allrecipes.com/recipes/79/desserts',
        { onProgress }
      );

      // Verify that the import was started and tracking is set up
      expect(service.getCurrentImportId()).toBe(mockImportId);
      expect(service.isImportActive()).toBe(true);
    });

    test('should clean up tracking when import is cancelled', async () => {
      const mockImportId = 'test-import-123';

      mockInvoke
        .mockResolvedValueOnce(mockImportId)
        .mockResolvedValueOnce(undefined); // cancel response

      await service.startBatchImport('https://www.allrecipes.com/recipes/79/desserts');
      expect(service.getCurrentImportId()).toBe(mockImportId);

      await service.cancelBatchImport();
      expect(service.getCurrentImportId()).toBeNull();
    });
  });

  describe('singleton instance', () => {
    test('should export singleton instance', () => {
      expect(batchImportService).toBeInstanceOf(BatchImportService);
    });
  });
});
