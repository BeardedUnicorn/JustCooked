import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { ReImportService } from '../reImportService';
import { ReImportRequest, ReImportProgress, BatchImportStatus } from '@app-types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock logging service
vi.mock('../loggingService', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

const mockInvoke = vi.mocked(invoke);

describe('ReImportService', () => {
  let service: ReImportService;

  beforeEach(() => {
    service = new ReImportService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('startReImport', () => {
    it('should start re-import with valid options', async () => {
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);

      const options = {
        maxRecipes: 10,
        recipeIds: ['recipe1', 'recipe2'],
      };

      const result = await service.startReImport(options);

      expect(result).toBe(mockImportId);
      expect(mockInvoke).toHaveBeenCalledWith('start_re_import', {
        request: {
          maxRecipes: 10,
          recipeIds: ['recipe1', 'recipe2'],
        },
      });
    });

    it('should start re-import without options', async () => {
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);

      const result = await service.startReImport();

      expect(result).toBe(mockImportId);
      expect(mockInvoke).toHaveBeenCalledWith('start_re_import', {
        request: {
          maxRecipes: undefined,
          recipeIds: undefined,
        },
      });
    });

    it('should handle Tauri invoke errors', async () => {
      const errorMessage = 'Backend error';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(service.startReImport()).rejects.toThrow(
        `Failed to start re-import: ${errorMessage}`
      );
    });
  });

  describe('getProgress', () => {
    it('should return null when no import is active', async () => {
      const progress = await service.getProgress();
      expect(progress).toBeNull();
    });

    it('should get progress for active import', async () => {
      const mockProgress: ReImportProgress = {
        status: BatchImportStatus.RE_IMPORTING_RECIPES,
        processedRecipes: 5,
        totalRecipes: 10,
        processedCategories: 0,
        totalCategories: 0,
        successfulImports: 4,
        failedImports: 1,
        skippedRecipes: 0,
        errors: [],
        startTime: '2023-01-01T00:00:00Z',
      };

      // Start an import first
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);
      await service.startReImport();

      // Mock progress response
      mockInvoke.mockResolvedValueOnce(mockProgress);

      const progress = await service.getProgress();
      expect(progress).toEqual(mockProgress);
      expect(mockInvoke).toHaveBeenCalledWith('get_re_import_progress', {
        importId: mockImportId,
      });
    });

    it('should handle progress fetch errors', async () => {
      // Start an import first
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);
      await service.startReImport();

      // Mock error for progress fetch
      mockInvoke.mockRejectedValueOnce(new Error('Progress fetch failed'));

      const progress = await service.getProgress();
      expect(progress).toBeNull();
    });
  });

  describe('cancelReImport', () => {
    it('should cancel active import', async () => {
      // Start an import first
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);
      await service.startReImport();

      // Mock successful cancel
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.cancelReImport();

      expect(mockInvoke).toHaveBeenCalledWith('cancel_re_import', {
        importId: mockImportId,
      });
    });

    it('should throw error when no import is active', async () => {
      await expect(service.cancelReImport()).rejects.toThrow(
        'No re-import operation to cancel'
      );
    });

    it('should handle cancel errors', async () => {
      // Start an import first
      const mockImportId = 'test-import-id';
      mockInvoke.mockResolvedValueOnce(mockImportId);
      await service.startReImport();

      // Mock error for cancel
      const errorMessage = 'Cancel failed';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(service.cancelReImport()).rejects.toThrow(
        `Failed to cancel re-import: ${errorMessage}`
      );
    });
  });

  describe('getReImportableRecipesCount', () => {
    it('should return count of re-importable recipes', async () => {
      const mockCount = 42;
      mockInvoke.mockResolvedValueOnce(mockCount);

      const count = await service.getReImportableRecipesCount();

      expect(count).toBe(mockCount);
      expect(mockInvoke).toHaveBeenCalledWith('get_recipes_with_source_urls_count');
    });

    it('should return 0 on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Database error'));

      const count = await service.getReImportableRecipesCount();

      expect(count).toBe(0);
    });
  });

  describe('addToQueue', () => {
    it('should add re-import task to queue', async () => {
      const mockTaskId = 'task-123';
      const description = 'Re-import all existing recipes';
      const request: ReImportRequest = {
        maxRecipes: 50,
      };

      mockInvoke.mockResolvedValueOnce(mockTaskId);

      const result = await service.addToQueue(description, request);

      expect(result).toBe(mockTaskId);
      expect(mockInvoke).toHaveBeenCalledWith('add_re_import_to_queue', {
        description,
        request,
      });
    });

    it('should handle queue add errors', async () => {
      const errorMessage = 'Queue is full';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      const description = 'Re-import all existing recipes';
      const request: ReImportRequest = {};

      await expect(service.addToQueue(description, request)).rejects.toThrow(
        `Failed to add re-import task to queue: ${errorMessage}`
      );
    });
  });

  describe('Progress Monitoring', () => {
    it('should stop monitoring on PascalCase terminal status from backend', async () => {
      vi.useFakeTimers();
      try {
        const onProgress = vi.fn();
        const terminalProgress: ReImportProgress = {
          status: 'Completed' as any,
          processedRecipes: 10,
          totalRecipes: 10,
          processedCategories: 0,
          totalCategories: 0,
          successfulImports: 10,
          failedImports: 0,
          skippedRecipes: 0,
          errors: [],
          startTime: '2023-01-01T00:00:00Z',
          estimatedTimeRemaining: 0,
        };

        mockInvoke
          .mockResolvedValueOnce('test-import-id') // start_re_import
          .mockResolvedValue(terminalProgress); // get_re_import_progress (polling)

        await service.startReImport({ onProgress });

        await vi.advanceTimersByTimeAsync(1000);
        const callsAfterFirstTick = mockInvoke.mock.calls.filter(
          ([command]) => command === 'get_re_import_progress'
        ).length;
        expect(callsAfterFirstTick).toBe(1);

        await vi.advanceTimersByTimeAsync(3000);
        const callsAfterMoreTicks = mockInvoke.mock.calls.filter(
          ([command]) => command === 'get_re_import_progress'
        ).length;

        expect(callsAfterMoreTicks).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getTaskDescription', () => {
    it('should generate description for all recipes re-import', () => {
      const request: ReImportRequest = {};
      const description = service.getTaskDescription(request);
      expect(description).toBe('Re-import all existing recipes');
    });

    it('should generate description with max recipes limit', () => {
      const request: ReImportRequest = { maxRecipes: 10 };
      const description = service.getTaskDescription(request);
      expect(description).toBe('Re-import all existing recipes (max 10)');
    });

    it('should generate description for specific recipes', () => {
      const request: ReImportRequest = { recipeIds: ['recipe1', 'recipe2', 'recipe3'] };
      const description = service.getTaskDescription(request);
      expect(description).toBe('Re-import 3 specific recipes');
    });

    it('should generate description for single specific recipe', () => {
      const request: ReImportRequest = { recipeIds: ['recipe1'] };
      const description = service.getTaskDescription(request);
      expect(description).toBe('Re-import 1 specific recipe');
    });

    it('should generate description for specific recipes with max limit', () => {
      const request: ReImportRequest = { 
        recipeIds: ['recipe1', 'recipe2'], 
        maxRecipes: 1 
      };
      const description = service.getTaskDescription(request);
      expect(description).toBe('Re-import 2 specific recipes (max 1)');
    });
  });

  describe('utility methods', () => {
    it('should clean up resources', () => {
      // Start an import to set up state
      service.startReImport();
      
      // Cleanup should reset state
      service.cleanup();
      
      // Verify cleanup by checking that no import is active
      expect(service.getProgress()).resolves.toBeNull();
    });
  });
});
