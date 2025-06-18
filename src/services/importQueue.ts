import { invoke } from '@tauri-apps/api/core';
import {
  ImportQueueTask,
  ImportQueueStatus,
  ImportQueueTaskStatus,
  BatchImportRequest,
  BatchImportProgress
} from '@app-types';
import { createLogger } from '@services/loggingService';
import { getExistingRecipeUrls } from '@services/recipeStorage';

const logger = createLogger('ImportQueue');

export class ImportQueueService {
  private statusInterval: NodeJS.Timeout | null = null;

  /**
   * Add a batch import task to the queue
   */
  async addToQueue(
    description: string,
    request: BatchImportRequest
  ): Promise<string> {
    try {
      await logger.info('Adding task to import queue', { description, startUrl: request.startUrl });

      const taskId: string = await invoke('add_to_import_queue', {
        description,
        request,
      });

      await logger.info('Task added to import queue successfully', { taskId, description });
      return taskId;
    } catch (error) {
      await logger.logError(error, 'Failed to add task to import queue', { description });
      throw new Error(`Failed to add task to queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start processing the import queue
   */
  async startQueueProcessing(): Promise<void> {
    try {
      await logger.info('Starting queue processing');

      await invoke('start_queue_processing');

      await logger.info('Queue processing started successfully');
    } catch (error) {
      await logger.logError(error, 'Failed to start queue processing');
      throw new Error(`Failed to start queue processing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add multiple batch import tasks to the queue
   */
  async addMultipleToQueue(
    urls: string[],
    options?: {
      maxRecipes?: number;
      maxDepth?: number;
    }
  ): Promise<{ taskIds: string[]; totalAdded: number; errors: Array<{ url: string; error: string }> }> {
    const taskIds: string[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    try {
      await logger.info('Adding multiple tasks to import queue', { urlCount: urls.length });

      // Get existing recipe URLs once for all tasks
      const existingUrls = await getExistingRecipeUrls();

      // Process each URL
      for (const url of urls) {
        try {
          const request: BatchImportRequest = {
            startUrl: url,
            maxRecipes: options?.maxRecipes,
            maxDepth: options?.maxDepth,
            existingUrls,
          };

          const description = this.getTaskDescription(request);
          const taskId = await this.addToQueue(description, request);
          taskIds.push(taskId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ url, error: errorMessage });
          await logger.logError(error, 'Failed to add individual task to queue', { url });
        }
      }

      await logger.info('Completed adding multiple tasks to queue', {
        totalRequested: urls.length,
        totalAdded: taskIds.length,
        totalErrors: errors.length
      });

      return {
        taskIds,
        totalAdded: taskIds.length,
        errors
      };
    } catch (error) {
      await logger.logError(error, 'Failed to add multiple tasks to queue');
      throw new Error(`Failed to add multiple tasks to queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<ImportQueueStatus> {
    try {
      const status: ImportQueueStatus = await invoke('get_import_queue_status');
      return status;
    } catch (error) {
      await logger.logError(error, 'Failed to get queue status');
      throw new Error(`Failed to get queue status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove a task from the queue
   */
  async removeFromQueue(taskId: string): Promise<void> {
    try {
      await logger.info('Removing task from import queue', { taskId });
      
      await invoke('remove_from_import_queue', { taskId });
      
      await logger.info('Task removed from import queue successfully', { taskId });
    } catch (error) {
      await logger.logError(error, 'Failed to remove task from queue', { taskId });
      throw new Error(`Failed to remove task from queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get progress for a specific task
   */
  async getTaskProgress(taskId: string): Promise<BatchImportProgress | null> {
    try {
      const progress: BatchImportProgress | null = await invoke('get_queue_task_progress', { taskId });
      return progress;
    } catch (error) {
      await logger.logError(error, 'Failed to get task progress', { taskId });
      throw new Error(`Failed to get task progress: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start monitoring queue status with periodic updates
   */
  startStatusMonitoring(onStatusUpdate: (status: ImportQueueStatus) => void, intervalMs: number = 1000): void {
    
    // Get initial status
    this.getQueueStatus()
      .then(status => onStatusUpdate(status))
      .catch(error => logger.logError(error, 'Failed to get initial queue status'));

    // Set up periodic updates
    this.statusInterval = setInterval(async () => {
      try {
        const status = await this.getQueueStatus();
        onStatusUpdate(status);
      } catch (error) {
        await logger.logError(error, 'Failed to get queue status during monitoring');
      }
    }, intervalMs);

    logger.debug('Started queue status monitoring', { intervalMs });
  }

  /**
   * Stop monitoring queue status
   */
  stopStatusMonitoring(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    logger.debug('Stopped queue status monitoring');
  }

  /**
   * Get a user-friendly description for a batch import request
   */
  getTaskDescription(request: BatchImportRequest): string {
    try {
      const url = new URL(request.startUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // Extract category name from AllRecipes URL
      if (url.hostname.includes('allrecipes.com')) {
        if (pathParts.includes('recipes')) {
          const categoryIndex = pathParts.indexOf('recipes') + 1;
          if (categoryIndex < pathParts.length) {
            const categoryPath = pathParts.slice(categoryIndex).join('/');
            const categoryName = categoryPath
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            let description = `AllRecipes: ${categoryName}`;
            if (request.maxRecipes) {
              description += ` (max ${request.maxRecipes} recipes)`;
            }
            return description;
          }
        }
        return 'AllRecipes Category Import';
      }
      
      return `Batch Import: ${url.hostname}`;
    } catch {
      return 'Batch Recipe Import';
    }
  }

  /**
   * Get estimated time remaining for a task
   */
  getEstimatedTimeRemaining(task: ImportQueueTask): string | null {
    if (!task.progress || task.status !== ImportQueueTaskStatus.RUNNING) {
      return null;
    }

    const progress = task.progress;
    if (progress.estimatedTimeRemaining) {
      const minutes = Math.ceil(progress.estimatedTimeRemaining / 60);
      if (minutes < 1) {
        return 'Less than 1 minute';
      } else if (minutes === 1) {
        return '1 minute';
      } else {
        return `${minutes} minutes`;
      }
    }

    return null;
  }

  /**
   * Get progress percentage for a task
   */
  getProgressPercentage(task: ImportQueueTask): number {
    if (!task.progress) {
      return 0;
    }

    const progress = task.progress;
    if (progress.totalRecipes === 0) {
      return 0;
    }

    return Math.round((progress.processedRecipes / progress.totalRecipes) * 100);
  }

  /**
   * Get category scraping progress information
   */
  getCategoryProgress(task: ImportQueueTask): { current: number; total: number; percentage: number; isActive: boolean } {
    if (!task.progress) {
      return { current: 0, total: 0, percentage: 0, isActive: false };
    }

    const progress = task.progress;
    const isActive = task.status === ImportQueueTaskStatus.RUNNING && (
      progress.status === 'crawlingCategories' ||
      progress.status === 'extractingRecipes'
    );

    if (progress.totalCategories === 0) {
      return { current: 0, total: 0, percentage: 0, isActive };
    }

    const percentage = Math.round((progress.processedCategories / progress.totalCategories) * 100);
    return {
      current: progress.processedCategories,
      total: progress.totalCategories,
      percentage,
      isActive
    };
  }

  /**
   * Get recipe import progress information
   */
  getRecipeProgress(task: ImportQueueTask): { current: number; total: number; percentage: number; isActive: boolean } {
    if (!task.progress) {
      return { current: 0, total: 0, percentage: 0, isActive: false };
    }

    const progress = task.progress;
    const isActive = task.status === ImportQueueTaskStatus.RUNNING &&
      progress.status === 'importingRecipes';

    if (progress.totalRecipes === 0) {
      return { current: 0, total: 0, percentage: 0, isActive };
    }

    const percentage = Math.round((progress.processedRecipes / progress.totalRecipes) * 100);
    return {
      current: progress.processedRecipes,
      total: progress.totalRecipes,
      percentage,
      isActive
    };
  }

  /**
   * Get current phase description for a running task
   */
  getCurrentPhaseDescription(task: ImportQueueTask): string {
    if (!task.progress || task.status !== ImportQueueTaskStatus.RUNNING) {
      return '';
    }

    const progress = task.progress;
    switch (progress.status) {
      case 'starting':
        return 'Initializing import...';
      case 'crawlingCategories':
        return 'Discovering recipe categories...';
      case 'extractingRecipes':
        return 'Extracting recipe URLs...';
      case 'filteringExisting':
        return 'Filtering existing recipes...';
      case 'importingRecipes':
        return 'Importing individual recipes...';
      default:
        return 'Processing...';
    }
  }

  /**
   * Get status display text for a task
   */
  getStatusDisplayText(task: ImportQueueTask): string {
    switch (task.status) {
      case ImportQueueTaskStatus.PENDING:
        return 'Waiting in queue';
      case ImportQueueTaskStatus.RUNNING:
        if (task.progress) {
          const progress = task.progress;
          switch (progress.status) {
            case 'starting':
              return 'Starting...';
            case 'crawlingCategories':
              return `Finding categories (${progress.processedCategories}/${progress.totalCategories || '?'})`;
            case 'extractingRecipes':
              return `Extracting recipes (${progress.processedCategories}/${progress.totalCategories || '?'} categories)`;
            case 'filteringExisting':
              return 'Filtering existing recipes...';
            case 'importingRecipes':
              return `Importing recipes (${progress.processedRecipes}/${progress.totalRecipes})`;
            default:
              return `Processing (${progress.processedRecipes}/${progress.totalRecipes})`;
          }
        }
        return 'Running';
      case ImportQueueTaskStatus.COMPLETED:
        if (task.progress) {
          return `Completed: ${task.progress.successfulImports} imported, ${task.progress.failedImports} failed`;
        }
        return 'Completed';
      case ImportQueueTaskStatus.FAILED:
        return task.error || 'Failed';
      case ImportQueueTaskStatus.CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if a task can be cancelled/removed
   */
  canRemoveTask(task: ImportQueueTask): boolean {
    return task.status === ImportQueueTaskStatus.PENDING || 
           task.status === ImportQueueTaskStatus.RUNNING;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopStatusMonitoring();
  }
}

// Export a singleton instance
export const importQueueService = new ImportQueueService();

// Export utility functions
export {
  ImportQueueTaskStatus,
} from '@app-types';
