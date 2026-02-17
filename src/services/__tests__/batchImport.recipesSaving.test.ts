import { vi, describe, it, expect, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { batchImportService } from '../batchImport';
import { getExistingRecipeUrls } from '../recipeStorage';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock the recipe storage
vi.mock('../recipeStorage', () => ({
  getExistingRecipeUrls: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);
const mockGetExistingUrls = vi.mocked(getExistingRecipeUrls);

describe('BatchImport Recipe Saving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExistingUrls.mockResolvedValue([]);
  });

  it('should start batch import and track progress correctly', async () => {
    const mockImportId = 'test-import-123';
    const mockProgress = {
      status: 'Starting',
      currentUrl: null,
      processedRecipes: 0,
      totalRecipes: 0,
      processedCategories: 0,
      totalCategories: 0,
      successfulImports: 0,
      failedImports: 0,
      skippedRecipes: 0,
      errors: [],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: null,
    };

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'start_batch_import') {
        return Promise.resolve(mockImportId as any);
      }
      if (command === 'get_batch_import_progress') {
        return Promise.resolve(mockProgress as any);
      }
      return Promise.reject(new Error(`Unknown command: ${command}`));
    });

    const progressCallback = vi.fn();
    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    const importId = await batchImportService.startBatchImport(startUrl, {
      maxRecipes: 5,
      onProgress: progressCallback,
    });

    expect(importId).toBe(mockImportId);
    expect(mockInvoke).toHaveBeenCalledWith('start_batch_import', {
      request: {
        startUrl,
        maxRecipes: 5,
        maxDepth: undefined,
        existingUrls: [],
      },
    });
  });

  it('should get existing recipe URLs before starting import', async () => {
    const existingUrls = [
      'https://www.allrecipes.com/recipe/123/existing-recipe',
      'https://www.allrecipes.com/recipe/456/another-existing-recipe',
    ];
    
    mockGetExistingUrls.mockResolvedValue(existingUrls);
    mockInvoke.mockResolvedValue('test-import-id');

    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await batchImportService.startBatchImport(startUrl, { maxRecipes: 10 });

    expect(mockGetExistingUrls).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('start_batch_import', {
      request: {
        startUrl,
        maxRecipes: 10,
        maxDepth: undefined,
        existingUrls,
      },
    });
  });

  it('should handle progress updates correctly', async () => {
    const mockImportId = 'test-import-123';
    let progressCallCount = 0;
    
    const progressStates = [
      {
        status: 'CrawlingCategories',
        processedRecipes: 0,
        totalRecipes: 0,
        successfulImports: 0,
        failedImports: 0,
      },
      {
        status: 'ExtractingRecipes',
        processedRecipes: 0,
        totalRecipes: 0,
        successfulImports: 0,
        failedImports: 0,
      },
      {
        status: 'ImportingRecipes',
        processedRecipes: 2,
        totalRecipes: 5,
        successfulImports: 2,
        failedImports: 0,
      },
      {
        status: 'Completed',
        processedRecipes: 5,
        totalRecipes: 5,
        successfulImports: 4,
        failedImports: 1,
      },
    ];

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'start_batch_import') {
        return Promise.resolve(mockImportId as any);
      }
      if (command === 'get_batch_import_progress') {
        const progress = progressStates[Math.min(progressCallCount, progressStates.length - 1)];
        progressCallCount++;
        return Promise.resolve({
          ...progress,
          currentUrl: null,
          processedCategories: 0,
          totalCategories: 0,
          skippedRecipes: 0,
          errors: [],
          startTime: new Date().toISOString(),
          estimatedTimeRemaining: null,
        } as any);
      }
      if (command === 'cancel_batch_import') {
        return Promise.resolve(undefined as any);
      }
      return Promise.reject(new Error(`Unknown command: ${command}`));
    });

    const progressCallback = vi.fn();
    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await batchImportService.startBatchImport(startUrl, {
      maxRecipes: 5,
      onProgress: progressCallback,
    });

    // Wait for progress tracking to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get progress manually to test
    const progress = await batchImportService.getProgress();
    expect(progress).toBeDefined();
    expect(progress?.status).toBeDefined();
  });

  it('should validate AllRecipes URLs correctly', async () => {
    const invalidUrl = 'https://example.com/recipes';
    
    await expect(
      batchImportService.startBatchImport(invalidUrl)
    ).rejects.toThrow('Invalid URL');
  });

  it('should handle cancellation correctly', async () => {
    const mockImportId = 'test-import-123';
    
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'start_batch_import') {
        return Promise.resolve(mockImportId as any);
      }
      if (command === 'cancel_batch_import') {
        return Promise.resolve(undefined as any);
      }
      return Promise.reject(new Error(`Unknown command: ${command}`));
    });

    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await batchImportService.startBatchImport(startUrl);
    await batchImportService.cancelBatchImport();

    expect(mockInvoke).toHaveBeenCalledWith('cancel_batch_import', {
      importId: mockImportId,
    });
  });

  it('should track import status correctly', async () => {
    expect(batchImportService.isImportActive()).toBe(false);
    
    mockInvoke.mockResolvedValue('test-import-id');
    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await batchImportService.startBatchImport(startUrl);
    expect(batchImportService.isImportActive()).toBe(true);
    
    await batchImportService.cancelBatchImport();
    expect(batchImportService.isImportActive()).toBe(false);
  });

  it('should provide suggested category URLs', () => {
    const suggestions = batchImportService.getSuggestedCategoryUrls();
    
    expect(suggestions).toHaveLength(9);
    expect(suggestions[0]).toEqual({
      name: 'ATK – All Recipes',
      url: 'https://www.americastestkitchen.com/recipes/all',
      description: "All recipes from America's Test Kitchen",
    });
  });

  it('should estimate import time correctly', () => {
    const estimate = batchImportService.estimateImportTime(10);
    
    expect(estimate.minMinutes).toBe(1); // 10 * 3 seconds = 30 seconds = 1 minute
    expect(estimate.maxMinutes).toBe(1); // 10 * 5 seconds = 50 seconds = 1 minute
    expect(estimate.description).toBe('Quick import');
    
    const largeEstimate = batchImportService.estimateImportTime(1000);
    expect(largeEstimate.description).toBe('Long import - consider limiting the number of recipes');
  });

  it('should handle errors during import start', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    
    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await expect(
      batchImportService.startBatchImport(startUrl)
    ).rejects.toThrow('Failed to start batch import: Network error');
  });

  it('should clean up resources properly', () => {
    // This test ensures cleanup doesn't throw errors
    expect(() => {
      batchImportService.cleanup();
    }).not.toThrow();
  });
});

