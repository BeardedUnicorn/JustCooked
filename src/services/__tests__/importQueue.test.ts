import { invoke } from '@tauri-apps/api/core';
import { ImportQueueService } from '../importQueue';
import { BatchImportRequest, ImportQueueStatus, ImportQueueTask } from '@app-types';
import { getExistingRecipeUrls } from '../recipeStorage';

// Mock Tauri API
jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock recipe storage
jest.mock('../recipeStorage');
const mockGetExistingRecipeUrls = getExistingRecipeUrls as jest.MockedFunction<typeof getExistingRecipeUrls>;

// Mock logging service
jest.mock('../loggingService', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('ImportQueueService', () => {
  let queueService: ImportQueueService;

  const mockBatchRequest: BatchImportRequest = {
    startUrl: 'https://allrecipes.com/recipes/desserts/',
    maxRecipes: 10,
    maxDepth: 2,
    existingUrls: ['https://allrecipes.com/recipe/123/existing'],
  };

  const mockQueueTask: ImportQueueTask = {
    id: 'task-123',
    description: 'Import dessert recipes',
    request: mockBatchRequest,
    status: 'pending',
    progress: null,
    addedAt: '2024-01-01T00:00:00Z',
    startedAt: null,
    completedAt: null,
    error: null,
    estimatedTimeRemaining: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queueService = new ImportQueueService();
    mockGetExistingRecipeUrls.mockResolvedValue([]);
  });

  describe('Queue Operations', () => {
    it('should add task to queue', async () => {
      mockInvoke.mockResolvedValue('task-123');

      const taskId = await queueService.addToQueue('Test import', mockBatchRequest);

      expect(mockInvoke).toHaveBeenCalledWith('add_to_import_queue', {
        description: 'Test import',
        request: mockBatchRequest,
      });
      expect(taskId).toBe('task-123');
    });

    it('should get queue status', async () => {
      const mockStatus: ImportQueueStatus = {
        tasks: [mockQueueTask],
        isProcessing: false,
        currentTaskId: null,
        totalTasks: 1,
        pendingTasks: 1,
        completedTasks: 0,
        failedTasks: 0,
      };

      mockInvoke.mockResolvedValue(mockStatus);

      const status = await queueService.getQueueStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_import_queue_status');
      expect(status).toEqual(mockStatus);
    });

    it('should remove task from queue', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await queueService.removeFromQueue('task-123');

      expect(mockInvoke).toHaveBeenCalledWith('remove_from_import_queue', { taskId: 'task-123' });
    });

    it('should get task progress', async () => {
      const mockProgress = {
        status: 'running',
        totalUrls: 100,
        processedUrls: 50,
        importedRecipes: 25,
        skippedRecipes: 15,
        failedRecipes: 10,
        errors: [],
        estimatedTimeRemaining: 300,
      };

      mockInvoke.mockResolvedValue(mockProgress);

      const progress = await queueService.getTaskProgress('task-123');

      expect(mockInvoke).toHaveBeenCalledWith('get_queue_task_progress', { taskId: 'task-123' });
      expect(progress).toEqual(mockProgress);
    });

    it('should add multiple tasks to queue', async () => {
      const urls = [
        'https://allrecipes.com/recipes/desserts/',
        'https://allrecipes.com/recipes/main-dish/',
        'https://allrecipes.com/recipes/appetizers/',
      ];

      mockInvoke.mockResolvedValue('task-123');
      mockGetExistingRecipeUrls.mockResolvedValue(['existing-url']);

      const result = await queueService.addMultipleToQueue(urls, { maxRecipes: 50, maxDepth: 2 });

      expect(result.totalAdded).toBe(3);
      expect(result.taskIds).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(mockInvoke).toHaveBeenCalledTimes(3);

      // Verify each call includes the options
      urls.forEach((url, index) => {
        expect(mockInvoke).toHaveBeenNthCalledWith(index + 1, 'add_to_import_queue', {
          description: expect.stringContaining('AllRecipes'),
          request: expect.objectContaining({
            startUrl: url,
            maxRecipes: 50,
            maxDepth: 2,
            existingUrls: ['existing-url'],
          }),
        });
      });
    });

    it('should handle partial failures when adding multiple tasks', async () => {
      const urls = [
        'https://allrecipes.com/recipes/desserts/',
        'https://allrecipes.com/recipes/main-dish/',
        'https://allrecipes.com/recipes/appetizers/',
      ];

      mockInvoke
        .mockResolvedValueOnce('task-1')
        .mockRejectedValueOnce(new Error('Failed to add task'))
        .mockResolvedValueOnce('task-3');

      const result = await queueService.addMultipleToQueue(urls);

      expect(result.totalAdded).toBe(2);
      expect(result.taskIds).toEqual(['task-1', 'task-3']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        url: 'https://allrecipes.com/recipes/main-dish/',
        error: 'Failed to add task',
      });
    });

    it('should handle complete failure when adding multiple tasks', async () => {
      const urls = [
        'https://allrecipes.com/recipes/desserts/',
        'https://allrecipes.com/recipes/main-dish/',
      ];

      mockGetExistingRecipeUrls.mockRejectedValue(new Error('Database error'));

      await expect(queueService.addMultipleToQueue(urls)).rejects.toThrow('Failed to add multiple tasks to queue');
    });

    it('should add multiple tasks without options', async () => {
      const urls = [
        'https://allrecipes.com/recipes/desserts/',
        'https://allrecipes.com/recipes/main-dish/',
      ];

      mockInvoke.mockResolvedValue('task-123');

      const result = await queueService.addMultipleToQueue(urls);

      expect(result.totalAdded).toBe(2);
      expect(mockInvoke).toHaveBeenCalledTimes(2);

      // Verify calls don't include maxRecipes/maxDepth when not provided
      urls.forEach((url, index) => {
        expect(mockInvoke).toHaveBeenNthCalledWith(index + 1, 'add_to_import_queue', {
          description: expect.stringContaining('AllRecipes'),
          request: expect.objectContaining({
            startUrl: url,
            existingUrls: [],
          }),
        });
      });
    });
  });

  describe('Task Description Generation', () => {
    it('should generate descriptive task names for AllRecipes URLs', () => {
      const allRecipesRequest: BatchImportRequest = {
        startUrl: 'https://allrecipes.com/recipes/desserts/cakes/',
        maxRecipes: 10,
        existingUrls: [],
      };

      const description = queueService.getTaskDescription(allRecipesRequest);

      expect(description).toContain('AllRecipes');
      expect(description).toContain('Desserts');
      expect(description).toContain('max 10 recipes');
    });

    it('should handle requests without limits', () => {
      const unlimitedRequest: BatchImportRequest = {
        startUrl: 'https://allrecipes.com/recipes/main-dish/',
        existingUrls: [],
      };

      const description = queueService.getTaskDescription(unlimitedRequest);

      expect(description).toContain('AllRecipes');
      expect(description).toContain('Main Dish');
      expect(description).not.toContain('max');
    });

    it('should handle non-AllRecipes URLs', () => {
      const otherRequest: BatchImportRequest = {
        startUrl: 'https://foodnetwork.com/recipes/',
        existingUrls: [],
      };

      const description = queueService.getTaskDescription(otherRequest);

      expect(description).toContain('foodnetwork.com');
    });

    it('should handle malformed URLs gracefully', () => {
      const badRequest: BatchImportRequest = {
        startUrl: 'not-a-valid-url',
        existingUrls: [],
      };

      const description = queueService.getTaskDescription(badRequest);

      expect(description).toBe('Batch Recipe Import');
    });
  });

  describe('Progress Tracking', () => {
    it('should start status monitoring', () => {
      const mockCallback = jest.fn();
      mockInvoke.mockResolvedValue(mockQueueTask);

      queueService.startStatusMonitoring(mockCallback, 500);

      expect(mockInvoke).toHaveBeenCalledWith('get_import_queue_status');
    });

    it('should stop status monitoring', () => {
      const mockCallback = jest.fn();
      queueService.startStatusMonitoring(mockCallback, 500);

      queueService.stopStatusMonitoring();

      // Should clear the interval
      expect(queueService['statusInterval']).toBeNull();
    });

    it('should get progress percentage for task', () => {
      const taskWithProgress: ImportQueueTask = {
        ...mockQueueTask,
        progress: {
          status: 'running',
          totalRecipes: 100,
          processedRecipes: 50,
          successfulImports: 40,
          failedImports: 10,
          estimatedTimeRemaining: 300,
        } as any,
      };

      const percentage = queueService.getProgressPercentage(taskWithProgress);

      expect(percentage).toBe(50);
    });

    it('should handle task without progress', () => {
      const taskWithoutProgress: ImportQueueTask = {
        ...mockQueueTask,
        progress: null,
      };

      const percentage = queueService.getProgressPercentage(taskWithoutProgress);

      expect(percentage).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle add to queue errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Queue is full'));

      await expect(
        queueService.addToQueue('Test import', mockBatchRequest)
      ).rejects.toThrow('Failed to add task to queue: Queue is full');
    });

    it('should handle queue status errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(queueService.getQueueStatus()).rejects.toThrow('Failed to get queue status');
    });

    it('should handle remove from queue errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Task not found'));

      await expect(queueService.removeFromQueue('invalid-task')).rejects.toThrow('Failed to remove task from queue');
    });

    it('should handle progress retrieval errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Task not found'));

      await expect(queueService.getTaskProgress('invalid-task')).rejects.toThrow('Failed to get task progress');
    });
  });

  describe('Task Status and Display', () => {
    it('should get status display text for pending task', () => {
      const pendingTask: ImportQueueTask = {
        ...mockQueueTask,
        status: 'pending',
      };

      const displayText = queueService.getStatusDisplayText(pendingTask);

      expect(displayText).toBe('Waiting in queue');
    });

    it('should get status display text for running task', () => {
      const runningTask: ImportQueueTask = {
        ...mockQueueTask,
        status: 'running',
        progress: {
          status: 'importingRecipes',
          processedRecipes: 25,
          totalRecipes: 100,
        } as any,
      };

      const displayText = queueService.getStatusDisplayText(runningTask);

      expect(displayText).toContain('Importing recipes');
      expect(displayText).toContain('25/100');
    });

    it('should get status display text for completed task', () => {
      const completedTask: ImportQueueTask = {
        ...mockQueueTask,
        status: 'completed',
        progress: {
          successfulImports: 80,
          failedImports: 5,
        } as any,
      };

      const displayText = queueService.getStatusDisplayText(completedTask);

      expect(displayText).toContain('Completed');
      expect(displayText).toContain('80 imported');
      expect(displayText).toContain('5 failed');
    });

    it('should check if task can be removed', () => {
      const pendingTask: ImportQueueTask = { ...mockQueueTask, status: 'pending' };
      const runningTask: ImportQueueTask = { ...mockQueueTask, status: 'running' };
      const completedTask: ImportQueueTask = { ...mockQueueTask, status: 'completed' };

      expect(queueService.canRemoveTask(pendingTask)).toBe(true);
      expect(queueService.canRemoveTask(runningTask)).toBe(true);
      expect(queueService.canRemoveTask(completedTask)).toBe(false);
    });
  });
});