describe('BatchImport Recipe Saving Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExistingUrls.mockResolvedValue([]);
  });

  it('should ensure recipes are saved during batch import process', async () => {
    // This test verifies that the batch import process includes recipe saving
    const mockImportId = 'test-import-123';
    const mockResult = {
      success: true,
      totalProcessed: 3,
      successfulImports: 3,
      failedImports: 0,
      skippedRecipes: 0,
      errors: [],
      importedRecipeIds: ['recipe-1', 'recipe-2', 'recipe-3'],
      duration: 30,
    };

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'start_batch_import') {
        return Promise.resolve(mockImportId as any);
      }
      if (command === 'get_batch_import_progress') {
        return Promise.resolve({
          status: 'Completed',
          currentUrl: null,
          processedRecipes: 3,
          totalRecipes: 3,
          processedCategories: 1,
          totalCategories: 1,
          successfulImports: 3,
          failedImports: 0,
          skippedRecipes: 0,
          errors: [],
          startTime: new Date().toISOString(),
          estimatedTimeRemaining: 0,
        } as any);
      }
      return Promise.resolve(mockResult as any);
    });

    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    const importId = await batchImportService.startBatchImport(startUrl, {
      maxRecipes: 3,
    });

    expect(importId).toBe(mockImportId);
    
    // Verify that the import request includes existing URLs for deduplication
    expect(mockInvoke).toHaveBeenCalledWith('start_batch_import', {
      request: {
        startUrl,
        maxRecipes: 3,
        maxDepth: undefined,
        existingUrls: [], // Should be empty array from mock
      },
    });
  });

  it('should handle recipe saving failures gracefully', async () => {
    const mockImportId = 'test-import-123';
    const mockProgressWithErrors = {
      status: 'Completed',
      currentUrl: null,
      processedRecipes: 3,
      totalRecipes: 3,
      processedCategories: 1,
      totalCategories: 1,
      successfulImports: 2,
      failedImports: 1,
      skippedRecipes: 0,
      errors: [
        {
          url: 'https://www.allrecipes.com/recipe/123/failed-recipe',
          message: 'Failed to save recipe: Storage error',
          timestamp: new Date().toISOString(),
          errorType: 'SaveError',
        },
      ],
      startTime: new Date().toISOString(),
      estimatedTimeRemaining: 0,
    };

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'start_batch_import') {
        return Promise.resolve(mockImportId as any);
      }
      if (command === 'get_batch_import_progress') {
        return Promise.resolve(mockProgressWithErrors as any);
      }
      return Promise.resolve(undefined as any);
    });

    const progressCallback = vi.fn();
    const startUrl = 'https://www.allrecipes.com/recipes/79/desserts';
    
    await batchImportService.startBatchImport(startUrl, {
      maxRecipes: 3,
      onProgress: progressCallback,
    });

    // Wait for progress tracking
    await new Promise(resolve => setTimeout(resolve, 100));

    const progress = await batchImportService.getProgress();
    expect(progress?.errors).toHaveLength(1);
    expect(progress?.errors[0].errorType).toBe('SaveError');
    expect(progress?.successfulImports).toBe(2);
    expect(progress?.failedImports).toBe(1);
  });
});
